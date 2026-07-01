import type { AgentTraceEvent } from "@/domain/agent-trace";
import type { ModelErrorSummary, ModelFeature, ModelTokenUsage, ModelUsage } from "@/domain/model-usage";
import { newId } from "@/lib/format";
import { estimateTextModelCostCad } from "./costs";
import { getModelObservabilityRepository, type ModelObservabilityRepository } from "./observability";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ModelGatewayContext {
  companyId?: string;
  callId?: string;
  sessionId?: string;
  traceId?: string;
}

export interface OpenAiJsonChatCompletionRequest {
  apiKey: string;
  model: string;
  feature: ModelFeature;
  messages: ChatMessage[];
  responseSchema: unknown;
  schemaName: string;
  context?: ModelGatewayContext;
  retries?: number;
  timeoutMs?: number;
}

export interface ModelGatewayResult<T> {
  data: T;
  usage: ModelUsage;
}

export type ModelGatewayTransport = (input: string, init: RequestInit) => Promise<Response>;

interface OpenAiChatCompletionResponse {
  choices: { message: { content: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class ModelProviderError extends Error {
  readonly code: string;
  readonly retriable: boolean;
  readonly statusCode?: number;

  constructor(summary: ModelErrorSummary) {
    super(summary.message);
    this.name = "ModelProviderError";
    this.code = summary.code;
    this.retriable = summary.retriable;
    this.statusCode = summary.statusCode;
  }
}

export interface ModelGatewayOptions {
  transport?: ModelGatewayTransport;
  observability?: ModelObservabilityRepository;
  now?: () => Date;
  timeMs?: () => number;
  idGenerator?: (prefix: string) => string;
}

export function sanitizeProviderErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .slice(0, 300);
}

function providerError(code: string, message: string, retriable: boolean, statusCode?: number): ModelProviderError {
  return new ModelProviderError({ code, message: sanitizeProviderErrorMessage(message), retriable, statusCode });
}

function openAiUsage(data: OpenAiChatCompletionResponse): ModelTokenUsage {
  return {
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    totalTokens: data.usage?.total_tokens,
  };
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class ModelGateway {
  private readonly transport: ModelGatewayTransport;
  private readonly observability: ModelObservabilityRepository;
  private readonly now: () => Date;
  private readonly timeMs: () => number;
  private readonly idGenerator: (prefix: string) => string;

  constructor(options: ModelGatewayOptions = {}) {
    this.transport = options.transport ?? fetch;
    this.observability = options.observability ?? getModelObservabilityRepository();
    this.now = options.now ?? (() => new Date());
    this.timeMs = options.timeMs ?? (() => Date.now());
    this.idGenerator = options.idGenerator ?? newId;
  }

  async createOpenAiJsonChatCompletion<T>(request: OpenAiJsonChatCompletionRequest): Promise<ModelGatewayResult<T>> {
    const retries = request.retries ?? 2;
    let lastError: ModelProviderError | null = null;

    await this.recordTrace(request, "model_request", "started", undefined, { provider: "openai", model: request.model });

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      const startedAt = this.now().toISOString();
      const startedMs = this.timeMs();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 60_000);
      try {
        const response = await this.transport("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${request.apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model: request.model,
            temperature: 0,
            messages: request.messages,
            response_format: {
              type: "json_schema",
              json_schema: { name: request.schemaName, strict: true, schema: request.responseSchema },
            },
          }),
        });
        const latencyMs = Math.max(0, this.timeMs() - startedMs);
        if (!response.ok) {
          const body = await response.text();
          const err = providerError("provider_http_error", `OpenAI ${response.status} : ${body}`, isRetriableStatus(response.status), response.status);
          await this.recordUsage(request, startedAt, latencyMs, attempt, {}, 0, "failed", err);
          if (!err.retriable) {
            await this.recordTrace(request, "model_request", "failed", latencyMs, { provider: "openai", model: request.model, statusCode: response.status });
            throw err;
          }
          lastError = err;
        } else {
          const payload = (await response.json()) as OpenAiChatCompletionResponse;
          const content = payload.choices[0]?.message.content;
          if (!content) throw providerError("provider_empty_response", "OpenAI response missing message content", false);
          const parsed = JSON.parse(content) as T;
          const tokens = openAiUsage(payload);
          const usage = await this.recordUsage(request, startedAt, latencyMs, attempt, tokens, estimateTextModelCostCad(tokens), "succeeded");
          await this.recordTrace(request, "model_request", "completed", latencyMs, { provider: "openai", model: request.model, usageId: usage.id });
          return { data: parsed, usage };
        }
      } catch (err) {
        const latencyMs = Math.max(0, this.timeMs() - startedMs);
        const normalized =
          err instanceof ModelProviderError
            ? err
            : providerError(
                err instanceof Error && err.name === "AbortError" ? "provider_timeout" : "provider_error",
                err instanceof Error ? err.message : String(err),
                true,
              );
        if (!(err instanceof ModelProviderError && err.code === "provider_http_error")) {
          await this.recordUsage(request, startedAt, latencyMs, attempt, {}, 0, "failed", normalized);
        }
        lastError = normalized;
        if (!normalized.retriable) {
          await this.recordTrace(request, "model_request", "failed", latencyMs, { provider: "openai", model: request.model, code: normalized.code });
          throw normalized;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    const err = lastError ?? providerError("provider_error", "OpenAI call failed", true);
    await this.recordTrace(request, "model_request", "failed", undefined, { provider: "openai", model: request.model, code: err.code });
    throw err;
  }

  private async recordUsage(
    request: OpenAiJsonChatCompletionRequest,
    startedAt: string,
    latencyMs: number,
    attempt: number,
    tokens: ModelTokenUsage,
    estimatedCostCad: number,
    status: ModelUsage["status"],
    error?: ModelProviderError,
  ): Promise<ModelUsage> {
    const usage: ModelUsage = {
      id: this.idGenerator("usage"),
      ...request.context,
      provider: "openai",
      model: request.model,
      feature: request.feature,
      status,
      startedAt,
      latencyMs,
      attempt,
      tokens,
      estimatedCostCad,
      error: error ? { code: error.code, message: error.message, retriable: error.retriable, statusCode: error.statusCode } : undefined,
    };
    return this.observability.recordUsage(usage);
  }

  private async recordTrace(
    request: OpenAiJsonChatCompletionRequest,
    step: string,
    status: AgentTraceEvent["status"],
    latencyMs?: number,
    metadata?: AgentTraceEvent["metadata"],
  ): Promise<void> {
    if (!request.context?.traceId) return;
    await this.observability.recordTrace({
      id: this.idGenerator("trace"),
      traceId: request.context.traceId,
      companyId: request.context.companyId,
      callId: request.context.callId,
      sessionId: request.context.sessionId,
      feature: request.feature,
      step,
      status,
      createdAt: this.now().toISOString(),
      latencyMs,
      metadata,
    });
  }
}

export function getModelGateway(): ModelGateway {
  const g = globalThis as { __scalyModelGateway?: ModelGateway };
  if (!g.__scalyModelGateway) g.__scalyModelGateway = new ModelGateway();
  return g.__scalyModelGateway;
}
