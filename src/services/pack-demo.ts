/**
 * Service — Démo par pack d'industrie.
 * Fait tourner LE VRAI cerveau vocal (voice-runtime) sur un scénario de pack et
 * assemble un rapport présentable : transcript, fiche captée, décision (transfert
 * /urgence), efficacité (latence, durée) et cadrage revenu.
 *
 * PUR et DÉTERMINISTE : aucune IO, aucun store. Même scénario → même rapport.
 * Partagé par les tests CI et la page de démo — une seule définition de « la démo ».
 */
import { NEXT_ACTION_LABELS } from "@/domain/call";
import type { LanguageCode } from "@/domain/company";
import {
  ASKABLE_FIELDS,
  VOICE_STATE_LABELS,
  type VoiceFieldStatus,
  type VoiceRuntimeState,
} from "@/domain/voice";
import { PACK_DEMO_SCENARIOS, type PackDemoScenario } from "@/data/pack-demo-scenarios";
import { urgencyBadge } from "@/lib/labels";
import { buildVoiceContext, runVoiceScenario } from "./voice-lab";

export interface PackDemoTranscriptTurn {
  speaker: "agent" | "caller";
  text: string;
  lang: LanguageCode;
  /** Latence perçue simulée pour ce tour agent (ms). */
  latencyMs?: number;
  /** Vrai si l'appelant a coupé ce tour agent (barge-in). */
  interrupted?: boolean;
}

export interface PackDemoField {
  label: string;
  value: string;
  status: VoiceFieldStatus;
  confidencePct: number;
}

/**
 * Un tour du script d'appel destiné à l'audio. Dérivé du transcript du VRAI
 * cerveau — ce qu'on entend est exactement ce que le runtime produit.
 */
export interface PackDemoCallTurn {
  index: number;
  speaker: "maude" | "caller";
  text: string;
  lang: LanguageCode;
  /** Consigne de ton pour le TTS. */
  tone: string;
  /** Nom de voix TTS (OpenAI) à utiliser pour ce tour. */
  voiceHint: string;
  /** Silence à insérer après ce clip, en lecture séquentielle. */
  pauseAfterMs: number;
  /** Chemin de l'asset audio attendu (sous /public). */
  audioPath: string;
  interrupted?: boolean;
}

const MAUDE_TONE = "Calme, professionnelle, posée et rassurante. Français québécois naturel, débit efficace.";

/** Chemin d'asset audio — SOURCE UNIQUE partagée par la page et le générateur. */
export function packDemoAudioPath(scenarioId: string, index: number, speaker: "maude" | "caller"): string {
  return `/demo-audio/${scenarioId}/${String(index + 1).padStart(2, "0")}-${speaker}.mp3`;
}

/** Dérive le script d'appel audio depuis le transcript du cerveau (déterministe). */
export function buildCallScript(scenario: PackDemoScenario, transcript: PackDemoTranscriptTurn[]): PackDemoCallTurn[] {
  return transcript.map((turn, index) => {
    const speaker: "maude" | "caller" = turn.speaker === "agent" ? "maude" : "caller";
    return {
      index,
      speaker,
      text: turn.text,
      lang: turn.lang,
      tone: speaker === "maude" ? MAUDE_TONE : scenario.voices.callerTone,
      voiceHint: speaker === "maude" ? scenario.voices.maude : scenario.voices.caller,
      pauseAfterMs: speaker === "maude" ? 500 : 350,
      audioPath: packDemoAudioPath(scenario.id, index, speaker),
      interrupted: turn.interrupted,
    };
  });
}

export interface PackDemoOutcome {
  status: VoiceRuntimeState;
  statusLabel: string;
  transferred: boolean;
  transferTo?: string;
  transferReason?: string;
  finalActionLabel: string;
}

export interface PackDemoEfficiency {
  totalSeconds: number;
  turnCount: number;
  callerTurnCount: number;
  fieldsConfirmed: number;
  perceivedP50Ms: number;
  perceivedP95Ms: number;
  latencyBudgetMet: boolean;
  /** HONNÊTETÉ : latences simulées tant que la mesure temps réel (P2B) n'existe pas. */
  latenciesSimulated: boolean;
}

