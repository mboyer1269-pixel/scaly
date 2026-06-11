/**
 * Service — VoiceRuntimeCore (P2A)
 * Réducteur conversationnel tour par tour, PUR et DÉTERMINISTE :
 * (session, tour appelant) → nouvelle session. Aucune IO. Même seed + mêmes
 * tours → même conversation, mêmes décisions, mêmes latences simulées.
 *
 * Le flight recorder n'est pas un module à part : chaque décision, transition,
 * extraction, conflit, switch de langue et interruption est un VoiceRuntimeEvent
 * appendu à la session — c'est l'enregistreur de vol.
 *
 * HONNÊTETÉ : les latences sont SIMULÉES (marquées simulated:true) avec des
 * ordres de grandeur réalistes (STT streaming, NLU règles, TTS). En P2B les
 * vraies mesures remplaceront les simulées sans changer le contrat.
 */
import type { Company, LanguageCode } from "@/domain/company";
import type { IndustryScript, FieldKey } from "@/domain/script";
import type { VoiceAgentConfig } from "@/domain/agent";
import type { Intent, Urgency } from "@/domain/call";
import {
  ASKABLE_FIELDS,
  DERIVED_FIELDS,
  LATENCY_TARGET_P50_MS,
  LATENCY_TARGET_P95_MS,
  VOICE_FIELD_LABELS,
  type VoiceFieldKey,
  type VoiceFieldState,
  type VoiceRuntimeDecision,
  type VoiceRuntimeState,
  type VoiceRuntimeTelemetry,
  type VoiceSession,
  type VoiceTurn,
  type VoiceTurnLatency,
} from "@/domain/voice";
import { mulberry32, int } from "@/lib/rng";
import { newId } from "@/lib/format";
import { detectTurnLanguage, dominantLanguage } from "./voice-language";
import {
  detectsFrustration,
  detectsHumanRequest,
  detectsSpam,
  extractFields,
  isAffirmative,
  isUnintelligible,
} from "./voice-extraction";

export interface VoiceRuntimeContext {
  company: Company;
  agent: VoiceAgentConfig;
  script: IndustryScript;
}

export interface CallerInput {
  text: string;
  /** Force la langue (sinon détection automatique). */
  lang?: LanguageCode;
  /** Barge-in : l'appelant coupe la réponse agent en cours. */
  interrupt?: boolean;
}

/** Correspondance script FieldKey ↔ champ runtime. */
const SCRIPT_TO_VOICE: Partial<Record<FieldKey, VoiceFieldKey>> = {
  nom: "callerName",
  telephone: "phone",
  courriel: "email",
  adresse: "address",
  description: "requestedService",
  moment: "preferredTime",
};
export const VOICE_TO_SCRIPT: Partial<Record<VoiceFieldKey, FieldKey>> = {
  callerName: "nom",
  phone: "telephone",
  email: "courriel",
  address: "adresse",
  requestedService: "description",
  preferredTime: "moment",
};

const URGENCY_RANK: Record<Urgency, number> = { critique: 3, haute: 2, normale: 1, basse: 0 };

// ---------------------------------------------------------------------------
// Création de session
// ---------------------------------------------------------------------------

export function createVoiceSession(ctx: VoiceRuntimeContext, opts: { seed: number; scenarioId?: string }): VoiceSession {
  const startLang = ctx.company.defaultLanguage;
  const session: VoiceSession = {
    id: newId("vs"),
    companyId: ctx.company.id,
    scriptId: ctx.script.id,
    scenarioId: opts.scenarioId,
    seed: opts.seed,
    state: "greeting",
    dominantLanguage: startLang,
    activeLanguage: startLang,
    turns: [],
    fields: [...ASKABLE_FIELDS, ...DERIVED_FIELDS].map((key) => ({
      key,
      label: VOICE_FIELD_LABELS[key],
      status: "missing" as const,
      confidence: 0,
    })),
    events: [{ type: "session_started", at: 0, scenarioId: opts.scenarioId }],
    detectedUrgency: "normale",
    detectedIntent: ctx.script.primaryIntent,
    startedAtIso: new Date().toISOString(),
    clockMs: 0,
    unintelligibleStreak: 0,
    telemetry: emptyTelemetry(),
  };
  const greeting = interpolate(startLang === "en" ? ctx.script.greetingEn : ctx.script.greeting, ctx);
  pushAgentTurn(session, greeting, startLang);
  recomputeTelemetry(session);
  return session;
}

