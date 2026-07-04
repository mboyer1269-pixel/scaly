/**
 * Registre des AgentDefinitions (Agent Operating Backend v1, ADR-021).
 *
 * Allô Maude est le PREMIER agent exprimé par le contrat — plus un paquet de
 * logique dispersée. Ajouter un agent = ajouter UNE définition validée ici ;
 * le backend (capabilities, ports, outbox, plan runtime) fait le reste.
 *
 * Chaque définition passe validateAgentDefinition() au chargement du module :
 * une capability inconnue ou une métrique ROI sans méthode fait échouer le
 * build des tests, pas la démo devant le client.
 */
import { DEFAULT_SAFETY_RULES } from "@/domain/agent";
import {
  AgentDefinitionError,
  REQUIRED_BACKEND_BINDINGS,
  type AgentDefinition,
  type AgentRoiMetric,
} from "@/domain/agent-definition";
import { requireCapability } from "@/data/capabilities";

/**
 * Valide le contrat d'un agent. Jette :
 *  - CapabilityUnknownError si une capability n'existe pas au registre ;
 *  - AgentDefinitionError pour tout autre invariant violé (ROI magique,
 *    action non tracée, ports backend absents, agent muet…).
 */
export function validateAgentDefinition(def: AgentDefinition): AgentDefinition {
  if (!def.id.trim() || !def.name.trim() || !def.persona.trim()) {
    throw new AgentDefinitionError(`Agent « ${def.id || "?"} » : id, name et persona sont obligatoires.`);
  }
  if (def.channels.length === 0) {
    throw new AgentDefinitionError(`Agent « ${def.id} » : au moins un canal requis — un agent muet n'opère rien.`);
  }
  if (def.runtimeAdapters.length === 0) {
    throw new AgentDefinitionError(`Agent « ${def.id} » : au moins un runtime adapter requis.`);
  }
  if (def.safetyRules.length === 0) {
    throw new AgentDefinitionError(`Agent « ${def.id} » : safetyRules vides — interdit par le contrat.`);
  }
  // Capability inconnue → CapabilityUnknownError (échec PROPRE, jamais silencieux).
  for (const capabilityId of def.capabilities) requireCapability(capabilityId);
  for (const metric of def.roiMetrics) {
    if (!metric.method.trim()) {
      throw new AgentDefinitionError(
        `Agent « ${def.id} » : métrique ROI « ${metric.id} » sans méthode de calcul — les chiffres magiques sont interdits.`,
      );
    }
    if (metric.basis !== "measured" && metric.basis !== "estimated_baseline") {
      throw new AgentDefinitionError(`Agent « ${def.id} » : métrique ROI « ${metric.id} » sans base explicite.`);
    }
  }
  for (const target of def.actionTargets) {
    if (target.tracedBy.length === 0) {
      throw new AgentDefinitionError(
        `Agent « ${def.id} » : cible d'action « ${target.id} » non tracée — les actions fantômes sont interdites.`,
      );
    }
  }
  const b = def.backendBindings;
  if (
    b.contextPack !== REQUIRED_BACKEND_BINDINGS.contextPack ||
    b.actionLedger !== REQUIRED_BACKEND_BINDINGS.actionLedger ||
    b.eventOutbox !== REQUIRED_BACKEND_BINDINGS.eventOutbox
  ) {
    throw new AgentDefinitionError(`Agent « ${def.id} » : ports backend incomplets — pas de prompt sans contrat backend.`);
  }
  return def;
}

/** Métriques ROI de Maude — chacune dit COMMENT elle est calculée. */
const ALLO_MAUDE_ROI_METRICS: AgentRoiMetric[] = [
  {
    id: "protected_revenue_cad",
    label: "Valeur protégée",
    unit: "cad",
    method: "Somme des appels sauvés × barème d'industrie (valueBaselineCad), plus les montants déclarés en appel.",
    basis: "estimated_baseline",
  },
  {
    id: "rescued_calls_count",
    label: "Appels sauvés",
    unit: "count",
    method: "Nombre d'appels manqués/abandonnés ayant reçu un SMS de sauvetage (statuts pending→succeeded).",
    basis: "measured",
  },
  {
    id: "filled_gaps_count",
    label: "Plages comblées",
    unit: "count",
    method: "Nombre d'AppointmentGap passées au statut filled (première réponse OUI remporte la plage).",
    basis: "measured",
  },
  {
    id: "recovered_gap_value_cad",
    label: "Valeur des plages récupérées",
    unit: "cad",
    method: "Plages comblées × barème d'industrie — hypothèse interne affichée comme telle (ADR-010).",
    basis: "estimated_baseline",
  },
  {
    id: "consents_captured_count",
    label: "Consentements captés",
    unit: "count",
    method: "Nombre de ConsentRecord actifs au coffre (ADR-018), verbatim conservé, révocations décomptées.",
    basis: "measured",
  },
  {
    id: "estimated_margin_rate",
    label: "Marge estimée du service",
    unit: "ratio",
    method: "Valeur protégée moins coût IA estimé (minutes × tarif) sur la période — estimation produit, pas de la facturation.",
    basis: "estimated_baseline",
  },
];

