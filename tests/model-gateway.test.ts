import { describe, expect, it } from "vitest";
import { InMemoryModelObservabilityRepository } from "@/services/model-gateway/observability";
import { ModelGateway, ModelProviderError } from "@/services/model-gateway";

function makeGateway(transport: (input: string, init: RequestInit) => Promise<Response>) {
  const observability = new InMemoryModelObservabilityRepository();
  let id = 0;
  let ms = 1_000;
  const gateway = new ModelGateway({
    transport: async (input, init) => {
      const response = await transport(input, init);
      ms += 42;
      return response;
    },
    observability,
    now: () => new Date("2026-07-01T05:00:00.000Z"),
    timeMs: () => ms,
    idGenerator: (prefix) => `${prefix}_${++id}`,
  });
  return { gateway, observability };
}

describe("ModelGateway", () => {
  it("appelle OpenAI via transport injectable et capture usage + trace sans prompt brut", async () => {
    const { gateway, observability } = makeGateway(async (_input, init) => {
      expect(init.headers).toEqual(expect.objectContaining({ Authorization: "Bearer test-key" }));
      expect(String(init.body)).not.toContain("test-key");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
        { status: 200 },
      );
    });

    const result = await gateway.createOpenAiJsonChatCompletion<{ ok: boolean }>({
      apiKey: "test-key",
      model: "gpt-test",
      feature: "call_analysis",
      context: { companyId: "comp_1", callId: "call_1", traceId: "trace_1" },
      messages: [{ role: "user", content: "Analyse ceci" }],
      responseSchema: { type: "object" },
      schemaName: "fixture",
      retries: 0,
    });

    expect(result.data).toEqual({ ok: true });
    expect(result.usage).toMatchObject({
      id: "usage_2",
      companyId: "comp_1",
      callId: "call_1",
      traceId: "trace_1",
      provider: "openai",
      model: "gpt-test",
      feature: "call_analysis",
      status: "succeeded",
      latencyMs: 42,
      tokens: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      estimatedCostCad: 0.00006,
    });

    const usage = await observability.listUsage({ traceId: "trace_1" });
    expect(usage).toHaveLength(1);
    const traces = await observability.listTraceEvents("trace_1");
    expect(traces.map((event) => event.status)).toEqual(["started", "completed"]);
    expect(JSON.stringify(traces)).not.toContain("Analyse ceci");
  });

  it("normalise les erreurs provider sans exposer secrets ni courriels", async () => {
    const { gateway, observability } = makeGateway(async () =>
      new Response("bad key Bearer test-secret123 for owner@example.com", { status: 400 }),
    );

    await expect(
      gateway.createOpenAiJsonChatCompletion({
        apiKey: "test-secret123",
        model: "gpt-test",
        feature: "onboarding_draft",
        context: { companyId: "comp_1", traceId: "trace_error" },
        messages: [{ role: "user", content: "x" }],
        responseSchema: { type: "object" },
        schemaName: "fixture",
      }),
    ).rejects.toBeInstanceOf(ModelProviderError);

    const [usage] = await observability.listUsage({ traceId: "trace_error" });
    expect(usage.status).toBe("failed");
    expect(usage.error?.code).toBe("provider_http_error");
    expect(usage.error?.retriable).toBe(false);
    expect(usage.error?.message).not.toContain("test-secret123");
    expect(usage.error?.message).not.toContain("owner@example.com");
  });
});