// ---------------------------------------------------------------------------
// Avancement d'un tour
// ---------------------------------------------------------------------------

export function advanceVoiceSession(ctx: VoiceRuntimeContext, prev: VoiceSession, input: CallerInput): VoiceSession {
  if (["completed", "failed"].includes(prev.state)) return prev;
  const session: VoiceSession = structuredClone(prev);
  const stateBefore = session.state;

  // --- Barge-in : l'appelant coupe la réponse agent en cours ---
  const lastTurn = session.turns[session.turns.length - 1];
  if (input.interrupt && lastTurn?.speaker === "agent") {
    lastTurn.interrupted = true;
    setState(session, "interrupted", "L'appelant a coupé la réponse de l'agente (barge-in)");
  }

  // --- Tour appelant ---
  const lang = input.lang ?? detectTurnLanguage(input.text, session.activeLanguage);
  const callerTurn: VoiceTurn = {
    id: newId("vt"),
    speaker: "caller",
    text: input.text,
    lang,
    atMs: session.clockMs,
  };
  session.turns.push(callerTurn);
  session.clockMs += Math.min(12_000, 1200 + input.text.length * 55);

  if (input.interrupt && lastTurn?.speaker === "agent") {
    session.events.push({ type: "interruption", at: callerTurn.atMs, interruptedTurnId: lastTurn.id, callerTurnId: callerTurn.id });
  }

  // --- Langue : détection, dominante, switch ---
  const callerLangs = session.turns.filter((t) => t.speaker === "caller").map((t) => t.lang);
  if (callerLangs.length === 1) {
    session.events.push({ type: "language_detected", at: callerTurn.atMs, turnId: callerTurn.id, lang });
    setState(session, "language_detection", "Premier tour appelant — langue détectée");
  } else {
    const prevLang = callerLangs[callerLangs.length - 2];
    if (prevLang !== lang) {
      session.events.push({ type: "language_switch", at: callerTurn.atMs, turnId: callerTurn.id, from: prevLang, to: lang });
    }
  }
  session.activeLanguage = lang;
  session.dominantLanguage = dominantLanguage(callerLangs, ctx.company.defaultLanguage);

  // --- Tour inaudible ---
  if (isUnintelligible(input.text)) {
    session.unintelligibleStreak += 1;
    if (session.unintelligibleStreak >= 2) {
      return endSession(ctx, session, "failed", "Appelant inaudible sur deux tours consécutifs");
    }
    decideAndReply(ctx, session, {
      action: "ask_field",
      reason: "Tour inaudible — demande de répétition",
      confidence: 0.9,
      stateBefore,
      stateAfter: "clarification",
    }, lang === "en" ? "Sorry, I'm having trouble hearing you — could you repeat that?" : "Pardon, je vous entends mal — pouvez-vous répéter ?");
    return finish(session);
  }
  session.unintelligibleStreak = 0;

  // --- Spam : refus poli, fin de session ---
  if (detectsSpam(input.text)) {
    session.detectedIntent = "spam";
    decideAndReply(ctx, session, {
      action: "refuse_spam",
      reason: "Sollicitation commerciale détectée — refus poli (règle produit)",
      confidence: 0.95,
      stateBefore,
      stateAfter: "closing",
    }, lang === "en"
      ? "Thank you, but we don't take solicitation calls. Have a good day!"
      : "Merci, mais nous ne prenons pas d'offres de sollicitation par téléphone. Bonne journée !");
    return endSession(ctx, session, "completed", "Appel de sollicitation refusé");
  }

  // --- Réponse à une confirmation/clarification en attente ---
  if (session.pendingField) {
    resolvePendingField(session, callerTurn, input.text);
  }

  // --- Extraction progressive ---
  applyExtractions(session, callerTurn, input.text);

  // --- Urgence (critères du script) ---
  scanUrgency(ctx, session, callerTurn, input.text);

  // --- Demande d'humain / frustration → escalade ---
  const wantsHuman = detectsHumanRequest(input.text);
  const frustrated = detectsFrustration(input.text);
  if (wantsHuman || frustrated) {
    session.detectedIntent = frustrated ? "plainte" : session.detectedIntent;
    const reason = wantsHuman
      ? "L'appelant demande explicitement un humain (règle non négociable : transfert immédiat)"
      : "Frustration détectée — escalade préventive vers un humain";
    return escalate(ctx, session, stateBefore, reason);
  }

  // --- Urgence critique : fast-track puis transfert à l'équipe de garde ---
  if (session.detectedUrgency === "critique") {
    const phone = getField(session, "phone");
    const address = getField(session, "address");
    if (phone.value && address.value) {
      return escalate(ctx, session, stateBefore, "Urgence critique avec rappel possible — transfert à l'équipe de garde");
    }
    const target: VoiceFieldKey = !address.value ? "address" : "phone";
    setState(session, "urgency_assessment", "Urgence critique — collecte accélérée (adresse + téléphone seulement)");
    askField(ctx, session, target, stateBefore, "Urgence critique — il ne manque que l'essentiel pour dépêcher l'équipe");
    return finish(session);
  }

  // --- Objections du script (ex. « c'est combien le déplacement ? ») ---
  const objection = matchObjection(ctx, input.text);

  // --- Conflit à clarifier ---
  const conflicted = session.fields.find((f) => f.status === "conflicted" && ASKABLE_FIELDS.includes(f.key));
  if (conflicted) {
    session.pendingField = conflicted.key;
    decideAndReply(ctx, session, {
      action: "clarify_conflict",
      targetField: conflicted.key,
      reason: `Deux valeurs contradictoires pour « ${conflicted.label} » — clarification obligatoire avant de continuer`,
      confidence: 0.95,
      stateBefore,
      stateAfter: "clarification",
    }, session.activeLanguage === "en"
      ? `I have two different values for ${conflicted.label.toLowerCase()}: "${conflicted.value}" and "${conflicted.conflictingValue}". Which one is correct?`
      : `J'ai noté deux valeurs différentes pour ${conflicted.label.toLowerCase()} : « ${conflicted.value} » et « ${conflicted.conflictingValue} ». Laquelle est la bonne ?`);
    return finish(session);
  }

  // --- Champ incertain à confirmer ---
  const uncertain = requiredVoiceFields(ctx).map((k) => getField(session, k)).find((f) => f.status === "inferred" && f.confidence < 0.8);
  if (uncertain) {
    session.pendingField = uncertain.key;
    decideAndReply(ctx, session, {
      action: "confirm_field",
      targetField: uncertain.key,
      reason: `« ${uncertain.label} » déduit avec confiance ${Math.round(uncertain.confidence * 100)} % — confirmation avant d'enregistrer`,
      confidence: uncertain.confidence,
      stateBefore,
      stateAfter: "clarification",
    }, session.activeLanguage === "en"
      ? `Just to confirm: ${uncertain.label.toLowerCase()} — "${uncertain.value}", is that right?`
      : `Juste pour confirmer : ${uncertain.label.toLowerCase()} — « ${uncertain.value} », c'est bien ça ?`);
    return finish(session);
  }

  // --- Prochain champ requis manquant ---
  const missing = requiredVoiceFields(ctx).find((k) => !getField(session, k).value);
  if (missing) {
    if (callerLangs.length === 1) setState(session, "intent_discovery", "Intention captée — début de la qualification");
    askField(ctx, session, missing, stateBefore, objection ? `Objection traitée (« ${objection.objection} ») puis reprise du fil` : undefined, objection?.response);
    return finish(session);
  }

  // --- Tout est collecté : récapitulatif puis complétion ---
  if (session.state === "closing") {
    if (isAffirmative(input.text) || input.text.trim().length > 0) {
      confirmDerivedFields(session, ctx);
      decideAndReply(ctx, session, {
        action: "complete",
        reason: "Fiche confirmée par l'appelant — fin d'appel propre",
        confidence: 0.95,
        stateBefore,
        stateAfter: "completed",
      }, session.activeLanguage === "en"
        ? "Perfect, it's all noted. Someone will call you back shortly. Thank you for calling!"
        : "Parfait, tout est noté. Quelqu'un vous rappelle sous peu. Merci d'avoir appelé !");
      return endSession(ctx, session, "completed", "Qualification complète, fiche confirmée");
    }
  }
  recapAndClose(ctx, session, stateBefore, objection?.response);
  return finish(session);
}

