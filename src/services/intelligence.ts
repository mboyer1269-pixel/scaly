/**
 * Service — Call Intelligence
 * Port `IntelligenceEngine` + implémentation "rules-v1" (heuristiques déterministes).
 *
 * HONNÊTETÉ TECHNIQUE : rules-v1 n'est PAS un LLM. C'est un moteur à mots-clés,
 * suffisant pour la démo et les tests, et remplaçable par un moteur LLM (P1)
 * sans toucher au reste du système — même interface, mêmes structures de sortie.
 */
import type {
  Call,
  CallIntelligence,
  FinalStatus,
  Intent,
  LeadQuality,
  NextAction,
  Sentiment,
  Urgency,
} from "@/domain/call";
import type { IndustryScript } from "@/domain/script";
import type { CallerPersona } from "@/domain/persona";
import { computeCommercialScore, estimateValueCad, extractMentionedAmountCad, type ValueTier } from "./scoring";

export interface AnalysisHints {
  persona?: CallerPersona;
  savedReason?: "hors_heures" | "rappel_sms";
  transferred?: boolean;
  transferReason?: string;
  collectedFields?: Record<string, string>;
}

export interface IntelligenceEngine {
  readonly name: "rules-v1" | "llm";
  analyze(call: Call, script: IndustryScript, hints?: AnalysisHints): CallIntelligence;
}

const SPAM_KEYWORDS = ["référencement", "offre exclusive", "promotion", "sondage", "télémarketing", "forfait téléphonique", "responsable des télécommunications"];
const COMPLAINT_KEYWORDS = ["pas content", "plainte", "personne ne me rappelle", "déçu", "inacceptable", "mauvais service", "vraiment pas content"];
/** Suivi d'un dossier/travail en cours (« où en est ma voiture ? ») — générique, pas propre à un métier. */
const STATUS_KEYWORDS = ["où en est", "des nouvelles de", "statut de ma", "statut de mon", "mon dossier", "est-elle prête", "est-il prêt", "toujours pas de nouvelles"];
/** Question d'information pure (heures, adresse) — sans demande de service. */
const INFO_KEYWORDS = ["vos heures", "les heures", "heures d'ouverture", "êtes-vous ouverts", "êtes-vous ouvert", "quelle est votre adresse"];
const POSITIVE_KEYWORDS = ["merci beaucoup", "parfait", "super", "excellent", "great, thank"];

const URGENCY_RANK: Record<Urgency, number> = { critique: 3, haute: 2, normale: 1, basse: 0 };

function callerText(call: Call): string {
  return call.transcript.filter((t) => t.speaker === "caller").map((t) => t.text).join(" ").toLowerCase();
}

function fillTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => fields[key] ?? "non précisé");
}

class RulesV1Engine implements IntelligenceEngine {
  readonly name = "rules-v1" as const;

