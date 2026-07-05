/**
 * Test d'intégration golden-path — prouve que les briques Phase 4 (PR #25→#28)
 * COMPOSENT : un appel réel devient une alerte owner livrée, et un avis prêt.
 * Tout est injecté (repos + port simulé) — aucun getStore, aucun appel externe.
 */
import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import type { Company } from "@/domain/company";
import type { ModelUsage } from "@/domain/model-usage";
import { DEFAULT_COMPANY_ID, SEED_COMPANIES } from "@/data/companies";
import { InMemoryOwnerNotificationRepository, listOwnerNotifications } from "@/services/owner-notifications";
import { createPostCallNotificationFromCall } from "@/services/post-call-notification";
import {
  SimulatedOwnerNotificationDelivery,
  type OwnerNotificationDelivery,
  deliverPendingOwnerNotifications,
} from "@/services/owner-notification-delivery";
import { InMemoryReviewRequestRepository, createReviewRequestFromCall } from "@/services/review-requests";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function company(): Company {
  const c = SEED_COMPANIES.find((x) => x.id === DEFAULT_COMPANY_ID);
  if (!c) throw new Error("fixture: compagnie seed introuvable");
  return c;
}

function intel(over: Partial<CallIntelligence> = {}): CallIntelligence {
  return {
    engine: "rules-v1",
    summary: "Client satisfait, rendez-vous confirmé.",
    intent: "prise_rdv",
    intentConfidence: 0.9,
    sentiment: "positif",
    urgency: "basse",
    leadQuality: "chaud",
    estimatedValueCad: 400,
    valueBasis: "bareme_industrie",
    nextAction: "confirmer_rdv",
    tags: [],
    commercialScore: 65,
    confidence: 0.9,
    finalStatus: "resolu_par_ia",
    collectedFields: {},
    ...over,
  };
}

function call(over: Partial<Call> = {}): Call {
  return {
    id: "call_live_1",
    companyId: DEFAULT_COMPANY_ID,
    direction: "inbound",
    status: "completed",
    source: "live",
    fromNumber: "514-555-7777",
    callerName: "Mme Roy",
    language: "fr",
    startedAt: NOW.toISOString(),
    durationSec: 120,
    transcript: [],
    recordingUrl: null,
    intelligence: intel(),
    ...over,
  };
}

describe("Pipeline Phase 4 — golden path", () => {
  it("un appel urgent résolu → notif owner créée pending → cron livre → sent + SID, avec coût IA propagé", async () => {
    const ownerRepo = new InMemoryOwnerNotificationRepository();
    const c = company();
    const urgentCall = call({ id: "call_urg", intelligence: intel({ urgency: "haute", nextAction: "rappeler_immediatement" }) });
    const modelUsage: ModelUsage[] = [
      {
        id: "usage_1",
        companyId: c.id,
        callId: "call_urg",
        provider: "openai",
        model: "gpt-test",
        feature: "call_analysis",
        status: "succeeded",
        startedAt: NOW.toISOString(),
        latencyMs: 40,
        attempt: 1,
        tokens: { totalTokens: 120 },
        estimatedCostCad: 0.05,
      },
    ];

    // 1) Hook post-appel (PR #26) — crée la notification pending.
    const created = await createPostCallNotificationFromCall(urgentCall, { now: NOW, repo: ownerRepo, modelUsage });
    expect(created?.status).toBe("pending");
    expect(created?.type).toBe("post_call_summary");
    expect(created?.modelCostEstimateCad).toBe(0.05);

    // 2) Cron de livraison (PR #28) via le port simulé (PR #26) — bascule sent.
    const delivery = new SimulatedOwnerNotificationDelivery();
    const summary = await deliverPendingOwnerNotifications(c.id, delivery, { now: NOW, repo: ownerRepo });
    expect(summary).toMatchObject({ attempted: 1, delivered: 1, failed: 0 });

    const sent = (await listOwnerNotifications(c.id, { status: "sent", repo: ownerRepo }))[0];
    expect(sent?.providerMessageId).toBe(`sim_${created?.id}`);
    expect(delivery.outbox).toHaveLength(1);

    // 3) Idempotence : un second passage ne relivre rien.
    const second = await deliverPendingOwnerNotifications(c.id, delivery, { now: NOW, repo: ownerRepo });
    expect(second.attempted).toBe(0);
  });

  it("le même appel résolu/positif produit une demande d'avis prête (drafted) car la config a un reviewUrl", async () => {
    const reviewRepo = new InMemoryReviewRequestRepository();
    const c = company();
    const request = await createReviewRequestFromCall(call(), c, { now: NOW, repo: reviewRepo });
    expect(request.status).toBe("drafted");
    expect(request.reviewUrl).toBe(c.reviewUrl);
    expect(request.message).toContain(c.reviewUrl as string);
  });

  it("un échec de livraison ne fuit aucun secret et n'interrompt pas le lot", async () => {
    const ownerRepo = new InMemoryOwnerNotificationRepository();
    const c = company();
    await createPostCallNotificationFromCall(call({ id: "c_a", intelligence: intel({ urgency: "haute" }) }), { now: NOW, repo: ownerRepo });
    await createPostCallNotificationFromCall(call({ id: "c_b", intelligence: intel({ urgency: "critique" }) }), { now: NOW, repo: ownerRepo });

    const token = ["sk", "topsecret42"].join("-");
    const leaky: OwnerNotificationDelivery = {
      async sendOwnerNotification() {
        throw new Error(`Twilio 401 Bearer ${token}`);
      },
    };

    const summary = await deliverPendingOwnerNotifications(c.id, leaky, { now: NOW, repo: ownerRepo });
    expect(summary.attempted).toBe(2);
    expect(summary.failed).toBe(2);
    for (const n of await listOwnerNotifications(c.id, { status: "failed", repo: ownerRepo })) {
      expect(n.failureReason).not.toContain(token);
    }
  });

  it("anti-spam : un appel résolu banal ne crée AUCUNE notification owner", async () => {
    const ownerRepo = new InMemoryOwnerNotificationRepository();
    const banal = call({
      id: "c_calm",
      intelligence: intel({ urgency: "basse", leadQuality: "froid", nextAction: "aucune", finalStatus: "resolu_par_ia", saved: undefined }),
    });
    const created = await createPostCallNotificationFromCall(banal, { now: NOW, repo: ownerRepo });
    expect(created).toBeNull();
    expect(await listOwnerNotifications(DEFAULT_COMPANY_ID, { repo: ownerRepo })).toHaveLength(0);
  });
});