// ---------------------------------------------------------------------------
// Sous-routines
// ---------------------------------------------------------------------------

function emptyTelemetry(): VoiceRuntimeTelemetry {
  return {
    totalDurationMs: 0, turnCount: 0, callerTurnCount: 0, agentTurnCount: 0,
    perceivedLatenciesMs: [], perceivedP50Ms: 0, perceivedP95Ms: 0, latencyBudgetMet: true,
    sttTotalMs: 0, brainTotalMs: 0, ttsTotalMs: 0,
    fieldsConfirmed: 0, fieldsInferred: 0, fieldsMissing: 0, fieldsConflicted: 0,
    avgFieldConfidence: 0, languageSwitches: 0, interruptions: 0,
    transferRequested: false, finalStatus: "greeting", latenciesSimulated: true,
  };
}

function interpolate(s: string, ctx: VoiceRuntimeContext): string {
  return s.replace(/\{company\}/g, ctx.company.name).replace(/\{agent\}/g, ctx.agent.displayName);
}

function getField(session: VoiceSession, key: VoiceFieldKey): VoiceFieldState {
  const f = session.fields.find((x) => x.key === key);
  if (!f) throw new Error(`Champ voice inconnu : ${key}`);
  return f;
}

function requiredVoiceFields(ctx: VoiceRuntimeContext): VoiceFieldKey[] {
  return ctx.script.questions
    .filter((q) => q.required)
    .map((q) => SCRIPT_TO_VOICE[q.fieldKey])
    .filter((k): k is VoiceFieldKey => Boolean(k));
}

