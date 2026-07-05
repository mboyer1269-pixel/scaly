import type { AgentTraceEvent } from "@/domain/agent-trace";
import type { ModelFeature, ModelProvider, ModelUsage } from "@/domain/model-usage";

export interface ModelUsageFilter {
  companyId?: string;
  callId?: string;
  sessionId?: string;
  traceId?: string;
  feature?: ModelFeature;
  provider?: ModelProvider;
}

export interface ModelUsageSummary {
  calls: number;
  succeeded: number;
  failed: number;
  estimatedCostCad: number;
  avgLatencyMs: number;
  byFeature: Record<string, { calls: number; estimatedCostCad: number }>;
}

export interface ModelObservabilityRepository {
  recordUsage(usage: ModelUsage): Promise<ModelUsage>;
  listUsage(filter?: ModelUsageFilter): Promise<ModelUsage[]>;
  recordTrace(event: AgentTraceEvent): Promise<AgentTraceEvent>;
  listTraceEvents(traceId?: string): Promise<AgentTraceEvent[]>;
}

export class InMemoryModelObservabilityRepository implements ModelObservabilityRepository {
  private usage = new Map<string, ModelUsage>();
  private traces = new Map<string, AgentTraceEvent>();

  async recordUsage(usage: ModelUsage): Promise<ModelUsage> {
    this.usage.set(usage.id, usage);
    return usage;
  }

  async listUsage(filter: ModelUsageFilter = {}): Promise<ModelUsage[]> {
    return [...this.usage.values()]
      .filter((usage) => !filter.companyId || usage.companyId === filter.companyId)
      .filter((usage) => !filter.callId || usage.callId === filter.callId)
      .filter((usage) => !filter.sessionId || usage.sessionId === filter.sessionId)
      .filter((usage) => !filter.traceId || usage.traceId === filter.traceId)
      .filter((usage) => !filter.feature || usage.feature === filter.feature)
      .filter((usage) => !filter.provider || usage.provider === filter.provider)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async recordTrace(event: AgentTraceEvent): Promise<AgentTraceEvent> {
    this.traces.set(event.id, event);
    return event;
  }

  async listTraceEvents(traceId?: string): Promise<AgentTraceEvent[]> {
    return [...this.traces.values()]
      .filter((event) => !traceId || event.traceId === traceId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

function money(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}

export function summarizeModelUsage(records: ModelUsage[]): ModelUsageSummary {
  const byFeature: ModelUsageSummary["byFeature"] = {};
  for (const record of records) {
    const bucket = byFeature[record.feature] ?? { calls: 0, estimatedCostCad: 0 };
    bucket.calls += 1;
    bucket.estimatedCostCad = money(bucket.estimatedCostCad + record.estimatedCostCad);
    byFeature[record.feature] = bucket;
  }
  const latencyTotal = records.reduce((sum, record) => sum + record.latencyMs, 0);
  return {
    calls: records.length,
    succeeded: records.filter((record) => record.status === "succeeded").length,
    failed: records.filter((record) => record.status === "failed").length,
    estimatedCostCad: money(records.reduce((sum, record) => sum + record.estimatedCostCad, 0)),
    avgLatencyMs: records.length ? Math.round(latencyTotal / records.length) : 0,
    byFeature,
  };
}

export function createModelObservabilityRepository(): ModelObservabilityRepository {
  return new InMemoryModelObservabilityRepository();
}

export function getModelObservabilityRepository(): ModelObservabilityRepository {
  const g = globalThis as { __scalyModelObservability?: ModelObservabilityRepository };
  if (!g.__scalyModelObservability) g.__scalyModelObservability = createModelObservabilityRepository();
  return g.__scalyModelObservability;
}
