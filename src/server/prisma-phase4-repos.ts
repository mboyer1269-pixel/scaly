/**
 * Repos Prisma des 3 moteurs Phase 4 (Business Brain, notifications owner,
 * demandes d'avis). Chargés uniquement quand STORE_PROVIDER=prisma (lazy require
 * côté services), donc le client Prisma n'est jamais importé en mode démo.
 *
 * Le tri final reste la responsabilité des services (list*), qui re-trient
 * après lecture : ici on renvoie simplement les lignes du tenant.
 */
import { prisma } from "./prisma";
import type { BusinessKnowledgeItem } from "@/domain/business-brain";
import type { OwnerNotification } from "@/domain/owner-notification";
import type { ReviewRequest } from "@/domain/review-request";
import type { BusinessKnowledgeRepository } from "@/services/business-brain";
import type { OwnerNotificationRepository } from "@/services/owner-notifications";
import type { ReviewRequestRepository } from "@/services/review-requests";
import {
  businessKnowledgeFromDb,
  businessKnowledgeToDb,
  ownerNotificationFromDb,
  ownerNotificationToDb,
  reviewRequestFromDb,
  reviewRequestToDb,
} from "./phase4-mappers";

export class PrismaBusinessKnowledgeRepository implements BusinessKnowledgeRepository {
  async list(companyId: string): Promise<BusinessKnowledgeItem[]> {
    const rows = await prisma.businessKnowledgeItem.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
    return rows.map(businessKnowledgeFromDb);
  }

  async get(id: string): Promise<BusinessKnowledgeItem | undefined> {
    const row = await prisma.businessKnowledgeItem.findUnique({ where: { id } });
    return row ? businessKnowledgeFromDb(row) : undefined;
  }

  async save(item: BusinessKnowledgeItem): Promise<BusinessKnowledgeItem> {
    const data = businessKnowledgeToDb(item);
    await prisma.businessKnowledgeItem.upsert({ where: { id: item.id }, create: data, update: data });
    return item;
  }
}

export class PrismaOwnerNotificationRepository implements OwnerNotificationRepository {
  async list(companyId: string): Promise<OwnerNotification[]> {
    const rows = await prisma.ownerNotification.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
    return rows.map(ownerNotificationFromDb);
  }

  async get(id: string): Promise<OwnerNotification | undefined> {
    const row = await prisma.ownerNotification.findUnique({ where: { id } });
    return row ? ownerNotificationFromDb(row) : undefined;
  }

  async save(notification: OwnerNotification): Promise<OwnerNotification> {
    const data = ownerNotificationToDb(notification);
    await prisma.ownerNotification.upsert({ where: { id: notification.id }, create: data, update: data });
    return notification;
  }
}

export class PrismaReviewRequestRepository implements ReviewRequestRepository {
  async list(companyId: string): Promise<ReviewRequest[]> {
    const rows = await prisma.reviewRequest.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
    return rows.map(reviewRequestFromDb);
  }

  async get(id: string): Promise<ReviewRequest | undefined> {
    const row = await prisma.reviewRequest.findUnique({ where: { id } });
    return row ? reviewRequestFromDb(row) : undefined;
  }

  async save(request: ReviewRequest): Promise<ReviewRequest> {
    const data = reviewRequestToDb(request);
    await prisma.reviewRequest.upsert({ where: { id: request.id }, create: data, update: data });
    return request;
  }
}
