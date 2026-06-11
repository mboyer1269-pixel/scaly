/**
 * Service — LlmIntelligenceEngine (P1)
 * Analyse un transcript BRUT via OpenAI (structured outputs) et produit la même
 * structure CallIntelligence que rules-v1. Aucun hint de génération n'est
 * utilisé : le moteur doit comprendre la conversation, pas recopier le seed.
 *
 * Garde-fous :
 * - transcript vide → délégué à rules-v1 (aucun appel API, étiquette honnête) ;
 * - sortie validée champ par champ (enums, bornes numériques) ;
 * - commercialScore/valeur recalculés par le MÊME barème déterministe que
 *   rules-v1 (src/services/scoring.ts) — le LLM classifie, il ne tarife pas ;
 * - clé absente → LlmNotConfiguredError explicite (jamais de faux succès).
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
import { computeCommercialScore, estimateValueCad, type ValueTier } from "./scoring";
import { intelligenceEngine, type AnalysisHints } from "./intelligence";

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("OPENAI_API_KEY absente — le moteur LLM n'est pas configuré (ajoutez la clé dans .env.local).");
    this.name = "LlmNotConfiguredError";
  }
}

const INTENTS: Intent[] = ["urgence", "prise_rdv", "demande_soumission", "question_info", "plainte", "suivi_dossier", "annulation", "fournisseur", "spam", "autre"];
const URGENCIES: Urgency[] = ["critique", "haute", "normale", "basse"];
const SENTIMENTS: Sentiment[] = ["positif", "neutre", "negatif"];
const LEAD_QUALITIES: LeadQuality[] = ["chaud", "tiede", "froid", "non_qualifie"];
const NEXT_ACTIONS: NextAction[] = ["rappeler_immediatement", "confirmer_rdv", "envoyer_soumission", "transferer_humain", "creer_suivi", "aucune"];
const FINAL_STATUSES: FinalStatus[] = ["resolu_par_ia", "transfere", "suivi_requis", "perdu", "ignore_spam"];
const VALUE_TIERS: ValueTier[] = ["haut", "moyen", "bas", "nul"];

/** Sortie structurée demandée au modèle (JSON Schema strict). */
interface LlmRawAnalysis {
  summary: string;
  intent: string;
  intentConfidence: number;
  sentiment: string;
  urgency: string;
  leadQuality: string;
  valueTier: string;
  mentionedAmountCad: number | null;
  nextAction: string;
  transferReason: string | null;
  tags: string[];
  finalStatus: string;
  collectedFields: { key: string; value: string }[];
  confidence: number;
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", description: "Résumé factuel de l'appel en 1-2 phrases, en français." },
    intent: { enum: INTENTS },
    intentConfidence: { type: "number", description: "Confiance 0..1 sur l'intention." },
    sentiment: { enum: SENTIMENTS },
    urgency: { enum: URGENCIES },
    leadQuality: { enum: LEAD_QUALITIES },
    valueTier: { enum: VALUE_TIERS, description: "Palier de valeur commerciale de la demande pour ce type d'entreprise." },
    mentionedAmountCad: { type: ["number", "null"], description: "Montant en dollars explicitement mentionné par l'appelant, sinon null." },
    nextAction: { enum: NEXT_ACTIONS },
    transferReason: { type: ["string", "null"] },
    tags: { type: "array", items: { type: "string" }, description: "3 à 6 tags CRM courts en minuscules-kebab." },
    finalStatus: { enum: FINAL_STATUSES },
    collectedFields: {
      type: "array",
      description: "Informations factuelles extraites du transcript (clés fournies dans les instructions).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { key: { type: "string" }, value: { type: "string" } },
        required: ["key", "value"],
      },
    },
    confidence: { type: "number", description: "Confiance globale 0..1 de l'analyse." },
  },
  required: ["summary", "intent", "intentConfidence", "sentiment", "urgency", "leadQuality", "valueTier", "mentionedAmountCad", "nextAction", "transferReason", "tags", "finalStatus", "collectedFields", "confidence"],
} as const;

