/**
 * Corrections de revue Phase 4 : effacement complet (P0), claim anti double-envoi
 * (P1), idempotence appel (P1). Aucun appel externe ; repos frais injectés.
 */
import { describe, expect, it } from "vitest";
import type { Call } from "@/domain/call";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { InMemoryStore } from "@/server/store";
import {
  InMemoryBusinessKnowledgeRepository,
  getBusinessKnowledgeRepository,
} from "@/services/business-brain";
import {
  InMemoryOwnerNotificationRepository,
  createPostCallNotification,
  getOwnerNotificationRepository,
} from "@/services/owner-notifications";
import {
  InMemoryReviewRequestRepository,
  getReviewRequestRepository,
} from "@/services/review-requests";
import { deliverPendingOwnerNotification, type OwnerNotificationDelivery } from "@/services/owner-notification-delivery";

const NOW = new Date("2026-07-01T12:00:00.000Z");
const ISO = NOW.toISOString();

describe("deleteByCompany (droit à l'effacement, Loi 25)", () => {
  it("business knowledge : supprime uniquement le tenant ciblé et compte", async () => {
    const repo = new InMemoryBusinessKnowledgeRepository();
    await repo.save({ id: "k1", companyId: "A", title: "t", content: "c", sourceLabel: "s", sourceType: "owner_manual", status: "draft", createdAt: ISO });
    await repo.save({ id: "k2", companyId: "A", title: "t", content: "c", sourceLabel: "s", sourceType: "owner_manual", status: "draft", createdAt: ISO });
    await repo.save({ id: "k3", companyId: "B", title: "t", content: "c", sourceLabel: "s", sourceType: "owner_manual", status: "draft", createdAt: ISO });
    expect(await repo.deleteByCompany("A")).toBe(2);
    expect(await repo.list("A")).toHaveLength(0);
    expect(await repo.list("B")).toHaveLength(1);
  });

  it("owner notifications et review requests : suppression scoped", async () => {
    const on = new InMemoryOwnerNotificationRepository();
    await on.save({ id: "n1", companyId: "A", type: "post_call_summary", status: "pending", title: "t", summary: "s", recommendedAction: "a", urgency: "normale", createdAt: ISO, updatedAt: ISO });
    await on.save({ id: "n2", companyId: "B", type: "post_call_summary", status: "pending", title: "t", summary: "s", recommendedAction: "a", urgency: "normale", createdAt: ISO, updatedAt: ISO });
    expect(await on.deleteByCompany("A")).toBe(1);
    expect(await on.list("B")).toHaveLength(1);

    const rr = new InMemoryReviewRequestRepository();
    await rr.save({ id: "r1", companyId: "A", status: "drafted", reason: "resolved_positive", message: "m", createdAt: ISO, updatedAt: ISO });
    expect(await rr.deleteByCompany("A")).toBe(1);
    expect(await rr.deleteByCompany("A")).toBe(0);
  });
});

describe("Privacy : deleteCompanyData efface aussi les moteurs Phase 4", () => {
  it("compte les connaissances, notifications et avis supprimés", async () => {
    const company = "comp_fixture_del";
    await getBusinessKnowledgeRepository().save({ id: "kf1", companyId: company, title: "t", content: "c", sourceLabel: "s", sourceType: "owner_manual", status: "approved", createdAt: ISO });
    await getOwnerNotificationRepository().save({ id: "nf1", companyId: company, type: "post_call_summary", status: "pending", title: "t", summary: "s", recommendedAction: "a", urgency: "normale", createdAt: ISO, updatedAt: ISO });
    await getReviewRequestRepository().save({ id: "rf1", companyId: company, status: "drafted", reason: "resolved_positive", message: "m", createdAt: ISO, updatedAt: ISO });

    const store = new InMemoryStore();
    const result = await store.deleteCompanyData(company, "owner-request");

    expect(result.deleted.businessKnowledge).toBe(1);
    expect(result.deleted.ownerNotifications).toBe(1);
    expect(result.deleted.reviewRequests).toBe(1);
    // Effacement effectif.
    expect(await getBusinessKnowledgeRepository().list(company)).toHaveLength(0);
    expect(await getOwnerNotificationRepository().list(company)).toHaveLength(0);
    expect(await getReviewRequestRepository().list(company)).toHaveLength(0);
  });
});

