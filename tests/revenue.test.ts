import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import type { ModelUsage } from "@/domain/model-usage";
import { computeRevenueCounter } from "@/services/revenue";

const NOW = new Date("2026-06-11T12:00:00Z");

function intel(over: Partial<CallIntelligence> = {}): CallIntelligence {
  return {
    engine: "rules-v1",
    summary: "fixture",
    intent: "demande_soumission",
    intentConfidence: 0.9,
    sentiment: "neutre",
    urgency: "normale",
    leadQuality: "tiede",
    estimatedValueCad: 0,
    valueBasis: "bareme_industrie",
    nextAction: "rappeler_immediatement",
    tags: [],
    commercialScore: 50,
    confidence: 0.9,
    finalStatus: "suivi_requis",
    collectedFields: {},
    ...over,
  };
}

function call(over: Partial<Call> & { id: string; daysAgo?: number; durationSec?: number }): Call {
  const { daysAgo, id, durationSec, ...rest } = over;
  return {
    id,
    companyId: "comp_test",
    direction: "inbound",
    status: "completed",
    source: "simulator",
    fromNumber: "514-555-0000",
    language: "fr",
    startedAt: new Date(NOW.getTime() - (daysAgo ?? 0) * 24 * 3600 * 1000).toISOString(),
    durationSec: durationSec ?? 60,
    transcript: [],
    recordingUrl: null,
    ...rest,
  };
}

describe("computeRevenueCounter", () => {
  it("calcule argent protege, cout IA estime et marge estimee sur la periode", () => {
    const calls: Call[] = [
      call({
        id: "declared",
        durationSec: 120,
        intelligence: intel({ saved: { reason: "hors_heures" }, estimatedValueCad: 1000, valueBasis: "montant_mentionne" }),
      }),
      call({
        id: "estimated",
        durationSec: 60,
        intelligence: intel({ saved: { reason: "rappel_sms" }, estimatedValueCad: 500, valueBasis: "bareme_industrie" }),
      }),
      call({ id: "cost_only", durationSec: 180, intelligence: intel({ estimatedValueCad: 300 }) }),
      call({
        id: "outside_period",
        daysAgo: 30,
        durationSec: 600,
        intelligence: intel({ saved: { reason: "hors_heures" }, estimatedValueCad: 9999 }),
      }),
    ];

    const counter = computeRevenueCounter(calls, { periodDays: 14, now: NOW });

    expect(counter.protectedCad).toBe(1500);
    expect(counter.protectedDeclaredCad).toBe(1000);
    expect(counter.protectedEstimatedCad).toBe(500);
    expect(counter.estimatedAiMinutes).toBe(6);
    expect(counter.estimatedAiCostCad).toBe(0.66);
    expect(counter.estimatedMarginCad).toBe(1499.34);
    expect(counter.estimatedMarginRate).toBe(0.9996);
    expect(counter.costPerProtectedDollarCad).toBe(0.0004);
    expect(counter.costedCallsCount).toBe(3);
  });

  it("reste explicite quand aucune valeur n'est encore protegee", () => {
    const counter = computeRevenueCounter([call({ id: "answered", durationSec: 30 })], { now: NOW });

    expect(counter.protectedCad).toBe(0);
    expect(counter.estimatedAiCostCad).toBe(0.06);
    expect(counter.estimatedMarginCad).toBe(-0.06);
    expect(counter.estimatedMarginRate).toBeNull();
    expect(counter.costPerProtectedDollarCad).toBeNull();
  });

  it("prefere les couts ModelUsage captures au proxy par duree", () => {
    const saved = call({
      id: "saved",
      durationSec: 3600,
      intelligence: intel({ saved: { reason: "hors_heures" }, estimatedValueCad: 1000 }),
    });
    const modelUsage: ModelUsage[] = [
      {
        id: "usage_1",
        companyId: "comp_test",
        callId: "saved",
        provider: "openai",
        model: "gpt-test",
        feature: "call_analysis",
        status: "succeeded",
        startedAt: NOW.toISOString(),
        latencyMs: 42,
        attempt: 1,
        tokens: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        estimatedCostCad: 0.25,
      },
    ];

    const counter = computeRevenueCounter([saved], { now: NOW, modelUsage });

    expect(counter.estimatedAiCostCad).toBe(0.25);
    expect(counter.costedCallsCount).toBe(1);
    expect(counter.assumption).toContain("usage(s) modele captures");
  });
});