function systemPrompt(script: IndustryScript): string {
  const fieldKeys = script.questions.map((q) => `${q.fieldKey}${q.required ? " (requis)" : ""}`).join(", ");
  return `Tu es l'analyste d'appels de Scaly, une réceptionniste IA pour PME québécoises (français québécois et anglais).
On te donne le transcript brut d'un appel téléphonique. Analyse-le UNIQUEMENT à partir de ce qui est dit.

DÉFINITIONS D'INTENTION (choisis la raison d'appel dominante du point de vue de l'appelant) :
- urgence : situation pressante exigeant une intervention immédiate ou le jour même (dégât actif, panne bloquante, douleur aiguë, échéance ferme aujourd'hui/demain). Si l'appelant demande un PRIX, l'intention reste demande_soumission — l'urgence va dans le champ urgency.
- prise_rdv : veut réserver un créneau pour un service à prix connu/fixe (garage, dentiste, salon…).
- demande_soumission : veut un prix ou une estimation, compare des fournisseurs, mentionne un budget, OU demande des travaux/services dont le coût doit être évalué avant d'agir.
- question_info : question générale sans intention d'achat claire.
- plainte : insatisfaction sur un service reçu ou un suivi manqué.
- suivi_dossier : s'informe d'un dossier/travail déjà en cours.
- annulation : veut annuler ou reporter.
- fournisseur : un fournisseur légitime de l'entreprise appelle pour des opérations.
- spam : sollicitation commerciale non sollicitée (télémarketing, référencement, promotions).
- autre : rien de ce qui précède.

IMPORTANT — taxonomie de ce secteur (${script.name}) : pour une demande de service STANDARD (ni urgence, ni plainte, ni spam), l'intention par défaut de ce secteur est « ${script.primaryIntent} ». Ne t'en écarte que si le transcript indique clairement autre chose (ex. plainte, urgence, annulation).

DÉFINITIONS D'URGENCE (priorité métier, pas le ton de l'appelant) :
- critique : risque immédiat pour les personnes ou les biens (dégât d'eau actif, plus de chauffage en hiver, enflure/douleur aiguë qui empire).
- haute : à traiter le jour même (plainte avec menace de départ, panne bloquante sans danger, échéance ferme aujourd'hui/demain).
- normale : demande standard à planifier — même si l'appelant se dit pressé ou demande « le plus vite possible », un besoin routinier reste « normale ».
- basse : RÉSERVÉ au spam/sollicitation. Un client réel n'est jamais « basse », même s'il n'est pas pressé.

AUTRES RÈGLES :
- leadQuality : chaud = besoin réel + coordonnées + horizon court ; tiede = intérêt réel mais horizon flou ou magasinage ; froid = comparaison pure / plainte ; non_qualifie = spam ou indéterminé.
- valueTier pour ce secteur (${script.name}) : haut = urgence ou gros projet ; moyen = demande standard complète ; bas = petite demande ou magasinage ; nul = spam.
- collectedFields : extrais uniquement ce qui est dit, clés possibles : ${fieldKeys}. N'invente JAMAIS une valeur.
- transferReason : seulement si l'appel a été transféré à un humain, sinon null.
- summary : factuel, en français, utile pour un propriétaire de PME pressé.
- Si l'appelant parle anglais, analyse quand même ; le résumé reste en français.`;
}

function userPrompt(call: Call, script: IndustryScript): string {
  const lines = call.transcript
    .map((t) => `${t.speaker === "agent" ? "AGENTE" : "APPELANT"}${t.lang === "en" ? " (EN)" : ""}: ${t.text}`)
    .join("\n");
  return `Secteur de l'entreprise : ${script.name}
Statut technique de l'appel : ${call.status}${call.status === "transferred" ? " (transféré à un humain en cours d'appel)" : ""}
Durée : ${call.durationSec} s

TRANSCRIPT :
${lines}`;
}

function pick<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function clamp01(n: number): number {
  return Math.round(Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0.5)) * 100) / 100;
}

