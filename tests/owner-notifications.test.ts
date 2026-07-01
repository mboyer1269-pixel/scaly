import { describe, expect, it } from "vitest";
import {
  InMemoryOwnerNotificationRepository,
  type OwnerNotifier,
  createPostCallNotification,
  createUnknownAnswerNotification,
  dismissNotification,
  listOwnerNotifications,
  markNotificationFailed,
  markNotificationSent,
} from "@/services/owner-notifications";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function repo() {
  return new InMemoryOwnerNotificationRepository();
}

describe("createPostCallNotification", () => {
  it("cree une action post-appel en attente, avec cout IA optionnel", async () => {
    const r = repo();
    const note = await createPostCallNotification(
      "comp_test",
      {
        summary: "Appel de M. Tremblay pour une soumission de toiture.",
        recommendedAction: "Rappeler pour confirmer la disponibilite.",
        urgency: "normale",
        sourceCallId: "call_1",
        sourceTraceId: "trace_1",
        modelCostEstimateCad: 0.12,
      },
      { now: NOW, repo: r },
    );

    expect(note.type).toBe("post_call_summary");
    expect(note.status).toBe("pending");
    expect(note.title).toBe("Récapitulatif d'appel");
    expect(note.sourceCallId).toBe("call_1");
    expect(note.sourceTraceId).toBe("trace_1");
    expect(note.modelCostEstimateCad).toBe(0.12);
    expect(note.createdAt).toBe(NOW.toISOString());
    expect(note.sentAt).toBeUndefined();
  });

  it("laisse le cout absent quand aucun ModelUsage n'est fourni", async () => {
    const r = repo();
    const note = await createPostCallNotification(
      "comp_test",
      { summary: "Appel court sans analyse.", recommendedAction: "Aucune action.", urgency: "basse" },
      { now: NOW, repo: r },
    );
    expect(note.modelCostEstimateCad).toBeUndefined();
  });

  it("refuse un resume ou une action vide", async () => {
    const r = repo();
    await expect(
      createPostCallNotification("comp_test", { summary: "   ", recommendedAction: "x", urgency: "normale" }, { repo: r, now: NOW }),
    ).rejects.toThrow();
    await expect(
      createPostCallNotification("comp_test", { summary: "ok", recommendedAction: "   ", urgency: "normale" }, { repo: r, now: NOW }),
    ).rejects.toThrow();
  });
});

describe("createUnknownAnswerNotification", () => {
  it("transforme un refus no_approved_source en action urgente vers le Cerveau d'entreprise", async () => {
    const r = repo();
    const note = await createUnknownAnswerNotification(
      "comp_test",
      { question: "Offrez-vous le financement ?", reason: "no_approved_source", sourceCallId: "call_9" },
      { now: NOW, repo: r },
    );

    expect(note.type).toBe("unknown_answer");
    expect(note.status).toBe("pending");
    expect(note.urgency).toBe("haute");
    expect(note.title).toBe("Maude a besoin d'une décision");
    // Le lien UI vers /knowledge est derive du type + de l'action recommandee.
    expect(note.recommendedAction).toContain("Cerveau d'entreprise");
    expect(note.summary).toContain("Offrez-vous le financement");
    expect(note.sourceCallId).toBe("call_9");
  });

  it("distingue le refus question_too_short", async () => {
    const r = repo();
    const note = await createUnknownAnswerNotification(
      "comp_test",
      { question: "?", reason: "question_too_short" },
      { now: NOW, repo: r },
    );
    expect(note.type).toBe("unknown_answer");
    expect(note.summary).toContain("trop courte");
  });
});

describe("cycle de vie et transitions", () => {
  it("markNotificationSent horodate l'envoi", async () => {
    const r = repo();
    const note = await createPostCallNotification(
      "comp_test",
      { summary: "s", recommendedAction: "a", urgency: "normale" },
      { now: NOW, repo: r },
    );
    const sent = await markNotificationSent("comp_test", note.id, { now: NOW, repo: r });
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBe(NOW.toISOString());
  });

  it("markNotificationFailed conserve la raison", async () => {
    const r = repo();
    const note = await createPostCallNotification(
      "comp_test",
      { summary: "s", recommendedAction: "a", urgency: "normale" },
      { now: NOW, repo: r },
    );
    const failed = await markNotificationFailed("comp_test", note.id, "sms_provider_down", { now: NOW, repo: r });
    expect(failed.status).toBe("failed");
    expect(failed.failureReason).toBe("sms_provider_down");
  });

  it("dismissNotification marque traite et horodate", async () => {
    const r = repo();
    const note = await createUnknownAnswerNotification(
      "comp_test",
      { question: "test", reason: "no_approved_source" },
      { now: NOW, repo: r },
    );
    const dismissed = await dismissNotification("comp_test", note.id, { now: NOW, repo: r });
    expect(dismissed.status).toBe("dismissed");
    expect(dismissed.dismissedAt).toBe(NOW.toISOString());
  });
});