  analyze(call: Call, script: IndustryScript, hints: AnalysisHints = {}): CallIntelligence {
    const text = callerText(call);
    const fields = hints.collectedFields ?? {};
    const urgencyText = fields["description"]?.toLowerCase() || text;

    // --- Appel manqué : analyse minimale, valeur à risque calculée en analytics ---
    if (call.transcript.length === 0) {
      return {
        engine: this.name,
        summary: hints.savedReason === "rappel_sms"
          ? "Appel manqué — SMS de rappel automatique envoyé, client récupéré."
          : "Appel manqué — aucun échange. Valeur potentiellement perdue.",
        intent: "autre",
        intentConfidence: 0.5,
        sentiment: "neutre",
        urgency: "normale",
        leadQuality: "non_qualifie",
        estimatedValueCad: hints.savedReason === "rappel_sms" ? script.valueBaselineCad : 0,
        valueBasis: hints.savedReason === "rappel_sms" ? "bareme_industrie" : "aucun",
        nextAction: hints.savedReason ? "creer_suivi" : "rappeler_immediatement",
        tags: ["appel-manque", ...(hints.savedReason ? ["appel-sauve"] : [])],
        commercialScore: hints.savedReason ? 45 : 20,
        confidence: 0.9,
        finalStatus: "suivi_requis",
        collectedFields: {},
        saved: hints.savedReason ? { reason: hints.savedReason } : undefined,
      };
    }

    // --- Détections par mots-clés ---
    const isSpam = hints.persona?.archetype === "spam_fournisseur" || SPAM_KEYWORDS.some((k) => text.includes(k));
    const isComplaint = !isSpam && (hints.persona?.archetype === "frustre" || COMPLAINT_KEYWORDS.some((k) => text.includes(k)));

    let urgency: Urgency = "normale";
    let urgencyHits = 0;
    for (const c of script.urgencyCriteria) {
      if (c.keywords.some((k) => urgencyText.includes(k.toLowerCase()))) {
        urgencyHits += 1;
        if (URGENCY_RANK[c.level] > URGENCY_RANK[urgency]) urgency = c.level;
      }
    }
    if (hints.persona?.archetype === "urgence" && URGENCY_RANK[urgency] < 3) urgency = "critique";
    if (isSpam) urgency = "basse";
    if (isComplaint && URGENCY_RANK[urgency] < 2) urgency = "haute";

    const intent: Intent = isSpam
      ? "spam"
      : isComplaint
        ? "plainte"
        : urgency === "critique"
          ? "urgence"
          : STATUS_KEYWORDS.some((k) => text.includes(k))
            ? "suivi_dossier"
            : INFO_KEYWORDS.some((k) => text.includes(k))
              ? "question_info"
              : script.primaryIntent;

    const sentiment: Sentiment = isComplaint
      ? "negatif"
      : POSITIVE_KEYWORDS.some((k) => text.includes(k))
        ? "positif"
        : "neutre";

    // --- Complétude des informations requises ---
    const requiredKeys = script.questions.filter((q) => q.required).map((q) => q.fieldKey);
    const collectedRequired = requiredKeys.filter((k) => fields[k]).length;
    const completeness = requiredKeys.length === 0 ? 1 : collectedRequired / requiredKeys.length;

    // --- Valeur estimée ---
    const mentioned = extractMentionedAmountCad(text);
    const tier: ValueTier = isSpam
      ? "nul"
      : hints.persona?.valueTier ?? (urgency === "critique" ? "haut" : completeness >= 0.8 ? "moyen" : "bas");
    const estimatedValueCad = isSpam ? 0 : mentioned ?? estimateValueCad(tier, script.valueBaselineCad);
    const valueBasis: CallIntelligence["valueBasis"] = isSpam ? "aucun" : mentioned ? "montant_mentionne" : "bareme_industrie";

    // --- Qualité du lead ---
    const leadQuality: LeadQuality = isSpam
      ? "non_qualifie"
      : isComplaint
        ? "froid"
        : completeness >= 0.75 && (URGENCY_RANK[urgency] >= 2 || estimatedValueCad >= script.valueBaselineCad)
          ? "chaud"
          : completeness >= 0.5
            ? "tiede"
            : "froid";

    // --- Prochaine action et statut final ---
    const nextAction: NextAction = isSpam
      ? "aucune"
      : hints.transferred
        ? "transferer_humain"
        : isComplaint
          ? "creer_suivi"
          : urgency === "critique"
            ? "rappeler_immediatement"
            : script.finalAction;

    const finalStatus: FinalStatus = hints.transferred
      ? "transfere"
      : isSpam
        ? "ignore_spam"
        : nextAction === "aucune"
          ? "resolu_par_ia"
          : "suivi_requis";

    // --- Résumé ---
    let summary = isSpam
      ? "Appel de sollicitation (spam) — refusé poliment par l'agente. Aucune action requise."
      : isComplaint
        ? `Plainte de ${fields["nom"] ?? call.callerName ?? "l'appelant"} : insatisfaction exprimée. Rappel de service prioritaire requis.`
        : fillTemplate(script.expectedSummary, { ...fields, description: fields["description"] ?? "demande à préciser" });
    if (urgency === "critique" && !isSpam) summary = `URGENT — ${summary}`;
    if (hints.savedReason === "hors_heures") summary += " (Appel reçu hors heures d'ouverture — sauvé par Allô Maude.)";

    const tags = [
      ...script.crmTags,
      intent,
      ...(urgency === "critique" ? ["urgence-critique"] : []),
      ...(call.language === "en" ? ["anglais"] : []),
      ...(hints.savedReason ? ["appel-sauve"] : []),
    ];

    const keywordDriven = isSpam || isComplaint || urgencyHits > 0;
    const intentConfidence = round2(keywordDriven ? 0.85 : 0.7);
    const confidence = round2(Math.min(0.9, Math.max(0.5, 0.55 + 0.15 * completeness + (call.transcript.length >= 6 ? 0.1 : 0) + (keywordDriven ? 0.05 : 0))));

    return {
      engine: this.name,
      summary,
      intent,
      intentConfidence,
      sentiment,
      urgency,
      leadQuality,
      estimatedValueCad,
      valueBasis,
      nextAction,
      transferReason: hints.transferred ? hints.transferReason ?? "Demande de l'appelant" : undefined,
      tags,
      commercialScore: computeCommercialScore({
        urgency,
        leadQuality,
        sentiment,
        fieldsCollected: collectedRequired,
        fieldsRequired: requiredKeys.length,
        estimatedValueCad,
        valueBaselineCad: script.valueBaselineCad,
      }),
      confidence,
      finalStatus,
      collectedFields: fields,
      saved: hints.savedReason ? { reason: hints.savedReason } : undefined,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Moteur par défaut. En P1, un `LlmEngine` implémentera la même interface. */
export const intelligenceEngine: IntelligenceEngine = new RulesV1Engine();