async function callOpenAi(system: string, user: string): Promise<LlmRawAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new LlmNotConfiguredError();
  const model = process.env.SCALY_LLM_MODEL ?? "gpt-4o-mini";

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "call_intelligence", strict: true, schema: RESPONSE_SCHEMA },
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        const retriable = res.status === 429 || res.status >= 500;
        const err = new Error(`OpenAI ${res.status} : ${body.slice(0, 300)}`);
        if (!retriable) throw err;
        lastError = err;
      } else {
        const data = (await res.json()) as { choices: { message: { content: string } }[] };
        return JSON.parse(data.choices[0].message.content) as LlmRawAnalysis;
      }
    } catch (err) {
      if (err instanceof LlmNotConfiguredError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;
      // Erreurs non-retriables (4xx hors 429) : on sort tout de suite.
      if (/OpenAI 4(?!29)/.test(msg)) throw lastError;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  throw lastError ?? new Error("Échec OpenAI après 3 tentatives");
}

export class LlmIntelligenceEngine {
  readonly name = "llm" as const;

  /** Vrai si le moteur peut être appelé (clé présente). */
  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async analyze(call: Call, script: IndustryScript, hints: AnalysisHints = {}): Promise<CallIntelligence> {
    // Transcript vide : rien à comprendre — rules-v1 suffit et l'étiquette reste honnête.
    if (call.transcript.length === 0) return intelligenceEngine.analyze(call, script, hints);

    const raw = await callOpenAi(systemPrompt(script), userPrompt(call, script));

    const intent = pick(raw.intent, INTENTS, "autre");
    const urgency = pick(raw.urgency, URGENCIES, "normale");
    const sentiment = pick(raw.sentiment, SENTIMENTS, "neutre");
    const leadQuality = pick(raw.leadQuality, LEAD_QUALITIES, "non_qualifie");
    const nextAction = pick(raw.nextAction, NEXT_ACTIONS, "creer_suivi");
    const finalStatus = call.status === "transferred" ? "transfere" : pick(raw.finalStatus, FINAL_STATUSES, "suivi_requis");
    const valueTier: ValueTier = intent === "spam" ? "nul" : pick(raw.valueTier, VALUE_TIERS, "bas");

    const mentioned =
      typeof raw.mentionedAmountCad === "number" && raw.mentionedAmountCad >= 100 && raw.mentionedAmountCad <= 10_000_000
        ? Math.round(raw.mentionedAmountCad)
        : null;
    const estimatedValueCad = intent === "spam" ? 0 : mentioned ?? estimateValueCad(valueTier, script.valueBaselineCad);
    const valueBasis: CallIntelligence["valueBasis"] = intent === "spam" || estimatedValueCad === 0 ? "aucun" : mentioned ? "montant_mentionne" : "bareme_industrie";

    const collectedFields: Record<string, string> = {};
    const allowedKeys = new Set<string>(script.questions.map((q) => q.fieldKey));
    for (const f of raw.collectedFields ?? []) {
      if (f.key && f.value && allowedKeys.has(f.key)) collectedFields[f.key] = f.value.slice(0, 200);
    }
    const requiredKeys = script.questions.filter((q) => q.required).map((q) => q.fieldKey);
    const fieldsCollected = requiredKeys.filter((k) => collectedFields[k]).length;

    const tags = [...new Set((raw.tags ?? []).map((t) => String(t).toLowerCase().trim()).filter(Boolean))].slice(0, 8);

    return {
      engine: this.name,
      summary: (raw.summary || "Analyse indisponible.").slice(0, 600),
      intent,
      intentConfidence: clamp01(raw.intentConfidence),
      sentiment,
      urgency,
      leadQuality,
      estimatedValueCad,
      valueBasis,
      nextAction,
      transferReason:
        call.status === "transferred" ? (raw.transferReason ?? hints.transferReason ?? "Demande de l'appelant").slice(0, 200) : undefined,
      tags,
      commercialScore: computeCommercialScore({
        urgency,
        leadQuality,
        sentiment,
        fieldsCollected,
        fieldsRequired: requiredKeys.length,
        estimatedValueCad,
        valueBaselineCad: script.valueBaselineCad,
      }),
      confidence: clamp01(raw.confidence),
      finalStatus,
      collectedFields,
      saved: hints.savedReason ? { reason: hints.savedReason } : undefined,
    };
  }
}

export const llmIntelligenceEngine = new LlmIntelligenceEngine();