function setState(session: VoiceSession, to: VoiceRuntimeState, reason: string): void {
  if (session.state === to) return;
  session.events.push({ type: "state_transition", at: session.clockMs, from: session.state, to, reason });
  session.state = to;
}

/** Latence simulée déterministe (seed + index de tour). Ordres de grandeur P2 réalistes. */
function simulateLatency(session: VoiceSession, callerTextLen: number, replyLen: number): VoiceTurnLatency {
  const rng = mulberry32(session.seed + session.turns.length * 7919);
  const sttMs = Math.min(480, 140 + Math.round(callerTextLen * 1.1) + int(rng, 0, 60));
  const brainMs = int(rng, 60, 180); // NLU à règles : rapide. Un cerveau LLM coûterait 300-900 ms — mesuré en P2B.
  const ttsMs = Math.min(420, 110 + Math.round(replyLen * 0.8) + int(rng, 0, 50));
  return { sttMs, brainMs, ttsMs, perceivedMs: sttMs + brainMs + ttsMs, simulated: true };
}

function pushAgentTurn(session: VoiceSession, text: string, lang: LanguageCode): VoiceTurn {
  const lastCaller = [...session.turns].reverse().find((t) => t.speaker === "caller");
  const latency = simulateLatency(session, lastCaller?.text.length ?? 0, text.length);
  session.clockMs += latency.perceivedMs;
  const turn: VoiceTurn = { id: newId("vt"), speaker: "agent", text, lang, atMs: session.clockMs, latency };
  session.turns.push(turn);
  session.clockMs += Math.min(14_000, 1200 + text.length * 50);
  return turn;
}

