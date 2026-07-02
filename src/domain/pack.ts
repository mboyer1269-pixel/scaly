/**
 * Domaine — Industry Packs (profils métiers)
 *
 * Un pack est la COUCHE DE POSITIONNEMENT vertical au-dessus d'un IndustryScript :
 * le script dit COMMENT qualifier un appel (questions, urgences, transferts) ;
 * le pack dit CE QUE le métier attend de Maude (intentions fréquentes, rôles
 * d'équipe, routage par département, prudence, exemples, add-ons).
 *
 * Règles de conception :
 *  - 100 % données sérialisables JSON — migration triviale vers fichiers ou DB.
 *  - Jamais de crash sur industrie inconnue : repli sur le pack PME générale.
 *  - Les add-ons sont déclarés honnêtement (inclus / add_on / a_venir) — pas de
 *    promesse d'une fonctionnalité qui n'existe pas.
 */
import type { Industry } from "./company";
import type { Intent } from "./call";
import type { CapabilityId } from "./capability";

/** Intention d'appel fréquente pour ce métier, avec un exemple entendu au téléphone. */
export interface PackCallIntent {
  intent: Intent;
  label: string;
  example: string;
}

/** Route de transfert recommandée vers un département ou un rôle. */
export interface PackTransferRoute {
  department: string;
  /** Indices verbaux qui pointent vers ce département. */
  triggers: string[];
  description: string;
}

/** Exemple de réponse Maude (matériel de démo et de calibration du prompt). */
export interface PackSampleExchange {
  caller: string;
  maude: string;
}

export type PackAddOnStatus = "inclus" | "add_on" | "a_venir";

export interface PackAddOn {
  id: string;
  name: string;
  description: string;
  status: PackAddOnStatus;
}

/**
 * Mode relance annulation : quand un rendez-vous s'annule, la plage libérée est
 * offerte aux clients inscrits à la liste de relance (appel ou SMS, selon leur
 * consentement capté VERBATIM — ADR-018). Deux faces d'une même pièce :
 *  - l'appelant qui annule → on propose d'abord de replacer, sinon on note la plage ;
 *  - l'appelant qui veut plus tôt → on lui offre l'inscription à la liste.
 */
export interface CancellationRescuePolicy {
  enabled: boolean;
  /** Toujours proposer de déplacer le RDV avant d'acter l'annulation. */
  offerReschedule: boolean;
  /** Proposer l'inscription à la liste de relance (rappel/SMS si une place se libère). */
  offerRecallList: boolean;
  /** Gabarit SMS quand une place se libère. {name}, {company}, {slot} interpolés. Doit offrir STOP. */
  freedSlotSmsTemplate: string;
  /** Règles conversationnelles injectées dans le prompt temps réel. */
  promptRules: string[];
}

/**
 * Source de connaissance branchable (abstraction FUTURE — déclarée, pas implémentée) :
 * site web, CSV, inventaire, FAQ, documents. Un pack déclare ce qui aurait de la
 * valeur pour le métier ; le branchement réel viendra avec les add-ons.
 */
export type KnowledgeSourceKind = "website" | "csv" | "inventory" | "faq" | "documents";

export interface KnowledgeSourceRef {
  kind: KnowledgeSourceKind;
  label: string;
  status: "a_venir";
}

/**
 * Catégorie de service du métier — taxonomie GÉNÉRIQUE utilisée par les
 * capabilities (ex. matcher une plage libérée « nettoyage » avec les candidats
 * qui attendent un nettoyage). L'id est stable et neutre ; le label est FR client.
 */
export interface PackServiceCategory {
  id: string;
  label: string;
}

export interface IndustryPack {
  id: string;
  industry: Industry;
  /** Script de qualification opérationnel du pack (questions, urgences, transferts). */
  scriptId: string;
  name: string;
  shortDescription: string;
  frequentIntents: PackCallIntent[];
  /** Rôles typiques d'équipe dans ce métier (routage et matériel de vente). */
  teamRoles: string[];
  transferRouting: PackTransferRoute[];
  /** Phrases de prudence quand l'information doit être confirmée par un humain. */
  cautionPhrases: string[];
  sampleAnswers: PackSampleExchange[];
  addOns: PackAddOn[];
  cancellation: CancellationRescuePolicy;
  knowledgeSources: KnowledgeSourceRef[];
  /**
   * Capabilities produit ACTIVÉES pour ce métier. Le pack déclare le contexte,
   * le moteur (src/services) exécute — jamais de logique métier ici.
   */
  capabilities: CapabilityId[];
  /** Taxonomie des services du métier — consommée par les capabilities. */
  serviceCategories: PackServiceCategory[];
}
