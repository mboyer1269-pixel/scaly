/**
 * Service — Agent Runtime Plan (Agent Operating Backend v1, ADR-021).
 *
 * resolveAgentRuntimePlan(agentDefinition, company) répond, sans complaisance,
 * à LA question de plateforme : « cet agent est-il prêt à opérer pour cette
 * compagnie ? » — capabilities activées, contexte requis, événements émis,
 * configuration manquante, score de préparation.
 *
 * Fonction PURE (même contrat qu'evaluatePilotReadiness, ADR-019) : aucune IO,
 * aucun process.env. Les faits d'environnement (Twilio, OpenAI) sont passés
 * par l'appelant ; absents = « non vérifié », jamais « ça va marcher ».
 */
import type { Company } from "@/domain/company";
import type { AgentDefinition, RuntimeAdapterId } from "@/domain/agent-definition";
import type { CapabilityId } from "@/domain/capability";
import type { RuntimeEventType } from "@/domain/runtime-event";
import { RUNTIME_EVENT_TYPES } from "@/domain/runtime-event";
import { requireCapability, packSupportsCapability } from "@/data/capabilities";
import { getIndustryPack } from "@/data/industry-packs";

export type PlanCheckStatus = "pass" | "warn" | "fail";

export interface PlanCheck {
  id: string;
  label: string;
  status: PlanCheckStatus;
  detail: string;
  /** true si ce check empêche l'agent d'opérer ICI ET MAINTENANT. */
  blocking?: boolean;
}

/** Faits d'environnement fournis par l'appelant — jamais lus ici. */
export interface AgentEnvFacts {
  twilioCredentialsConfigured?: boolean;
  openaiConfigured?: boolean;
  realtimeBridgeConfigured?: boolean;
}

export interface CapabilityPlanItem {
  capabilityId: CapabilityId;
  displayName: string;
  enabled: boolean;
  /** Pourquoi activée/désactivée — la phrase qu'on peut dire au client. */
  reason: string;
  requiredData: string[];
  runtimeEvents: RuntimeEventType[];
}

export type PlanVerdict = "operational" | "degraded" | "not_ready";

export interface AgentRuntimePlan {
  agentId: string;
  agentName: string;
  companyId: string;
  companyName: string;
  capabilities: CapabilityPlanItem[];
  enabledCapabilities: CapabilityId[];
  /** Besoins de contexte déclarés par l'agent (ids de contextNeeds). */
  requiredContext: string[];
  /** RuntimeEvents que cet agent émettra réellement (adapters + capabilities activées). */
  emittedEvents: RuntimeEventType[];
  /** Configuration concrète à poser pour monter le score. */
  missingConfiguration: string[];
  checks: PlanCheck[];
  /** 0–100 : pass=1, warn=0,5, fail=0 — arrondi. */
  readinessScore: number;
  verdict: PlanVerdict;
}

/** Événements de frontière émis par chaque adapter runtime, indépendamment des capabilities. */
const ADAPTER_EVENTS: Record<RuntimeAdapterId, RuntimeEventType[]> = {
  twilio_voice_realtime: ["call.session_started", "call.completed", "runtime.failure"],
  twilio_voice_relay: ["call.session_started", "call.completed"],
  twilio_voice_dial_fallback: ["runtime.realtime_unavailable", "call.transferred", "runtime.failure"],
  twilio_sms: ["sms.opt_out_received"],
  web_simulator: [],
};

const EVENT_ORDER = new Map(RUNTIME_EVENT_TYPES.map((t, i) => [t, i]));

