import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import type { ModelUsage } from "@/domain/model-usage";
import {
  InMemoryOwnerNotificationRepository,
  createPostCallNotification,
  listOwnerNotifications,
} from "@/services/owner-notifications";
import {
  SimulatedOwnerNotificationDelivery,
  type OwnerNotificationDelivery,
  deliverPendingOwnerNotification,
  deliverPendingOwnerNotifications,
  toSafeError,
} from "@/services/owner-notification-delivery";
import { callWarrantsOwnerNotification, createPostCallNotificationFromCall } from "@/services/post-call-notification";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function repo() {
  return new InMemoryOwnerNotificationRepository();
}

async function seedPending(companyId: string, r: InMemoryOwnerNotificationRepository, count = 1) {
  const created = [];
  for (let n = 0; n < count; n += 1) {
    created.push(
      await createPostCallNotification(
        companyId,
        { summary: `résumé ${n}`, recommendedAction: "rappeler", urgency: "normale" },
        { now: NOW, repo: r },
      ),
    );
  }
  return created;
}

function intel(over: Partial<CallIntelligence> = {}): CallIntelligence {
  return {
    engine: "rules-v1",
    summary: "Client veut une soumission de toiture.",
    intent: "demande_soumission",
    intentConfidence: 0.9,
    sentiment: "neutre",
    urgency: "haute",
    leadQuality: "chaud",
    estimatedValueCad: 1200,
    valueBasis: "bareme_industrie",
    nextAction: "envoyer_soumission",
    tags: [],
    commercialScore: 70,
    confidence: 0.9,
    finalStatus: "suivi_requis",
    collectedFields: {},
    ...over,
  };
}

function call(over: Partial<Call> & { id: string } = { id: "call_1" }): Call {
  return {
    companyId: "comp_test",
    direction: "inbound",
    status: "completed",
    source: "live",
    fromNumber: "514-555-0000",
    callerName: "M. Tremblay",
    language: "fr",
    startedAt: NOW.toISOString(),
    durationSec: 120,
    transcript: [],
    recordingUrl: null,
    intelligence: intel(),
    ...over,
  };
}

describe("toSafeError", () => {
  it("caviarde tokens, SID Twilio, Bearer/Basic et courriels", () => {
    // Faux secrets construits à l'exécution : aucun token littéral n'existe
    // dans le repo (évite de piéger les scanners de secrets).
    const token = ["sk", "secret123"].join("-");
    const sid = "AC" + "0123456789abcdef99";
    const email = ["owner", "example.com"].join("@");
    const safe = toSafeError(new Error(`Twilio 401: Basic QUZ123abc=; Bearer ${token} for ${email} ${sid}`));

    expect(safe).not.toContain(token);
    expect(safe).not.toContain(email);
    expect(safe).not.toContain(sid);
    expect(safe).not.toContain("Bearer");
    expect(safe).not.toContain("QUZ123abc");
    expect(safe).toContain("[caviardé]");
  });
});

describe("deliverPendingOwnerNotification", () => {
  it("marque sent et conserve le providerMessageId + outbox", async () => {
    const r = repo();
    const [note] = await seedPending("comp_test", r);
    const delivery = new SimulatedOwnerNotificationDelivery();

    const out = await deliverPendingOwnerNotification("comp_test", note.id, delivery, { now: NOW, repo: r });

    expect(out.status).toBe("sent");
    expect(out.providerMessageId).toBe(`sim_${note.id}`);
    expect(out.sentAt).toBe(NOW.toISOString());
    expect(delivery.outbox).toHaveLength(1);
  });

  it("marque failed avec un code non sensible quand le port refuse", async () => {
    const r = repo();
    const [note] = await seedPending("comp_test", r);
    const delivery = new SimulatedOwnerNotificationDelivery({ outcome: "failed", errorCode: "no_number" });

    const out = await deliverPendingOwnerNotification("comp_test", note.id, delivery, { now: NOW, repo: r });

    expect(out.status).toBe("failed");
    expect(out.failureReason).toBe("no_number");
  });

  it("caviarde l'erreur quand le port jette, sans jamais propager", async () => {
    const r = repo();
    const [note] = await seedPending("comp_test", r);
    const secret = ["sk", "live-abc123"].join("-");
    const email = ["owner", "example.com"].join("@");
    const leaky: OwnerNotificationDelivery = {
      async sendOwnerNotification() {
        throw new Error(`Provider down: Bearer ${secret} ${email}`);
      },
    };

    const out = await deliverPendingOwnerNotification("comp_test", note.id, leaky, { now: NOW, repo: r });

    expect(out.status).toBe("failed");
    expect(out.failureReason).not.toContain(secret);
    expect(out.failureReason).not.toContain(email);
  });

  it("ne renvoie jamais une notification déjà traitée (anti double-send)", async () => {
    const r = repo();
    const [note] = await seedPending("comp_test", r);
    let calls = 0;
    const counting: OwnerNotificationDelivery = {
      async sendOwnerNotification(n) {
        calls += 1;
        return { status: "sent", providerMessageId: `x_${n.id}` };
      },
    };

    const first = await deliverPendingOwnerNotification("comp_test", note.id, counting, { now: NOW, repo: r });
    const second = await deliverPendingOwnerNotification("comp_test", note.id, counting, { now: NOW, repo: r });

    expect(first.status).toBe("sent");
    expect(second.status).toBe("sent");
    expect(calls).toBe(1); // le second appel n'a PAS re-livré.
  });

  it("scope par tenant : refuse la notification d'un autre tenant", async () => {
    const r = repo();
    const [note] = await seedPending("comp_a", r);
    const delivery = new SimulatedOwnerNotificationDelivery();
    await expect(deliverPendingOwnerNotification("comp_b", note.id, delivery, { now: NOW, repo: r })).rejects.toThrow();
  });
});

