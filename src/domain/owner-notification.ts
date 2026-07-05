/**
 * Domaine — Notification propriétaire (Phase 4).
 *
 * Transforme un appel, un refus propre du Cerveau d'entreprise, une inconnue,
 * une urgence ou une escalade en une action owner-facing structurée. Le domaine
 * ne connaît AUCUN provider (SMS/email) : la livraison réelle passe par un port
 * injectable côté service.
 */
import type { Urgency } from "./call";

export type OwnerNotificationType =
  | "post_call_summary"
  | "unknown_answer"
  | "escalation"
  | "follow_up_needed"
  | "gap_filled";

export type OwnerNotificationStatus = "pending" | "sent" | "failed" | "dismissed";

export interface OwnerNotification {
  id: string;
  companyId: string;
  type: OwnerNotificationType;
  status: OwnerNotificationStatus;
  /** Titre court owner-facing (ex. « Maude a besoin d'une décision »). */
  title: string;
  /** Résumé court, sans données sensibles superflues. */
  summary: string;
  /** Prochaine action recommandée au propriétaire. */
  recommendedAction: string;
  urgency: Urgency;
  /** Appel source, si la notification vient d'un appel inspectable. */
  sourceCallId?: string;
  /** Trace modèle source, si disponible. */
  sourceTraceId?: string;
  /** Coût IA estimé (CAD), présent seulement si un ModelUsage l'a fourni. */
  modelCostEstimateCad?: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  dismissedAt?: string;
  /** Horodatage de réservation pour livraison (verrou anti double-envoi, repris si périmé). */
  deliveryClaimedAt?: string;
  /** Identifiant retourné par le provider de livraison (ex. SID Twilio), si envoyé. */
  providerMessageId?: string;
  /** Raison d'échec de livraison, si le port a échoué. Jamais un secret. */
  failureReason?: string;
}