function decideAndReply(ctx: VoiceRuntimeContext, session: VoiceSession, decision: VoiceRuntimeDecision, replyText: string): void {
  setState(session, decision.stateAfter, decision.reason);
  session.lastDecision = decision;
  session.events.push({ type: "decision", at: session.clockMs, decision });
  pushAgentTurn(session, replyText, session.activeLanguage);
}

function askField(ctx: VoiceRuntimeContext, session: VoiceSession, key: VoiceFieldKey, stateBefore: VoiceRuntimeState, reasonPrefix?: string, prefixText?: string): void {
  const scriptKey = VOICE_TO_SCRIPT[key];
  const q = ctx.script.questions.find((x) => x.fieldKey === scriptKey);
  const lang = session.activeLanguage;
  const question = lang === "en" ? q?.questionEn ?? q?.question ?? `Could you give me your ${VOICE_FIELD_LABELS[key].toLowerCase()}?` : q?.question ?? `Puis-je avoir votre ${VOICE_FIELD_LABELS[key].toLowerCase()} ?`;
  const isIdentity = key === "callerName" || key === "phone";
  const stateAfter: VoiceRuntimeState = session.detectedUrgency === "critique" ? "urgency_assessment" : isIdentity ? "caller_identification" : "field_collection";
  session.pendingField = key;
  decideAndReply(ctx, session, {
    action: "ask_field",
    targetField: key,
    reason: reasonPrefix ?? `Champ requis « ${VOICE_FIELD_LABELS[key]} » manquant — prochaine question du script`,
    confidence: 0.9,
    stateBefore,
    stateAfter,
  }, prefixText ? `${prefixText} ${question}` : question);
}

function applyExtractions(session: VoiceSession, turn: VoiceTurn, text: string): void {
  const extractions = extractFields(text, { askedField: session.pendingField, lang: turn.lang });
  for (const ex of extractions) {
    const field = getField(session, ex.key);
    const normalizedNew = ex.value.toLowerCase().trim();
    const normalizedOld = field.value?.toLowerCase().trim();
    if (field.value && normalizedOld !== normalizedNew && field.status !== "missing") {
      // Valeur contradictoire → conflit explicite (jamais d'écrasement silencieux).
      field.status = "conflicted";
      field.conflictingValue = ex.value;
      session.events.push({ type: "field_conflict", at: turn.atMs, key: ex.key, previous: field.value, incoming: ex.value, turnId: turn.id });
      continue;
    }
    const restated = normalizedOld === normalizedNew;
    field.value = ex.value;
    field.evidence = ex.evidence;
    field.sourceTurnId = turn.id;
    field.confidence = restated ? Math.max(field.confidence, 0.95) : ex.confidence;
    field.status = restated || ex.confidence >= 0.9 ? "confirmed" : "inferred";
    session.events.push({ type: "field_update", at: turn.atMs, key: ex.key, status: field.status, value: ex.value, confidence: field.confidence, turnId: turn.id });
    if (session.pendingField === ex.key) session.pendingField = undefined;
  }
}

function resolvePendingField(session: VoiceSession, turn: VoiceTurn, text: string): void {
  const key = session.pendingField;
  if (!key) return;
  const field = getField(session, key);
  if (field.status === "conflicted") {
    // L'appelant tranche : si sa réponse contient une des deux valeurs, on la garde.
    const t = text.toLowerCase();
    const keepIncoming = field.conflictingValue && t.includes(field.conflictingValue.toLowerCase().slice(0, 12));
    const keepCurrent = field.value && t.includes(field.value.toLowerCase().slice(0, 12));
    if (keepIncoming && !keepCurrent) field.value = field.conflictingValue;
    if (keepIncoming || keepCurrent || isAffirmative(text)) {
      field.status = "confirmed";
      field.confidence = 0.95;
      field.conflictingValue = undefined;
      session.events.push({ type: "field_update", at: turn.atMs, key, status: "confirmed", value: field.value, confidence: 0.95, turnId: turn.id });
      session.pendingField = undefined;
    }
    return;
  }
  if (field.status === "inferred" && isAffirmative(text)) {
    field.status = "confirmed";
    field.confidence = Math.max(field.confidence, 0.95);
    session.events.push({ type: "field_update", at: turn.atMs, key, status: "confirmed", value: field.value, confidence: field.confidence, turnId: turn.id });
    session.pendingField = undefined;
  }
}