function scoreOf(checks: PlanCheck[]): number {
  if (checks.length === 0) return 0;
  const points = checks.reduce((sum, c) => sum + (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0);
  return Math.round((points / checks.length) * 100);
}

export function resolveAgentRuntimePlan(
  def: AgentDefinition,
  company: Company,
  facts: AgentEnvFacts = {},
): AgentRuntimePlan {
  const checks: PlanCheck[] = [];
  const missing: string[] = [];
  // Même résolution que le moteur gap-recovery : repli PME générale assumé.
  const pack = getIndustryPack(company.industry);

  const hasTwilioNumber = Boolean(company.twilioPhoneNumber?.trim());
  const hasTransfer = Boolean(company.transferPhone?.trim());
  const hasOwnerPhone = Boolean((company.mainPhone ?? company.transferPhone)?.trim());

  // ── Canaux ────────────────────────────────────────────────────────────────
  if (def.channels.includes("voice") || def.channels.includes("sms")) {
    if (hasTwilioNumber) {
      checks.push({
        id: "channel_twilio_number",
        label: "Numéro Twilio du tenant",
        status: "pass",
        detail: `Numéro entrant assigné (${company.twilioPhoneNumber}) — routage voix/SMS multi-tenant possible.`,
      });
    } else {
      missing.push("Company.twilioPhoneNumber");
      checks.push({
        id: "channel_twilio_number",
        label: "Numéro Twilio du tenant",
        status: "fail",
        blocking: true,
        detail: "Aucun numéro Twilio assigné — ni voix ni SMS ne peuvent être routés vers ce tenant (ADR-017).",
      });
    }

    if (facts.twilioCredentialsConfigured === true) {
      checks.push({ id: "env_twilio", label: "Identifiants Twilio", status: "pass", detail: "TWILIO_AUTH_TOKEN présent — signatures de webhook vérifiables." });
    } else if (facts.twilioCredentialsConfigured === false) {
      missing.push("TWILIO_AUTH_TOKEN");
      checks.push({ id: "env_twilio", label: "Identifiants Twilio", status: "fail", detail: "Identifiants Twilio absents — aucun SMS ne peut partir, webhooks non signés." });
    } else {
      checks.push({ id: "env_twilio", label: "Identifiants Twilio", status: "warn", detail: "Non vérifié dans ce contexte — lancer npm run pilot:check pour le verdict environnement." });
    }
  }

  if (def.channels.includes("voice")) {
    if (facts.realtimeBridgeConfigured === true && facts.openaiConfigured === true) {
      checks.push({ id: "voice_brain", label: "Voix IA temps réel", status: "pass", detail: "Pont realtime + OPENAI_API_KEY configurés." });
    } else if (facts.realtimeBridgeConfigured === false) {
      checks.push({
        id: "voice_brain",
        label: "Voix IA temps réel",
        status: "warn",
        detail: "Pont realtime non configuré — repli <Dial> assumé : l'appel aboutit à un humain, pas à l'IA.",
      });
    } else {
      checks.push({ id: "voice_brain", label: "Voix IA temps réel", status: "warn", detail: "Non vérifié dans ce contexte (SCALY_REALTIME_WS_URL / OPENAI_API_KEY)." });
    }
  }

  // ── Capabilities ──────────────────────────────────────────────────────────
  const items: CapabilityPlanItem[] = def.capabilities.map((capabilityId) => {
    const cap = requireCapability(capabilityId); // capability inconnue → échec PROPRE
    let enabled = true;
    let reason = "Moteur livré, configuration présente.";
    let status: PlanCheckStatus = "pass";
    let blocking = false;

    switch (capabilityId) {
      case "appointment_gap_recovery": {
        if (!packSupportsCapability(pack, capabilityId)) {
          enabled = false;
          status = "warn";
          reason = `Le pack métier « ${pack?.name ?? company.industry} » n'active pas cette capability — repli follow-up humain.`;
        } else if (!hasTwilioNumber) {
          enabled = false;
          status = "fail";
          reason = "Pas de numéro Twilio : les offres de relance ne peuvent pas partir.";
        } else {
          reason = "Pack métier compatible, consent gate ADR-018 appliqué à l'envoi.";
        }
        break;
      }
      case "owner_notification": {
        if (!hasOwnerPhone) {
          enabled = false;
          status = "fail";
          reason = "Aucun numéro propriétaire (mainPhone/transferPhone) — le pouls texto n'a pas de destinataire.";
          missing.push("Company.mainPhone");
        } else {
          reason = "Destinataire configuré, claim anti-doublon actif.";
        }
        break;
      }
      case "human_handoff": {
        if (!hasTransfer) {
          enabled = false;
          status = "fail";
          blocking = true;
          reason = "transferPhone absent — AUCUN repli humain possible, même en panne du pont temps réel.";
          missing.push("Company.transferPhone");
        } else {
          reason = `Transfert vers ${company.transferPhone} — sert aussi de repli <Dial>.`;
        }
        break;
      }
      case "missed_call_rescue": {
        if (!hasTwilioNumber) {
          enabled = false;
          status = "fail";
          reason = "Pas de numéro Twilio : aucun SMS de sauvetage ne peut partir.";
        } else if (!company.followUp.missedCallAutoSms) {
          status = "warn";
          reason = "Moteur prêt mais missedCallAutoSms désactivé dans les préférences — file visible, envoi automatique éteint.";
        } else {
          reason = "SMS de sauvetage automatique actif (ADR-015 palier 1 — réponse à la demande, pas de sollicitation).";
        }
        break;
      }
      case "quote_follow_up": {
        if (!hasTwilioNumber) {
          enabled = false;
          status = "fail";
          reason = "Pas de numéro Twilio : le suivi J+2 ne peut pas être livré.";
        } else {
          reason = "Barrière de conformité active : relance UNIQUEMENT si consentement capté en appel (ADR-015 palier 2).";
        }
        break;
      }
      case "roi_reporting": {
        reason = "Calcul pur sur les appels réels — montants au barème d'industrie, affichés comme estimations (ADR-010).";
        break;
      }
      case "opportunity_detection": {
        reason = "File priorisée dérivée des appels et des boucles en place — valeurs estimées, jamais promises.";
        break;
      }
      case "consent_capture": {
        reason = "Capté verbatim en appel, coffre par personne, STOP révoque tout (ADR-018).";
        break;
      }
    }

    checks.push({ id: `capability_${capabilityId}`, label: cap.displayName, status, detail: reason, ...(blocking ? { blocking } : {}) });
    return { capabilityId, displayName: cap.displayName, enabled, reason, requiredData: cap.requiredData, runtimeEvents: cap.runtimeEvents };
  });

  // ── Événements émis : adapters + capabilities activées, dédupliqués ──────
  const events = new Set<RuntimeEventType>();
  for (const adapter of def.runtimeAdapters) for (const e of ADAPTER_EVENTS[adapter]) events.add(e);
  for (const item of items) if (item.enabled) for (const e of item.runtimeEvents) events.add(e);
  const emittedEvents = [...events].sort((a, b) => (EVENT_ORDER.get(a) ?? 99) - (EVENT_ORDER.get(b) ?? 99));

  const readinessScore = scoreOf(checks);
  const hasBlockingFail = checks.some((c) => c.status === "fail" && c.blocking);
  const hasIssue = checks.some((c) => c.status !== "pass");
  const verdict: PlanVerdict = hasBlockingFail ? "not_ready" : hasIssue ? "degraded" : "operational";

  return {
    agentId: def.id,
    agentName: def.name,
    companyId: company.id,
    companyName: company.name,
    capabilities: items,
    enabledCapabilities: items.filter((i) => i.enabled).map((i) => i.capabilityId),
    requiredContext: def.contextNeeds.map((n) => n.id),
    emittedEvents,
    missingConfiguration: [...new Set(missing)],
    checks,
    readinessScore,
    verdict,
  };
}
