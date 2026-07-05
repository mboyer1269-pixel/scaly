/**
 * Mappers PURS row <-> domaine pour les 3 moteurs Phase 4 persistés.
 *
 * Aucun import Prisma ici : ces fonctions sont testables sans base ni client.
 * Convention (comme prisma-store) : DateTime -> ISO string, null -> undefined,
 * et les unions de statut/type sont castées (les valeurs en base sont écrites
 * exclusivement par nos services, déjà validées).
 */
import type { BusinessKnowledgeItem } from "@/domain/business-brain";
import type { OwnerNotification } from "@/domain/owner-notification";
import type { ReviewRequest } from "@/domain/review-request";

const iso = (d: Date): string => d.toISOString();
const isoOpt = (d: Date | null): string | undefined => (d ? d.toISOString() : undefined);
const dateOpt = (s?: string): Date | null => (s ? new Date(s) : null);

// --- BusinessKnowledgeItem ---------------------------------------------------

export interface BusinessKnowledgeRow {
  id: string;
  companyId: string;
  title: string;
  content: string;
  sourceLabel: string;
  sourceType: string;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  expiresAt: Date | null;
}

export function businessKnowledgeFromDb(row: BusinessKnowledgeRow): BusinessKnowledgeItem {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    content: row.content,
    sourceLabel: row.sourceLabel,
    sourceType: row.sourceType as BusinessKnowledgeItem["sourceType"],
    status: row.status as BusinessKnowledgeItem["status"],
    createdAt: iso(row.createdAt),
    approvedAt: isoOpt(row.approvedAt),
    expiresAt: isoOpt(row.expiresAt),
  };
}

export function businessKnowledgeToDb(item: BusinessKnowledgeItem): BusinessKnowledgeRow {
  return {
    id: item.id,
    companyId: item.companyId,
    title: item.title,
    content: item.content,
    sourceLabel: item.sourceLabel,
    sourceType: item.sourceType,
    status: item.status,
    createdAt: new Date(item.createdAt),
    approvedAt: dateOpt(item.approvedAt),
    expiresAt: dateOpt(item.expiresAt),
  };
}

// --- OwnerNotification -------------------------------------------------------

export interface OwnerNotificationRow {
  id: string;
  companyId: string;
  type: string;
  status: string;
  title: string;
  summary: string;
  recommendedAction: string;
  urgency: string;
  sourceCallId: string | null;
  sourceTraceId: string | null;
  modelCostEstimateCad: number | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
  dismissedAt: Date | null;
  deliveryClaimedAt: Date | null;
  providerMessageId: string | null;
  failureReason: string | null;
}

export function ownerNotificationFromDb(row: OwnerNotificationRow): OwnerNotification {
  return {
    id: row.id,
    companyId: row.companyId,
    type: row.type as OwnerNotification["type"],
    status: row.status as OwnerNotification["status"],
    title: row.title,
    summary: row.summary,
    recommendedAction: row.recommendedAction,
    urgency: row.urgency as OwnerNotification["urgency"],
    sourceCallId: row.sourceCallId ?? undefined,
    sourceTraceId: row.sourceTraceId ?? undefined,
    modelCostEstimateCad: row.modelCostEstimateCad ?? undefined,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    sentAt: isoOpt(row.sentAt),
    dismissedAt: isoOpt(row.dismissedAt),
    deliveryClaimedAt: isoOpt(row.deliveryClaimedAt),
    providerMessageId: row.providerMessageId ?? undefined,
    failureReason: row.failureReason ?? undefined,
  };
}

export function ownerNotificationToDb(item: OwnerNotification): OwnerNotificationRow {
  return {
    id: item.id,
    companyId: item.companyId,
    type: item.type,
    status: item.status,
    title: item.title,
    summary: item.summary,
    recommendedAction: item.recommendedAction,
    urgency: item.urgency,
    sourceCallId: item.sourceCallId ?? null,
    sourceTraceId: item.sourceTraceId ?? null,
    modelCostEstimateCad: item.modelCostEstimateCad ?? null,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    sentAt: dateOpt(item.sentAt),
    dismissedAt: dateOpt(item.dismissedAt),
    deliveryClaimedAt: dateOpt(item.deliveryClaimedAt),
    providerMessageId: item.providerMessageId ?? null,
    failureReason: item.failureReason ?? null,
  };
}

// --- ReviewRequest -----------------------------------------------------------

export interface ReviewRequestRow {
  id: string;
  companyId: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  sourceCallId: string | null;
  reason: string;
  message: string;
  reviewUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
  skippedAt: Date | null;
  failureReason: string | null;
}

export function reviewRequestFromDb(row: ReviewRequestRow): ReviewRequest {
  return {
    id: row.id,
    companyId: row.companyId,
    status: row.status as ReviewRequest["status"],
    customerName: row.customerName ?? undefined,
    customerPhone: row.customerPhone ?? undefined,
    sourceCallId: row.sourceCallId ?? undefined,
    reason: row.reason as ReviewRequest["reason"],
    message: row.message,
    reviewUrl: row.reviewUrl ?? undefined,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    sentAt: isoOpt(row.sentAt),
    skippedAt: isoOpt(row.skippedAt),
    failureReason: row.failureReason ?? undefined,
  };
}

export function reviewRequestToDb(item: ReviewRequest): ReviewRequestRow {
  return {
    id: item.id,
    companyId: item.companyId,
    status: item.status,
    customerName: item.customerName ?? null,
    customerPhone: item.customerPhone ?? null,
    sourceCallId: item.sourceCallId ?? null,
    reason: item.reason,
    message: item.message,
    reviewUrl: item.reviewUrl ?? null,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    sentAt: dateOpt(item.sentAt),
    skippedAt: dateOpt(item.skippedAt),
    failureReason: item.failureReason ?? null,
  };
}
