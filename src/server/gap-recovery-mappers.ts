/**
 * Mappers PURS row <-> domaine pour le remplissage intelligent des annulations.
 *
 * Aucun import Prisma : testables sans base ni client (mêmes conventions que
 * phase4-mappers) — DateTime -> ISO string, null -> undefined, unions castées
 * (les valeurs en base sont écrites exclusivement par le moteur, déjà validées).
 */
import type { AppointmentGap, RecoveryOffer, WaitlistEntry } from "@/domain/gap-recovery";

const iso = (d: Date): string => d.toISOString();
const isoOpt = (d: Date | null): string | undefined => (d ? d.toISOString() : undefined);
const dateOpt = (s?: string): Date | null => (s ? new Date(s) : null);
const strOpt = (s: string | null): string | undefined => s ?? undefined;

// --- WaitlistEntry -----------------------------------------------------------

export interface WaitlistEntryRow {
  id: string;
  companyId: string;
  industryPackId: string | null;
  capabilityId: string;
  callerName: string | null;
  phone: string;
  sourceCallId: string | null;
  desiredServiceCategory: string | null;
  desiredServiceLabel: string | null;
  preferredTimeWindow: string | null;
  urgency: string | null;
  channelPreference: string;
  consentToSms: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

export function waitlistEntryFromDb(row: WaitlistEntryRow): WaitlistEntry {
  return {
    id: row.id,
    companyId: row.companyId,
    industryPackId: strOpt(row.industryPackId),
    capabilityId: row.capabilityId as WaitlistEntry["capabilityId"],
    callerName: strOpt(row.callerName),
    phone: row.phone,
    sourceCallId: strOpt(row.sourceCallId),
    desiredServiceCategory: strOpt(row.desiredServiceCategory),
    desiredServiceLabel: strOpt(row.desiredServiceLabel),
    preferredTimeWindow: strOpt(row.preferredTimeWindow),
    urgency: (strOpt(row.urgency) as WaitlistEntry["urgency"]) ?? undefined,
    channelPreference: row.channelPreference as WaitlistEntry["channelPreference"],
    consentToSms: row.consentToSms as WaitlistEntry["consentToSms"],
    status: row.status as WaitlistEntry["status"],
    notes: strOpt(row.notes),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    cancelledAt: isoOpt(row.cancelledAt),
    cancelReason: strOpt(row.cancelReason),
  };
}

export function waitlistEntryToDb(entry: WaitlistEntry): WaitlistEntryRow {
  return {
    id: entry.id,
    companyId: entry.companyId,
    industryPackId: entry.industryPackId ?? null,
    capabilityId: entry.capabilityId,
    callerName: entry.callerName ?? null,
    phone: entry.phone,
    sourceCallId: entry.sourceCallId ?? null,
    desiredServiceCategory: entry.desiredServiceCategory ?? null,
    desiredServiceLabel: entry.desiredServiceLabel ?? null,
    preferredTimeWindow: entry.preferredTimeWindow ?? null,
    urgency: entry.urgency ?? null,
    channelPreference: entry.channelPreference,
    consentToSms: entry.consentToSms,
    status: entry.status,
    notes: entry.notes ?? null,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
    cancelledAt: dateOpt(entry.cancelledAt),
    cancelReason: entry.cancelReason ?? null,
  };
}

// --- AppointmentGap ----------------------------------------------------------

export interface AppointmentGapRow {
  id: string;
  companyId: string;
  industryPackId: string | null;
  capabilityId: string;
  serviceCategory: string | null;
  serviceLabel: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  humanLabel: string;
  source: string;
  status: string;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

export function appointmentGapFromDb(row: AppointmentGapRow): AppointmentGap {
  return {
    id: row.id,
    companyId: row.companyId,
    industryPackId: strOpt(row.industryPackId),
    capabilityId: row.capabilityId as AppointmentGap["capabilityId"],
    serviceCategory: strOpt(row.serviceCategory),
    serviceLabel: strOpt(row.serviceLabel),
    startsAt: isoOpt(row.startsAt),
    endsAt: isoOpt(row.endsAt),
    humanLabel: row.humanLabel,
    source: row.source as AppointmentGap["source"],
    status: row.status as AppointmentGap["status"],
    idempotencyKey: strOpt(row.idempotencyKey),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    cancelledAt: isoOpt(row.cancelledAt),
    cancelReason: strOpt(row.cancelReason),
  };
}

export function appointmentGapToDb(gap: AppointmentGap): AppointmentGapRow {
  return {
    id: gap.id,
    companyId: gap.companyId,
    industryPackId: gap.industryPackId ?? null,
    capabilityId: gap.capabilityId,
    serviceCategory: gap.serviceCategory ?? null,
    serviceLabel: gap.serviceLabel ?? null,
    startsAt: dateOpt(gap.startsAt),
    endsAt: dateOpt(gap.endsAt),
    humanLabel: gap.humanLabel,
    source: gap.source,
    status: gap.status,
    idempotencyKey: gap.idempotencyKey ?? null,
    createdAt: new Date(gap.createdAt),
    updatedAt: new Date(gap.updatedAt),
    cancelledAt: dateOpt(gap.cancelledAt),
    cancelReason: gap.cancelReason ?? null,
  };
}

// --- RecoveryOffer -----------------------------------------------------------

export interface RecoveryOfferRow {
  id: string;
  companyId: string;
  gapId: string;
  waitlistEntryId: string;
  channel: string;
  status: string;
  messagePreview: string;
  deliveryId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

export function recoveryOfferFromDb(row: RecoveryOfferRow): RecoveryOffer {
  return {
    id: row.id,
    companyId: row.companyId,
    gapId: row.gapId,
    waitlistEntryId: row.waitlistEntryId,
    channel: row.channel as RecoveryOffer["channel"],
    status: row.status as RecoveryOffer["status"],
    messagePreview: row.messagePreview,
    deliveryId: strOpt(row.deliveryId),
    idempotencyKey: row.idempotencyKey,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    sentAt: isoOpt(row.sentAt),
    confirmedAt: isoOpt(row.confirmedAt),
    cancelledAt: isoOpt(row.cancelledAt),
    cancelReason: strOpt(row.cancelReason),
  };
}

export function recoveryOfferToDb(offer: RecoveryOffer): RecoveryOfferRow {
  return {
    id: offer.id,
    companyId: offer.companyId,
    gapId: offer.gapId,
    waitlistEntryId: offer.waitlistEntryId,
    channel: offer.channel,
    status: offer.status,
    messagePreview: offer.messagePreview,
    deliveryId: offer.deliveryId ?? null,
    idempotencyKey: offer.idempotencyKey,
    createdAt: new Date(offer.createdAt),
    updatedAt: new Date(offer.updatedAt),
    sentAt: dateOpt(offer.sentAt),
    confirmedAt: dateOpt(offer.confirmedAt),
    cancelledAt: dateOpt(offer.cancelledAt),
    cancelReason: offer.cancelReason ?? null,
  };
}