describe("deliverPendingOwnerNotifications (batch)", () => {
  it("livre toutes les pending et compte les succès", async () => {
    const r = repo();
    await seedPending("comp_test", r, 3);
    const delivery = new SimulatedOwnerNotificationDelivery();

    const summary = await deliverPendingOwnerNotifications("comp_test", delivery, { now: NOW, repo: r });

    expect(summary.attempted).toBe(3);
    expect(summary.delivered).toBe(3);
    expect(summary.failed).toBe(0);
    expect(await listOwnerNotifications("comp_test", { status: "pending", repo: r })).toHaveLength(0);
    expect(await listOwnerNotifications("comp_test", { status: "sent", repo: r })).toHaveLength(3);
  });

  it("compte les échecs sans jeter", async () => {
    const r = repo();
    await seedPending("comp_test", r, 2);
    const delivery = new SimulatedOwnerNotificationDelivery({ outcome: "failed" });

    const summary = await deliverPendingOwnerNotifications("comp_test", delivery, { now: NOW, repo: r });

    expect(summary.attempted).toBe(2);
    expect(summary.delivered).toBe(0);
    expect(summary.failed).toBe(2);
  });
});

describe("createPostCallNotificationFromCall (hook post-appel)", () => {
  it("crée une notification post_call_summary depuis un appel qui le mérite", async () => {
    const r = repo();
    const note = await createPostCallNotificationFromCall(call({ id: "call_9" }), { now: NOW, repo: r });

    expect(note).not.toBeNull();
    expect(note?.type).toBe("post_call_summary");
    expect(note?.urgency).toBe("haute");
    expect(note?.sourceCallId).toBe("call_9");
    expect(note?.summary).toContain("M. Tremblay");
    expect(note?.recommendedAction).toBe("Envoyer une soumission");
    expect(note?.modelCostEstimateCad).toBeUndefined();
  });

  it("propage le coût IA quand un ModelUsage existe pour l'appel", async () => {
    const r = repo();
    const modelUsage: ModelUsage[] = [
      {
        id: "usage_1",
        companyId: "comp_test",
        callId: "call_9",
        provider: "openai",
        model: "gpt-test",
        feature: "call_analysis",
        status: "succeeded",
        startedAt: NOW.toISOString(),
        latencyMs: 42,
        attempt: 1,
        tokens: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        estimatedCostCad: 0.08,
      },
      {
        id: "usage_2",
        callId: "autre_call",
        provider: "openai",
        model: "gpt-test",
        feature: "call_analysis",
        status: "succeeded",
        startedAt: NOW.toISOString(),
        latencyMs: 10,
        attempt: 1,
        tokens: {},
        estimatedCostCad: 9.99,
      },
    ];

    const note = await createPostCallNotificationFromCall(call({ id: "call_9" }), { now: NOW, repo: r, modelUsage });

    // Seul le coût de call_9 est compté, pas celui d'un autre appel.
    expect(note?.modelCostEstimateCad).toBe(0.08);
  });

  it("ignore (null) un appel résolu sans suite (anti-spam)", async () => {
    const r = repo();
    const resolved = call({
      id: "call_calm",
      intelligence: intel({ urgency: "basse", leadQuality: "froid", nextAction: "aucune", finalStatus: "resolu_par_ia", saved: undefined }),
    });
    expect(callWarrantsOwnerNotification(resolved)).toBe(false);
    const note = await createPostCallNotificationFromCall(resolved, { now: NOW, repo: r });
    expect(note).toBeNull();
    expect(await listOwnerNotifications("comp_test", { repo: r })).toHaveLength(0);
  });

  it("ignore le spam", () => {
    expect(callWarrantsOwnerNotification(call({ id: "s", intelligence: intel({ intent: "spam", finalStatus: "ignore_spam" }) }))).toBe(false);
  });

  it("retourne null si l'appel n'a pas d'intelligence", async () => {
    const r = repo();
    const note = await createPostCallNotificationFromCall(call({ id: "raw", intelligence: undefined }), { now: NOW, repo: r });
    expect(note).toBeNull();
  });
});