export interface PackDemoReport {
  scenarioId: string;
  packLabel: string;
  companyName: string;
  agentName: string;
  sectorLabel: string;
  title: string;
  proves: string;
  hook: string;
  missedCallCost: string;
  /** Divulgation honnête affichée sous le lecteur (simulation, pas appel réel). */
  disclosureLabel: string;
  transcript: PackDemoTranscriptTurn[];
  /** Script d'appel pour l'audio (dérivé du transcript du cerveau). */
  callScript: PackDemoCallTurn[];
  capturedFields: PackDemoField[];
  outcome: PackDemoOutcome;
  urgencyLabel: string;
  intent: string;
  efficiency: PackDemoEfficiency;
  revenue: {
    /** Valeur indicative d'un mandat pour cette verticale (hypothèse interne). */
    leadValueCad: number;
    note: string;
  };
}

/** Construit le rapport de démo pour un scénario de pack (vrai runtime). */
export function buildPackDemoReport(scenario: PackDemoScenario): PackDemoReport {
  const ctx = buildVoiceContext(scenario.companyId, scenario.scriptId);
  const session = runVoiceScenario(scenario);
  const t = session.telemetry;

  const transcript: PackDemoTranscriptTurn[] = session.turns.map((turn) => ({
    speaker: turn.speaker,
    text: turn.text,
    lang: turn.lang,
    latencyMs: turn.latency?.perceivedMs,
    interrupted: turn.interrupted,
  }));

  // Overrides VITRINE (démonstrateur) — affichage + audio seulement, jamais le
  // moteur/golden. Ligne d'accueil verrouillée (Maude / AutoHorizon), sans
  // « assistante virtuelle ». Le premier tour agent porte l'accueil.
  if (scenario.openingLine) {
    const firstAgent = transcript.findIndex((t) => t.speaker === "agent");
    if (firstAgent >= 0) transcript[firstAgent] = { ...transcript[firstAgent], text: scenario.openingLine };
  }
  const agentName = scenario.personaName ?? ctx.agent.displayName;
  const companyName = scenario.brandCompanyName ?? ctx.company.name;

  // On n'affiche que les champs demandés à l'appelant qui ont une valeur (la « fiche »).
  const capturedFields: PackDemoField[] = session.fields
    .filter((f) => ASKABLE_FIELDS.includes(f.key) && f.value)
    .map((f) => ({
      label: f.label,
      value: f.value as string,
      status: f.status,
      confidencePct: Math.round(f.confidence * 100),
    }));

  const outcome: PackDemoOutcome = {
    status: session.state,
    statusLabel: VOICE_STATE_LABELS[session.state],
    transferred: Boolean(session.transfer),
    transferTo: session.transfer?.to,
    transferReason: session.transfer?.reason,
    finalActionLabel: NEXT_ACTION_LABELS[ctx.script.finalAction] ?? ctx.script.finalAction,
  };

  return {
    scenarioId: scenario.id,
    packLabel: scenario.packLabel,
    companyName,
    agentName,
    sectorLabel: ctx.company.sectorLabel ?? ctx.script.name,
    title: scenario.title,
    proves: scenario.proves,
    hook: scenario.hook,
    missedCallCost: scenario.missedCallCost,
    disclosureLabel: scenario.disclosureLabel,
    transcript,
    callScript: buildCallScript(scenario, transcript),
    capturedFields,
    outcome,
    urgencyLabel: urgencyBadge(session.detectedUrgency).label,
    intent: session.detectedIntent,
    efficiency: {
      totalSeconds: Math.round(t.totalDurationMs / 1000),
      turnCount: t.turnCount,
      callerTurnCount: t.callerTurnCount,
      fieldsConfirmed: t.fieldsConfirmed,
      perceivedP50Ms: t.perceivedP50Ms,
      perceivedP95Ms: t.perceivedP95Ms,
      latencyBudgetMet: t.latencyBudgetMet,
      latenciesSimulated: t.latenciesSimulated,
    },
    revenue: {
      leadValueCad: ctx.script.valueBaselineCad,
      note: "Valeur indicative d'un mandat pour cette verticale (hypothèse interne à recalibrer par client). Un appel manqué, c'est ce lead perdu.",
    },
  };
}

/** Tous les rapports de démo, dans l'ordre des packs. */
export function buildAllPackDemoReports(): PackDemoReport[] {
  return PACK_DEMO_SCENARIOS.map(buildPackDemoReport);
}