function scanUrgency(ctx: VoiceRuntimeContext, session: VoiceSession, turn: VoiceTurn, text: string): void {
  const t = text.toLowerCase();
  for (const c of ctx.script.urgencyCriteria) {
    const matched = c.keywords.find((k) => t.includes(k.toLowerCase()));
    if (matched && URGENCY_RANK[c.level] > URGENCY_RANK[session.detectedUrgency]) {
      session.detectedUrgency = c.level;
      session.detectedIntent = c.level === "critique" ? "urgence" : session.detectedIntent;
      session.events.push({ type: "urgency_detected", at: turn.atMs, level: c.level, matched });
      const f = getField(session, "urgencyLevel");
      f.value = c.level;
      f.status = "inferred";
      f.confidence = 0.85;
      f.evidence = matched;
      f.sourceTurnId = turn.id;
    }
  }
}

function matchObjection(ctx: VoiceRuntimeContext, text: string): { objection: string; response: string } | undefined {
  const t = text.toLowerCase();
  return ctx.script.commonObjections.find((o) => {
    const frag = o.objection.toLowerCase().replace(/[?!.]/g, "").split(" ").filter((w) => w.length > 3);
    const hits = frag.filter((w) => t.includes(w)).length;
    return frag.length > 0 && hits / frag.length >= 0.6;
  });
}

function escalate(ctx: VoiceRuntimeContext, session: VoiceSession, stateBefore: VoiceRuntimeState, reason: string): VoiceSession {
  setState(session, "escalation_needed", reason);
  session.transfer = { to: ctx.company.transferPhone, reason };
  const esc = getField(session, "escalationReason");
  esc.value = reason;
  esc.status = "confirmed";
  esc.confidence = 0.95;
  session.events.push({ type: "transfer_requested", at: session.clockMs, to: ctx.company.transferPhone, reason });
  decideAndReply(ctx, session, {
    action: "escalate_transfer",
    reason,
    confidence: 0.95,
    stateBefore,
    stateAfter: "escalation_needed",
  }, session.activeLanguage === "en"
    ? `I completely understand. I'm transferring you to a team member right now — one moment please.`
    : `Je comprends tout à fait. Je vous transfère immédiatement à un membre de l'équipe — un instant s'il vous plaît.`);
  confirmDerivedFields(session, ctx);
  return endSession(ctx, session, "completed", `Transfert humain : ${reason}`);
}

function recapAndClose(ctx: VoiceRuntimeContext, session: VoiceSession, stateBefore: VoiceRuntimeState, prefixText?: string): void {
  const name = getField(session, "callerName").value ?? (session.activeLanguage === "en" ? "your file" : "votre dossier");
  const service = getField(session, "requestedService").value ?? "—";
  const time = getField(session, "preferredTime").value ?? "—";
  const phone = getField(session, "phone").value ?? "—";
  const recap = session.activeLanguage === "en"
    ? `Perfect, let me recap: ${service}, preferred time "${time}", callback at ${phone} for ${name}. Is everything correct?`
    : `Parfait, je récapitule : ${service}, moment souhaité « ${time} », rappel au ${phone} pour ${name}. Tout est exact ?`;
  decideAndReply(ctx, session, {
    action: "recap_and_close",
    reason: "Tous les champs requis sont remplis — récapitulatif avant clôture",
    confidence: 0.9,
    stateBefore,
    stateAfter: "closing",
  }, prefixText ? `${prefixText} ${recap}` : recap);
}

