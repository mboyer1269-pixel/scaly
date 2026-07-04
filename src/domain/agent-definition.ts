/**
 * Domaine — Agent Definition Contract (Agent Operating Backend v1, ADR-021).
 *
 * Un agent n'est PAS un paquet de code dispersé : c'est un CONTRAT déclaratif
 * que le backend sait résoudre, opérer et mesurer. Allô Maude est le premier
 * agent exprimé par ce contrat ; les suivants naîtront d'un prompt qui produit
 * la même structure (voir src/services/agent-draft.ts).
 *
 * Invariants (testés dans tests/agent-os.test.ts) :
 *  - chaque capability déclarée DOIT exister au registre (CapabilityUnknownError sinon) ;
 *  - chaque métrique ROI porte sa méthode de calcul et sa base — jamais magique ;
 *  - chaque cible d'action est tracée (audit ou RuntimeEvent) — pas d'action fantôme ;
 *  - l'agent référence explicitement ses ports backend (ContextPackProvider,
 *    ActionLedgerPort, RuntimeEvent outbox) — pas de prompt sans contrat backend.
 *
 * 100 % déclaratif, JSON-sérialisable : la migration vers une table Prisma
 * `AgentDefinition` est triviale le jour où les agents se créent en self-serve.
 */
import type { Industry } from "./company";
import type { CapabilityId } from "./capability";

/** Canaux par lesquels l'agent parle au monde. */
export type AgentChannel = "voice" | "sms" | "web" | "email";

/**
 * Adaptateurs runtime RÉELS du dépôt — pas des promesses. Chacun correspond à
 * du code livré : pont OpenAI Realtime, prototype ConversationRelay, repli
 * <Dial>, actions SMS Twilio, simulateur web (/simulator + /voice-lab).
 */
export type RuntimeAdapterId =
  | "twilio_voice_realtime"
  | "twilio_voice_relay"
  | "twilio_voice_dial_fallback"
  | "twilio_sms"
  | "web_simulator";

/** Qui possédera cette donnée quand l'écosystème sera complet (ADR-020). */
export type EcosystemOwner = "scaly" | "oria" | "memex";

/** Un besoin de contexte : ce que l'agent doit SAVOIR avant de parler. */
export interface AgentContextNeed {
  id: string;
  description: string;
  /** Qui le fournit AUJOURD'HUI — honnêteté sur la source réelle. */
  providedBy: "context_pack_provider" | "local_store" | "industry_pack";
  /** Propriétaire cible dans l'écosystème (frontière ADR-020). */
  futureOwner: EcosystemOwner;
}

/** Une cible d'action : ce que l'agent peut FAIRE dans le monde réel. */
export interface AgentActionTarget {
  id: string;
  description: string;
  executedBy: "twilio_sms" | "twilio_voice" | "internal_queue";
  /**
   * Traçabilité obligatoire : événements d'audit et/ou RuntimeEvents qui
   * prouvent que l'action a eu lieu. Vide = action fantôme = interdit.
   */
  tracedBy: string[];
}

export type RoiMetricBasis = "measured" | "estimated_baseline";

/** Une métrique ROI EXPLICITE : id, méthode de calcul, base — jamais magique. */
export interface AgentRoiMetric {
  id: string;
  label: string;
  unit: "cad" | "count" | "ratio";
  /** COMMENT le chiffre est produit — la phrase qu'on peut dire à un client. */
  method: string;
  /** `measured` = compté sur des faits ; `estimated_baseline` = barème ADR-010. */
  basis: RoiMetricBasis;
}

/**
 * Les trois ports backend que TOUT agent référence (ADR-020) : c'est ce qui
 * distingue un agent opéré d'un prompt isolé. Les valeurs sont les noms des
 * contrats de src/services/ports.ts et src/services/event-outbox.ts.
 */
export interface AgentBackendBindings {
  contextPack: "ContextPackProvider";
  actionLedger: "ActionLedgerPort";
  eventOutbox: "RuntimeEventOutbox";
}

/** Verticale de l'agent : un métier précis, ou multi-vertical via les packs. */
export type AgentVertical = Industry | "multi";

export interface AgentDefinition {
  id: string;
  name: string;
  vertical: AgentVertical;
  /** Personnalité en une phrase — le détail vit dans VoiceAgentConfig par tenant. */
  persona: string;
  channels: AgentChannel[];
  capabilities: CapabilityId[];
  contextNeeds: AgentContextNeed[];
  actionTargets: AgentActionTarget[];
  roiMetrics: AgentRoiMetric[];
  /** Règles NON négociables, fusionnées avec celles des capabilities à l'exécution. */
  safetyRules: string[];
  runtimeAdapters: RuntimeAdapterId[];
  backendBindings: AgentBackendBindings;
  /** `live` = opéré en production ; `draft` = généré, jamais exécuté. */
  status: "live" | "draft";
}

/** Échec propre : la définition d'agent viole un invariant du contrat. */
export class AgentDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentDefinitionError";
  }
}

/** Les bindings canoniques — un agent sans ces trois ports n'est pas un agent. */
export const REQUIRED_BACKEND_BINDINGS: AgentBackendBindings = {
  contextPack: "ContextPackProvider",
  actionLedger: "ActionLedgerPort",
  eventOutbox: "RuntimeEventOutbox",
};
