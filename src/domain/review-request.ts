/**
 * Domaine — Demande d'avis client (Phase 4).
 *
 * Transforme un appel RÉUSSI et POSITIF en preuve sociale mesurable. Distinct
 * de `ReviewItem` (corrections QA de /learn). Garde-fous : jamais de faux avis,
 * jamais de demande sur un appel urgent/escaladé/insatisfait/non résolu, lien
 * d'avis uniquement depuis la config approuvée, jamais inventé.
 */

export type ReviewRequestStatus = "eligible" | "drafted" | "sent" | "skipped" | "failed";

export type ReviewRequestReason =
  // Éligibles
  | "resolved_positive" // appel résolu + sentiment non négatif
  | "awaiting_review_url" // éligible mais aucun lien d'avis en config
  // Sautés (jamais de demande)
  | "call_urgent"
  | "call_escalated"
  | "call_unresolved"
  | "customer_dissatisfied"
  | "spam_or_supplier"
  | "no_consent"
  | "no_analysis"
  | "not_resolved"
  | "owner_skipped";

export interface ReviewRequest {
  id: string;
  companyId: string;
  status: ReviewRequestStatus;
  customerName?: string;
  customerPhone?: string;
  sourceCallId?: string;
  /** Code de décision (éligibilité ou raison du saut). */
  reason: ReviewRequestReason;
  /** Message sobre FR-CA prêt à envoyer (vide si sauté). */
  message: string;
  /** Lien d'avis approuvé, copié depuis la config. Jamais inventé. */
  reviewUrl?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  skippedAt?: string;
  /** Raison d'échec de livraison, jamais un secret. */
  failureReason?: string;
}
