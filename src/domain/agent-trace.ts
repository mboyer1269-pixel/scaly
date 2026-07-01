/** Domaine — trace agentique sans verbatim ni prompt brut. */
import type { ModelFeature } from "./model-usage";

export type AgentTraceStatus = "started" | "decision" | "tool_call" | "completed" | "failed";

export interface AgentTraceEvent {
  id: string;
  traceId: string;
  companyId?: string;
  callId?: string;
  sessionId?: string;
  feature: ModelFeature;
  step: string;
  status: AgentTraceStatus;
  createdAt: string;
  latencyMs?: number;
  modelUsageId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}