function confirmDerivedFields(session: VoiceSession, ctx: VoiceRuntimeContext): void {
  const urgency = getField(session, "urgencyLevel");
  urgency.value = session.detectedUrgency;
  urgency.status = "confirmed";
  urgency.confidence = Math.max(urgency.confidence, 0.85);

  const intent = getField(session, "primaryIntent");
  intent.value = session.detectedIntent;
  intent.status = "confirmed";
  intent.confidence = 0.85;

  const summary = getField(session, "summary");
  const name = getField(session, "callerName").value ?? "Appelant inconnu";
  const service = getField(session, "requestedService").value ?? "demande à préciser";
  const address = getField(session, "address").value;
  const time = getField(session, "preferredTime").value;
  summary.value = `${name} : ${service}${address ? ` à ${address}` : ""}${time ? ` — ${time}` : ""}.${session.transfer ? ` Transféré : ${session.transfer.reason}.` : ""}`;
  summary.status = "confirmed";
  summary.confidence = 0.85;
}

function endSession(ctx: VoiceRuntimeContext, session: VoiceSession, status: "completed" | "failed", reason: string): VoiceSession {
  if (status === "failed") {
    confirmDerivedFields(session, ctx);
    session.telemetry.failureReason = reason;
  }
  setState(session, status, reason);
  session.events.push({ type: "session_ended", at: session.clockMs, status, reason });
  session.endedAtIso = new Date().toISOString();
  return finish(session);
}

function finish(session: VoiceSession): VoiceSession {
  recomputeTelemetry(session);
  return session;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function recomputeTelemetry(session: VoiceSession): void {
  const t = session.telemetry;
  const agentTurns = session.turns.filter((x) => x.speaker === "agent");
  const latencies = agentTurns.map((x) => x.latency?.perceivedMs ?? 0).filter((x) => x > 0);
  const sorted = [...latencies].sort((a, b) => a - b);
  t.totalDurationMs = session.clockMs;
  t.turnCount = session.turns.length;
  t.callerTurnCount = session.turns.length - agentTurns.length;
  t.agentTurnCount = agentTurns.length;
  t.perceivedLatenciesMs = latencies;
  t.perceivedP50Ms = percentile(sorted, 50);
  t.perceivedP95Ms = percentile(sorted, 95);
  t.latencyBudgetMet = t.perceivedP50Ms < LATENCY_TARGET_P50_MS && t.perceivedP95Ms < LATENCY_TARGET_P95_MS;
  t.sttTotalMs = agentTurns.reduce((s, x) => s + (x.latency?.sttMs ?? 0), 0);
  t.brainTotalMs = agentTurns.reduce((s, x) => s + (x.latency?.brainMs ?? 0), 0);
  t.ttsTotalMs = agentTurns.reduce((s, x) => s + (x.latency?.ttsMs ?? 0), 0);
  const askable = session.fields.filter((f) => ASKABLE_FIELDS.includes(f.key));
  t.fieldsConfirmed = askable.filter((f) => f.status === "confirmed").length;
  t.fieldsInferred = askable.filter((f) => f.status === "inferred").length;
  t.fieldsMissing = askable.filter((f) => f.status === "missing").length;
  t.fieldsConflicted = askable.filter((f) => f.status === "conflicted").length;
  const withValue = session.fields.filter((f) => f.value);
  t.avgFieldConfidence = withValue.length ? Math.round((withValue.reduce((s, f) => s + f.confidence, 0) / withValue.length) * 100) / 100 : 0;
  t.languageSwitches = session.events.filter((e) => e.type === "language_switch").length;
  t.interruptions = session.events.filter((e) => e.type === "interruption").length;
  t.transferRequested = Boolean(session.transfer);
  t.finalStatus = session.state;
  t.latenciesSimulated = agentTurns.every((x) => x.latency?.simulated !== false);
}
