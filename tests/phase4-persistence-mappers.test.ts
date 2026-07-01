/**
 * Tests PURS des mappers de persistance Phase 4 (PR #29).
 * Round-trip domaine -> row -> domaine, sans aucune base ni client Prisma.
 */
import { describe, expect, it } from "vitest";
import type { BusinessKnowledgeItem } from "@/domain/business-brain";
import type { OwnerNotification } from "@/domain/owner-notification";
import type { ReviewRequest } from "@/domain/review-request";
import {
  businessKnowledgeFromDb,
  businessKnowledgeToDb,
  ownerNotificationFromDb,
  ownerNotificationToDb,
  reviewRequestFromDb,
  reviewRequestToDb,
} from "@/server/phase4-mappers";

const NOW = "2026-07-01T12:00:00.000Z";
const LATER = "2026-07-03T09:30:00.000Z";

describe("business knowledge mapper", () => {
  it("round-trip complet (champs optionnels remplis)", () => {
    const item: BusinessKnowledgeItem = {
      id: "know_1",
      companyId: "comp_test",
      title: "Politique de garantie",
      content: "Garantie 1 an sur la main-d'œuvre.",
      sourceLabel: "Propriétaire",
      sourceType: "owner_manual",
      status: "approved",
      createdAt: NOW,
      approvedAt: LATER,
      expiresAt: LATER,
    };
    expect(businessKnowledgeFromDb(businessKnowledgeToDb(item))).toEqual(item);
  });

  it("normalise null <-> undefined pour les dates optionnelles", () => {
    const row = businessKnowledgeToDb({
      id: "know_2",
      companyId: "comp_test",
      title: "Brouillon",
      content: "Contenu en attente d'approbation.",
      sourceLabel: "Propriétaire",
      sourceType: "owner_manual",
      status: "draft",
      createdAt: NOW,
    });
    expect(row.approvedAt).toBeNull();
    expect(row.expiresAt).toBeNull();
    expect(businessKnowledgeFromDb(row).approvedAt).toBeUndefined();
  });
});

describe("owner notification mapper", () => {
  it("round-trip complet avec coût IA et SID provider", () => {
    const item: OwnerNotification = {
      id: "ownernote_1",
      companyId: "comp_test",
      type: "post_call_summary",
      status: "sent",
      title: "Récapitulatif d'appel",
      summary: "Client satisfait.",
      recommendedAction: "Confirmer le rendez-vous.",
      urgency: "haute",
      sourceCallId: "call_1",
      sourceTraceId: "trace_1",
      modelCostEstimateCad: 0.08,
      createdAt: NOW,
      updatedAt: LATER,
      sentAt: LATER,
      providerMessageId: "SM_abc",
    };
    expect(ownerNotificationFromDb(ownerNotificationToDb(item))).toEqual(item);
  });

  it("préserve l'absence de coût et de destinataire", () => {
    const row = ownerNotificationToDb({
      id: "ownernote_2",
      companyId: "comp_test",
      type: "unknown_answer",
      status: "pending",
      title: "Maude a besoin d'une décision",
      summary: "Question sans source approuvée.",
      recommendedAction: "Répondre puis ajouter au Cerveau.",
      urgency: "haute",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(row.modelCostEstimateCad).toBeNull();
    expect(row.sentAt).toBeNull();
    expect(ownerNotificationFromDb(row).modelCostEstimateCad).toBeUndefined();
  });
});

describe("review request mapper", () => {
  it("round-trip complet (drafted avec lien d'avis)", () => {
    const item: ReviewRequest = {
      id: "review_req_1",
      companyId: "comp_test",
      status: "drafted",
      customerName: "Mme Roy",
      customerPhone: "514-555-0000",
      sourceCallId: "call_1",
      reason: "resolved_positive",
      message: "Bonjour Mme Roy, merci d'avoir contacté ...",
      reviewUrl: "https://g.page/r/x/review",
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(reviewRequestFromDb(reviewRequestToDb(item))).toEqual(item);
  });

  it("round-trip d'un saut (skipped, sans lien ni client)", () => {
    const item: ReviewRequest = {
      id: "review_req_2",
      companyId: "comp_test",
      status: "skipped",
      reason: "call_urgent",
      message: "",
      createdAt: NOW,
      updatedAt: NOW,
      skippedAt: NOW,
    };
    expect(reviewRequestFromDb(reviewRequestToDb(item))).toEqual(item);
  });
});
