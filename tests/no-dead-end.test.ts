import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import { validateCallOutcome } from "@/services/outcome";

function intelligence(over: Partial<CallIntelligence> = {}): CallIntelligence {
  return {
    engine: "rules-v1",
    summary: "Demande traitée.",
    intent: "question_info",
    intentConfidence: 0.9,
    sentiment: "neutre",
    urgency: "normale",
    leadQuality: "tiede",
    estimatedValueCad: 0,
    valueBasis: "aucun",
    nextAction: "aucune",
    tags: [],
    commercialScore: 40,
    confidence: 0.9,
    finalStatus: "resolu_par_ia",
    collectedFields: {},
    ...over,
  };
}

function call(over: Partial<Call> = {}): Call {
  return {
    id: "call_outcome",
    companyId: "comp_test",
    direction: "inbound",
    status: "completed",
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

describe("validateCallOutcome", () => {
  it("accepte un appel résolu, transféré, suivi ou spam", () => {
    expect(validateCallOutcome(call()).valid).toBe(true);
    expect(validateCallOutcome(call({ status: "transferred" })).valid).toBe(true);
    expect(validateCallOutcome(call({
      intelligence: intelligence({ finalStatus: "suivi_requis", nextAction: "creer_suivi" }),
    })).valid).toBe(true);
    expect(validateCallOutcome(call({
      intelligence: intelligence({ intent: "spam", finalStatus: "ignore_spam" }),
    })).valid).toBe(true);
  });

  it("refuse une conversation complétée sans résultat ni échec explicite", () => {
    const result = validateCallOutcome(call({ intelligence: undefined }));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("résultat");
  });
});
