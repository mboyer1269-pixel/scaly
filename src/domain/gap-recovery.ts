/**
 * Domaine — Remplissage intelligent des annulations (appointment_gap_recovery).
 *
 * Trois objets persistés, VOLONTAIREMENT génériques (aucun champ dentaire,
 * auto ou clinique — le contexte métier vit dans les packs) :
 *  - WaitlistEntry   : « appelez-moi si une place se libère », capté en appel ;
 *  - AppointmentGap  : une plage libérée, sans calendrier complet ;
 *  - RecoveryOffer   : la relance prudente qui relie les deux.
 *
 * Invariants durs :
 *  - companyId OBLIGATOIRE partout — aucune donnée sans tenant ;
 *  - une annulation est PERSISTÉE (cancelledAt + cancelReason) et idempotente ;
 *  - une entité annulée bloque toute livraison future ;
 *  - l'offre porte une idempotencyKey stable (gap + entrée) — jamais de doublon.
 */
import type { Urgency } from "./call";
import type { CapabilityId } from "./capability";

export const GAP_RECOVERY_CAPABILITY: CapabilityId = "appointment_gap_recovery";

/** Consentement SMS tel que CONNU au moment de la capture — jamais inventé. */
export type SmsConsentState = "yes" | "no" | "unknown";

export type WaitlistChannelPreference = "sms" | "call" | "unknown";

export type WaitlistEntryStatus = "active" | "contacted" | "confirmed" | "cancelled" | "expired";

export interface WaitlistEntry {
  id: string;
  companyId: string;
  industryPackId?: string;
  capabilityId: CapabilityId;
  callerName?: string;
  phone: string;
  sourceCallId?: string;
  desiredServiceCategory?: string;
  desiredServiceLabel?: string;
  preferredTimeWindow?: string;
  urgency?: Urgency;
  channelPreference: WaitlistChannelPreference;
  consentToSms: SmsConsentState;
  status: WaitlistEntryStatus;
  /** Note courte (evidence de l'intention captée) — jamais le transcript complet. */
  notes?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export type AppointmentGapSource = "manual" | "system" | "call";

export type AppointmentGapStatus = "open" | "offered" | "filled" | "cancelled" | "expired";

export interface AppointmentGap {
  id: string;
  companyId: string;
  industryPackId?: string;
  capabilityId: CapabilityId;
  serviceCategory?: string;
  serviceLabel?: string;
  startsAt?: string;
  endsAt?: string;
  /** Libellé humain OBLIGATOIRE (« jeudi 14 h ») — la plage doit rester lisible sans calendrier. */
  humanLabel: string;
  source: AppointmentGapSource;
  status: AppointmentGapStatus;
  /** Clé stable optionnelle : rouvrir la même plage ne crée ni doublon ni nouvelles offres. */
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export type RecoveryOfferChannel = "sms" | "call" | "action_only";

export type RecoveryOfferStatus =
  | "prepared"
  | "sent"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "expired"
  | "failed";

export interface RecoveryOffer {
  id: string;
  companyId: string;
  gapId: string;
  waitlistEntryId: string;
  channel: RecoveryOfferChannel;
  status: RecoveryOfferStatus;
  /** Message EXACT qui partirait — visible avant tout envoi (préparé ≠ envoyé). */
  messagePreview: string;
  deliveryId?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

/** Clé d'idempotence CANONIQUE d'une offre : une seule offre par (plage, entrée). */
export function offerIdempotencyKey(gapId: string, waitlistEntryId: string): string {
  return `offer_${gapId}_${waitlistEntryId}`;
}
