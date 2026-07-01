import { describe, expect, it } from "vitest";
import type { AgentTraceEvent } from "@/domain/agent-trace";
import type { ModelUsage } from "@/domain/model-usage";
import { InMemoryModelObservabilityRepository, summarizeModelUsage } from "@/services/model-gateway/observability";

function usage(over: Partial<ModelUsage>): ModelUsage {
  return {
    id: over.id ?? "usage_1",
    companyId: "comp_1",
    provider: "openai",
    model: "gpt-test",
    feature: "call_analysis",
    status: "succeeded",
    startedAt: over.startedAt ?? "2026-07-01T05:00:00.000Z",
    latencyMs: over.latencyMs ?? 100,
    attempt: 1,
    tokens: {},
    estimatedCostCad: over.estimatedCostCad ?? 0,
    ...over,
  };
}

function trace(over: Partial<AgentTraceEvent>): AgentTraceEvent {
  return {
    id: over.id ?? "trace_event_1",
    traceId: over.traceId ?? "trace_1",
    companyId: "comp_1",
    feature: "call_analysis",
    step: "model_request",
    status: "started",
    createdAt: over.createdAt ?? "2026-07-01T05:00:00.000Z",
    ...over,
  };
}

describe("model observability repository", () => {
  it("filtre les usages par tenant, feature et trace", async () => {
    const repo = new InMemoryModelObservabilityRepository();
    await repo.recordUsage(usage({ id: "a", traceId: "t1", estimatedCostCad: 0.1 }));
    await repo.recordUsage(usage({ id: "b", companyId: "comp_2", traceId: "t2", estimatedCostCad: 0.2 }));
    await repo.recordUsage(usage({ id: "c", feature: "onboarding_draft", traceId: "t1", estimatedCostCad: 0.3 }));

    expect((await repo.listUsage({ companyId: "comp_1" })).map((item) => item.id)).toEqual(["a", "c"]);
    expect((await repo.listUsage({ feature: "onboarding_draft" })).map((item) => item.id)).toEqual(["c"]);
    expect((await repo.listUsage({ traceId: "t2" })).map((item) => item.id)).toEqual(["b"]);
  });

  it("resume couts, echecs et latence moyenne", () => {
    const summary = summarizeModelUsage([
      usage({ id: "a", feature: "call_analysis", estimatedCostCad: 0.1, latencyMs: 100 }),
      usage({ id: "b", feature: "call_analysis", estimatedCostCad: 0.2, latencyMs: 200, status: "failed" }),
      usage({ id: "c", feature: "onboarding_draft", estimatedCostCad: 0.3, latencyMs: 300 }),
    ]);

    expect(summary).toMatchObject({
      calls: 3,
      succeeded: 2,
      failed: 1,
      estimatedCostCad: 0.6,
      avgLatencyMs: 200,
      byFeature: {
        call_analysis: { calls: 2, estimatedCostCad: 0.3 },
        onboarding_draft: { calls: 1, estimatedCostCad: 0.3 },
      },
    });
  });

  it("journalise les traces sans imposer Prisma", async () => {
    const repo = new InMemoryModelObservabilityRepository();
    await repo.recordTrace(trace({ id: "b", status: "completed", createdAt: "2026-07-01T05:00:01.000Z" }));
    await repo.recordTrace(trace({ id: "a", status: "started", createdAt: "2026-07-01T05:00:00.000Z" }));

    expect((await repo.listTraceEvents("trace_1")).map((event) => event.id)).toEqual(["a", "b"]);
  });
});
