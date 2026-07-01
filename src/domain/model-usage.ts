/** Domaine — usage modele et couts provider (Phase 4). */

export type ModelProvider = "openai" | "litellm" | "mock";
export type ModelFeature =
  | "call_analysis"
  | "onboarding_draft"
  | "business_brain"
  | "agent_graph"
  | "realtime_voice"
  | "unknown";
export type ModelCallStatus = "succeeded" | "failed";

export interface ModelTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ModelErrorSummary {
  code: string;
  message: string;
  retriable: boolean;
  statusCode?: number;
}

export interface ModelUsage {
  id: string;
  companyId?: string;
  callId?: string;
  sessionId?: string;
  traceId?: string;
  provider: ModelProvider;
  model: string;
  feature: ModelFeature;
  status: ModelCallStatus;
  startedAt: string;
  latencyMs: number;
  attempt: number;
  tokens: ModelTokenUsage;
  estimatedCostCad: number;
  error?: ModelErrorSummary;
}
