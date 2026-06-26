import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import { createReviewItems } from "@/services/review";

function intelligence(over: Partial<CallIntelligence> = {}): CallIntelligence {
  return {
    engine: "rules-v1",
    summary: "Dégât d'eau actif.",
    intent: "urgence",
    intentConfidence: 0.92,
    sentiment: "negatif",
    urgency: "critique",
    leadQuality: "chaud",
    estimatedValueCad: 900,
    valueBasis: "bareme_industrie",
    nextAction: "transferer_humain",
    tags: ["urgence"],
    commercialScore: 95,
    confidence: 0.92,
    finalStatus: "transfere",
    collectedFields: { telephone: "514-555-0101" },
    ...over,
  };
}

function call(over: Partial<Call> = {}): Call {
  return {
    id: "call_review",
    companyId: "comp_test",
    direction: "inbound",
    status: "transferred",
    source: "simulator",
    fromNumber: "514-555-0101",
    language: "fr",
    startedAt: "2026-06-25T12:00:00.000Z",
    durationSec: 60,
    transcript: [],
    intelligence: intelligence(),
    recordingUrl: null,
    ...over,
  };
}

describe("createReviewItems", () => {
  it("crée une révision pour chaque champ requis manquant avec la preuve de l'appel", () => {
    const items = createReviewItems({
      call: call(),
      requiredFields: ["telephone", "adresse"],
      now: new Date("2026-06-25T12:10:00.000Z"),
    });

    expect(items).toContainEqual(expect.objectContaining({
      callId: "call_review",
      reason: "missing_required_field",
      evidence: expect.stringContaining("adresse"),
      status: "open",
    }));
  });

  it("crée une révision de faible confiance sans dupliquer les identifiants", () => {
    const items = createReviewItems({
      call: call({ intelligence: intelligence({ confidence: 0.54 }) }),
      requiredFields: [],
      now: new Date("2026-06-25T12:10:00.000Z"),
    });

    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe("low_confidence");
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });

  it("crée une révision pour un appel abandonné", () => {
    const items = createReviewItems({
      call: call({ status: "abandoned", intelligence: undefined }),
      requiredFields: [],
      now: new Date("2026-06-25T12:10:00.000Z"),
    });

    expect(items).toContainEqual(expect.objectContaining({ reason: "abandoned_call" }));
  });
});
