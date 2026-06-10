/**
 * Service — Simulateur d'appel
 * Génère une conversation complète (agent ↔ appelant) à partir d'un script
 * d'industrie + un persona, de façon DÉTERMINISTE (même seed → même appel).
 * Produit : transcript, champs collectés, intelligence, statut, durée.
 *
 * C'est le banc d'essai officiel des scripts et des règles d'escalade avant
 * les appels réels (P2). C'est aussi le générateur des données seed.
 */
import type { Call, CallStatus, TranscriptTurn } from "@/domain/call";
import type { Company } from "@/domain/company";
import { isOutsideBusinessHours, type LanguageCode } from "@/domain/company";
import type { IndustryScript } from "@/domain/script";
import type { CallerPersona } from "@/domain/persona";
import type { VoiceAgentConfig } from "@/domain/agent";
import type { ScalyAction } from "@/domain/action";
import { chance, int, mulberry32, pick } from "@/lib/rng";
import { FIELD_BANK } from "@/data/personas";
import { intelligenceEngine } from "./intelligence";
import { planActionsForCall } from "./action-engine";

const EN_NEEDS = [
  "a quote for some work at my place",
  "booking an appointment this week",
  "some information about your services",
];

export interface SimulationInput {
  company: Company;
  script: IndustryScript;
  persona: CallerPersona;
  seed: number;
  /** Date/heure de l'appel simulé (par défaut : maintenant). */
  at?: Date;
  agent: VoiceAgentConfig;
}

export interface SimulationResult {
  call: Call;
  actions: ScalyAction[];
}

export function simulateCall(input: SimulationInput): SimulationResult {
  const { company, script, persona, seed, agent } = input;
  const at = input.at ?? new Date();
  const rng = mulberry32(seed);

  const turns: TranscriptTurn[] = [];
  let clock = 0;
  const push = (speaker: TranscriptTurn["speaker"], text: string, lang: LanguageCode = "fr") => {
    turns.push({ speaker, text, atMs: clock, lang });
    clock += int(rng, 2800, 6500);
  };

  const callerLang = persona.language;
  const isEnglish = persona.archetype === "anglophone";
  const agentLang: LanguageCode = isEnglish ? "en" : "fr";
  const isUrgent = persona.archetype === "urgence";
  const need = isEnglish ? pick(rng, EN_NEEDS) : pick(rng, isUrgent ? script.urgentNeeds : script.sampleNeeds);

  const interpolate = (s: string) => s.replace(/\{company\}/g, company.name).replace(/\{agent\}/g, agent.displayName);

  // --- Accueil ---
  push("agent", interpolate(script.greeting));
  push("caller", pick(rng, persona.openers).replace(/\{service\}/g, need), callerLang);

  const collected: Record<string, string> = {};
  let transferred = false;
  let transferReason: string | undefined;

  if (persona.archetype === "spam_fournisseur") {
    // --- Spam : refus poli, appel court ---
    push("agent", "Merci, mais nous ne prenons pas d'offres de sollicitation par téléphone. Je vous souhaite une bonne journée.");
    push("caller", "Ah, d'accord. Bonne journée.", callerLang);
  } else {
    if (isEnglish) {
      push("agent", "Of course, I'm happy to continue in English! How can I help you today?", "en");
      push("caller", `Thanks! As I said, I'm calling about ${need}.`, "en");
    }

    // --- Qualification ---
    for (const q of script.questions) {
      if (!q.required && (!persona.cooperative || chance(rng, 0.5))) continue;
      const qText = isEnglish ? (q.questionEn ?? q.question) : q.question;
      push("agent", qText, agentLang);

      if (!persona.cooperative && q.fieldKey !== "nom" && chance(rng, 0.35)) {
        push("caller", isEnglish ? "I'd rather not get into that right now." : "Honnêtement, je n'ai pas le temps de rentrer là-dedans.", callerLang);
        continue;
      }

      let answer: string;
      if (q.fieldKey === "description") {
        answer = isEnglish ? `It's about ${need} — that's pretty much it.` : `En fait, c'est pour ${need}.`;
      } else {
        const pool = persona.fieldAnswers[q.fieldKey] ?? FIELD_BANK[q.fieldKey];
        answer = pick(rng, pool);
      }
      push("caller", answer, callerLang);
      collected[q.fieldKey] = q.fieldKey === "description" ? need : answer;
    }

    // --- Objection éventuelle ---
    if (script.commonObjections.length > 0 && chance(rng, persona.objectionChance)) {
      const obj = pick(rng, script.commonObjections);
      push("caller", obj.objection, callerLang);
      push("agent", obj.response, agentLang);
    }

    // --- Escalade / transfert ---
    if (persona.archetype === "frustre") {
      push("agent", `Je suis sincèrement désolée de cette expérience. Je note votre plainte en priorité et ${company.ownerName} vous rappelle aujourd'hui même.`);
      if (chance(rng, 0.5)) {
        transferred = true;
        transferReason = "Client insatisfait — demande de parler à un responsable";
        push("caller", "J'aimerais mieux parler à quelqu'un tout de suite, s'il vous plaît.", callerLang);
        push("agent", "Bien sûr, je vous transfère immédiatement. Un instant, s'il vous plaît.");
      }
    } else if (isUrgent) {
      if (chance(rng, 0.45)) {
        transferred = true;
        transferReason = "Urgence critique — transfert direct selon les règles d'escalade";
        push("agent", "C'est bien noté, on traite ça comme une urgence. Je vous transfère immédiatement à l'équipe — un instant.");
      } else {
        push("agent", `C'est noté comme urgence. J'avise l'équipe à l'instant — on vous rappelle dans les prochaines minutes au ${collected["telephone"] ?? "numéro affiché"}.`);
      }
    }

    // --- Fermeture ---
    if (!transferred) {
      push(
        "agent",
        isEnglish
          ? `Perfect, I have everything I need. You'll receive a confirmation shortly. Thanks for calling ${company.name}!`
          : interpolate(agent.closingScript),
        agentLang,
      );
      push("caller", isEnglish ? "Great, thank you so much!" : "Parfait, merci beaucoup !", callerLang);
    }
  }

  const status: CallStatus = transferred ? "transferred" : "completed";
  const callerName = collected["nom"] ?? pick(rng, persona.names);

  const call: Call = {
    id: `call_${company.id}_s${seed}`,
    companyId: company.id,
    direction: "inbound",
    status,
    source: "simulator",
    fromNumber: pick(rng, persona.phones),
    callerName,
    language: callerLang,
    startedAt: at.toISOString(),
    durationSec: Math.round(clock / 1000) + int(rng, 2, 6),
    scriptId: script.id,
    personaId: persona.id,
    seed,
    transcript: turns,
    recordingUrl: null,
  };

  const savedReason = isOutsideBusinessHours(company, at) ? ("hors_heures" as const) : undefined;

  call.intelligence = intelligenceEngine.analyze(call, script, {
    persona,
    transferred,
    transferReason,
    collectedFields: collected,
    savedReason,
  });

  const actions = planActionsForCall(call, company);
  return { call, actions };
}