describe("port de livraison injectable (aucun provider reel)", () => {
  it("marque sent quand le port confirme la livraison", async () => {
    const r = repo();
    const notifier: OwnerNotifier = { deliver: async () => ({ ok: true }) };
    const note = await createPostCallNotification(
      "comp_test",
      { summary: "s", recommendedAction: "a", urgency: "normale" },
      { now: NOW, repo: r, notifier },
    );
    expect(note.status).toBe("sent");
    expect(note.sentAt).toBe(NOW.toISOString());
  });

  it("marque failed quand le port echoue ou jette, sans jamais propager l'erreur", async () => {
    const r = repo();
    const rejecting: OwnerNotifier = { deliver: async () => ({ ok: false, reason: "no_number" }) };
    const throwing: OwnerNotifier = {
      deliver: async () => {
        throw new Error("boom");
      },
    };

    const a = await createPostCallNotification(
      "comp_test",
      { summary: "s", recommendedAction: "a", urgency: "normale" },
      { now: NOW, repo: r, notifier: rejecting },
    );
    expect(a.status).toBe("failed");
    expect(a.failureReason).toBe("no_number");

    const b = await createPostCallNotification(
      "comp_test",
      { summary: "s", recommendedAction: "a", urgency: "normale" },
      { now: NOW, repo: r, notifier: throwing },
    );
    expect(b.status).toBe("failed");
    expect(b.failureReason).toBe("boom");
  });
});

describe("listOwnerNotifications", () => {
  it("place les pending en tete puis trie par urgence", async () => {
    const r = repo();
    await createPostCallNotification("comp_test", { summary: "normal", recommendedAction: "a", urgency: "normale" }, { now: NOW, repo: r });
    const critical = await createUnknownAnswerNotification("comp_test", { question: "urgence critique", reason: "no_approved_source" }, { now: NOW, repo: r });
    // Passe le critique en dismissed ne devrait PAS le remonter en tete.
    const dismissed = await createPostCallNotification("comp_test", { summary: "dismissed", recommendedAction: "a", urgency: "critique" }, { now: NOW, repo: r });
    await dismissNotification("comp_test", dismissed.id, { now: NOW, repo: r });

    const all = await listOwnerNotifications("comp_test", { repo: r });
    // unknown_answer (haute, pending) avant post_call (normale, pending) avant dismissed.
    expect(all[0]?.id).toBe(critical.id);
    expect(all[all.length - 1]?.status).toBe("dismissed");

    const pendingOnly = await listOwnerNotifications("comp_test", { status: "pending", repo: r });
    expect(pendingOnly).toHaveLength(2);
    expect(pendingOnly.every((n) => n.status === "pending")).toBe(true);
  });
});

describe("isolation multi-tenant", () => {
  it("un tenant ne voit ni ne modifie les notifications d'un autre", async () => {
    const r = repo();
    const noteA = await createPostCallNotification("comp_a", { summary: "A", recommendedAction: "a", urgency: "normale" }, { now: NOW, repo: r });
    await createPostCallNotification("comp_b", { summary: "B", recommendedAction: "b", urgency: "normale" }, { now: NOW, repo: r });

    expect(await listOwnerNotifications("comp_a", { repo: r })).toHaveLength(1);
    expect(await listOwnerNotifications("comp_b", { repo: r })).toHaveLength(1);

    await expect(dismissNotification("comp_b", noteA.id, { now: NOW, repo: r })).rejects.toThrow();
    await expect(markNotificationSent("comp_b", noteA.id, { now: NOW, repo: r })).rejects.toThrow();

    const untouched = await r.get(noteA.id);
    expect(untouched?.status).toBe("pending");
  });
});