/**
 * Allô Maude — réceptionniste vocale IA pour PME QC/ON, exprimée comme
 * AgentDefinition. Tout ce qui est déclaré ici correspond à du code livré :
 * les capabilities au registre, les adapters au dépôt, les événements à
 * l'outbox ADR-020.
 */
export const ALLO_MAUDE_AGENT: AgentDefinition = validateAgentDefinition({
  id: "allo-maude",
  name: "Allô Maude",
  vertical: "multi",
  persona:
    "Réceptionniste vocale bilingue (FR-QC d'abord), chaleureuse et efficace : elle répond, qualifie, " +
    "rassure, capte les consentements et récupère les revenus qui fuient — sans jamais surpromettre.",
  channels: ["voice", "sms", "web"],
  capabilities: [
    "appointment_gap_recovery",
    "owner_notification",
    "opportunity_detection",
    "roi_reporting",
    "consent_capture",
    "human_handoff",
    "missed_call_rescue",
    "quote_follow_up",
  ],
  contextNeeds: [
    {
      id: "caller_memory",
      description: "Historique des appels de cette personne chez ce tenant (jamais inter-tenant).",
      providedBy: "context_pack_provider",
      futureOwner: "memex",
    },
    {
      id: "business_brain",
      description: "Savoir d'entreprise approuvé par le propriétaire (services, politiques, réponses).",
      providedBy: "local_store",
      futureOwner: "memex",
    },
    {
      id: "industry_pack",
      description: "Contexte vertical : intentions fréquentes, prudence, routage, taxonomie de services.",
      providedBy: "industry_pack",
      futureOwner: "scaly",
    },
    {
      id: "consent_registry",
      description: "Coffre de consentements par personne (ADR-018) — consulté à la milliseconde de l'envoi.",
      providedBy: "local_store",
      futureOwner: "oria",
    },
    {
      id: "company_config",
      description: "Configuration tenant : heures, ton, règles d'escalade, numéros, conformité.",
      providedBy: "local_store",
      futureOwner: "scaly",
    },
  ],
  actionTargets: [
    {
      id: "caller_sms",
      description: "SMS au client : sauvetage d'appel manqué, offre de plage, suivi J+2 consenti.",
      executedBy: "twilio_sms",
      tracedBy: ["recovery.offer_sent", "rescue.sms_sent", "follow_up.sent"],
    },
    {
      id: "owner_sms",
      description: "SMS au propriétaire : pouls texto sur les moments qui méritent une interruption.",
      executedBy: "twilio_sms",
      tracedBy: ["owner.notification_sent"],
    },
    {
      id: "call_transfer",
      description: "Transfert de l'appel vers l'humain (demande explicite, urgence, panne du pont).",
      executedBy: "twilio_voice",
      tracedBy: ["call.transferred"],
    },
    {
      id: "recovery_queue",
      description: "File interne : liste d'attente, plages libérées, opportunités priorisées.",
      executedBy: "internal_queue",
      tracedBy: ["recovery.gap_opened", "opportunity.detected"],
    },
  ],
  roiMetrics: ALLO_MAUDE_ROI_METRICS,
  safetyRules: [
    ...DEFAULT_SAFETY_RULES,
    "Jamais de SMS sortant sans consentement actif au coffre — STOP l'emporte sur tout (ADR-018).",
    "Jamais de donnée inter-tenant : companyId obligatoire sur chaque lecture et écriture (ADR-017).",
    "Chaque action laisse une trace auditable ; chaque moment métier franchit la frontière en RuntimeEvent (ADR-020).",
  ],
  runtimeAdapters: [
    "twilio_voice_realtime",
    "twilio_voice_relay",
    "twilio_voice_dial_fallback",
    "twilio_sms",
    "web_simulator",
  ],
  backendBindings: REQUIRED_BACKEND_BINDINGS,
  status: "live",
});

export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  [ALLO_MAUDE_AGENT.id]: ALLO_MAUDE_AGENT,
};

export function findAgentDefinition(id: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS[id];
}