const STALE = "2026-07-01T11:45:00.000Z"; // 15 min avant NOW

describe("claimForDelivery : réservation non-terminale, anti double-envoi", () => {
  it("réserve sans marquer sent (statut reste pending), une seule fois, scope le tenant", async () => {
    const repo = new InMemoryOwnerNotificationRepository();
    const n = await createPostCallNotification("comp_x", { summary: "s", recommendedAction: "a", urgency: "haute" }, { now: NOW, repo });

    expect(await repo.claimForDelivery("comp_x", n.id, ISO, STALE)).toBe(true);
    const claimed = await repo.get(n.id);
    expect(claimed?.status).toBe("pending"); // pas de « sent » fantôme
    expect(claimed?.deliveryClaimedAt).toBe(ISO);
    // Deuxième tentative fraîche : déjà réservée.
    expect(await repo.claimForDelivery("comp_x", n.id, ISO, STALE)).toBe(false);
    // Mauvais tenant / id inexistant.
    const n2 = await createPostCallNotification("comp_x", { summary: "s", recommendedAction: "a", urgency: "haute" }, { now: NOW, repo });
    expect(await repo.claimForDelivery("comp_autre", n2.id, ISO, STALE)).toBe(false);
    expect(await repo.claimForDelivery("comp_x", "inexistant", ISO, STALE)).toBe(false);
  });

  it("reprend une réservation périmée (process mort avant l'envoi)", async () => {
    const repo = new InMemoryOwnerNotificationRepository();
    const n = await createPostCallNotification("comp_x", { summary: "s", recommendedAction: "a", urgency: "haute" }, { now: NOW, repo });
    // Première réservation à 10:00 (process qui meurt ensuite).
    expect(await repo.claimForDelivery("comp_x", n.id, "2026-07-01T10:00:00.000Z", "2026-07-01T09:00:00.000Z")).toBe(true);
    // Passage suivant : la réservation de 10:00 est périmée (<= 11:45) → reprise.
    expect(await repo.claimForDelivery("comp_x", n.id, ISO, STALE)).toBe(true);
  });

  it("une notif déjà réservée fraîchement n'est PAS renvoyée", async () => {
    const repo = new InMemoryOwnerNotificationRepository();
    const n = await createPostCallNotification("comp_x", { summary: "s", recommendedAction: "a", urgency: "haute" }, { now: NOW, repo });
    // Simule un premier cron qui a déjà réservé la notif (statut reste pending).
    await repo.claimForDelivery("comp_x", n.id, ISO, STALE);

    let sends = 0;
    const delivery: OwnerNotificationDelivery = {
      async sendOwnerNotification() {
        sends += 1;
        return { status: "sent" };
      },
    };
    const out = await deliverPendingOwnerNotification("comp_x", n.id, delivery, { now: NOW, repo });
    expect(sends).toBe(0); // aucun second envoi concurrent
    expect(out.status).toBe("pending"); // pas envoyée par CE passage
  });
});

describe("Idempotence appel : provenance.externalId (callSid)", () => {
  it("un appel persisté est retrouvable par son callSid (base du guard voice/complete)", async () => {
    const store = new InMemoryStore();
    const call: Call = {
      id: "call_sid_1",
      companyId: DEFAULT_COMPANY_ID,
      direction: "inbound",
      status: "completed",
      source: "live",
      fromNumber: "514-555-0000",
      language: "fr",
      startedAt: ISO,
      durationSec: 60,
      transcript: [],
      recordingUrl: null,
      provenance: { provider: "twilio", externalId: "CA_test_sid" },
    };
    await store.addCall(call, []);
    const found = await store.findCallByExternalId(DEFAULT_COMPANY_ID, "CA_test_sid");
    expect(found?.id).toBe("call_sid_1");
    // Scope tenant + callSid inconnu.
    expect(await store.findCallByExternalId("comp_autre", "CA_test_sid")).toBeUndefined();
    expect(await store.findCallByExternalId(DEFAULT_COMPANY_ID, "inconnu")).toBeUndefined();
  });
});
