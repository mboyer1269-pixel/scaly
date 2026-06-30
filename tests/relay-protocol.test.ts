import { describe, expect, it } from "vitest";
import {
  ChatStreamAccumulator,
  chatCompletionBody,
  parseRelayMessage,
  RelayLatencyMeter,
  relayEnd,
  relayTextToken,
  withRelayTtsRules,
} from "../realtime/relay-protocol";

describe("ConversationRelay messages", () => {
  it("parse setup, prompt and interrupt messages", () => {
    const setup = parseRelayMessage(JSON.stringify({
      type: "setup",
      sessionId: "VX1",
      callSid: "CA123",
      from: "+18194141269",
      customParameters: { companyId: "comp_belair", greeting: "Bonjour !" },
    }));
    expect(setup).not.toBeNull();
    if (setup?.type !== "setup") throw new Error("setup attendu");
    expect(setup.callSid).toBe("CA123");
    expect(setup.customParameters?.companyId).toBe("comp_belair");

    const prompt = parseRelayMessage(JSON.stringify({ type: "prompt", voicePrompt: "J'ai une fuite d'eau", lang: "fr-CA", last: true }));
    if (prompt?.type !== "prompt") throw new Error("prompt attendu");
    expect(prompt.voicePrompt).toBe("J'ai une fuite d'eau");

    const interrupt = parseRelayMessage(JSON.stringify({ type: "interrupt", utteranceUntilInterrupt: "Je peux vous" }));
    if (interrupt?.type !== "interrupt") throw new Error("interrupt attendu");
    expect(interrupt.utteranceUntilInterrupt).toBe("Je peux vous");
  });

  it("rejects invalid JSON and unknown message types", () => {
    expect(parseRelayMessage("pas du json")).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ type: "info" }))).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ noType: true }))).toBeNull();
  });

  it("serializes outbound text tokens and end messages", () => {
    expect(JSON.parse(relayTextToken("Bonjour", false))).toEqual({ type: "text", token: "Bonjour", last: false });
    expect(JSON.parse(relayTextToken("", true))).toEqual({ type: "text", token: "", last: true });
    const end = JSON.parse(relayEnd("transfert humain")) as { type: string; handoffData?: string };
    expect(end.type).toBe("end");
    expect(JSON.parse(end.handoffData ?? "{}")).toEqual({ reason: "transfert humain" });
  });
});

describe("relay prompt", () => {
  it("adds TTS rules without mutating the champion prompt", () => {
    const champion = "# Identité\nTu es Sophie.";
    const prompt = withRelayTtsRules(champion);
    expect(prompt.startsWith(champion)).toBe(true);
    expect(prompt).toContain("# Sortie vocale");
    expect(prompt).toContain("aucune liste");
  });
});

describe("Chat Completions stream accumulator", () => {
  const sse = (obj: object) => `data: ${JSON.stringify(obj)}`;

  it("emits content deltas as tokens", () => {
    const acc = new ChatStreamAccumulator();
    expect(acc.feedLine(sse({ choices: [{ delta: { content: "Bonjour" } }] }))).toEqual([{ type: "token", text: "Bonjour" }]);
    expect(acc.feedLine(sse({ choices: [{ delta: { content: " !" } }] }))).toEqual([{ type: "token", text: " !" }]);
  });

  it("accumulates streamed tool calls until finish_reason", () => {
    const acc = new ChatStreamAccumulator();
    acc.feedLine(sse({ choices: [{ delta: { tool_calls: [{ function: { name: "transfer_to_human", arguments: "{\"rea" } }] } }] }));
    acc.feedLine(sse({ choices: [{ delta: { tool_calls: [{ function: { arguments: "son\":\"urgence\"}" } }] } }] }));
    expect(acc.feedLine(sse({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }))).toEqual([
      { type: "tool_call", name: "transfer_to_human", args: { reason: "urgence" } },
      { type: "done", finishReason: "tool_calls" },
    ]);
  });

  it("ignores keep-alive, DONE and malformed JSON", () => {
    const acc = new ChatStreamAccumulator();
    expect(acc.feedLine("data: [DONE]")).toEqual([]);
    expect(acc.feedLine("")).toEqual([]);
    expect(acc.feedLine(": keep-alive")).toEqual([]);
    expect(acc.feedLine("data: {json cassé")).toEqual([]);
  });

  it("uses empty args for malformed tool call JSON", () => {
    const acc = new ChatStreamAccumulator();
    acc.feedLine(sse({ choices: [{ delta: { tool_calls: [{ function: { name: "transfer_to_human", arguments: "{cassé" } }] } }] }));
    const final = acc.feedLine(sse({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }));
    expect(final[0]).toEqual({ type: "tool_call", name: "transfer_to_human", args: {} });
  });

  it("builds a streaming request body with the transfer tool", () => {
    const body = chatCompletionBody("gpt-4.1-mini", [{ role: "system", content: "x" }]) as {
      stream: boolean;
      tools: { function: { name: string } }[];
    };
    expect(body.stream).toBe(true);
    expect(body.tools[0].function.name).toBe("transfer_to_human");
  });
});

describe("RelayLatencyMeter", () => {
  it("measures transcript-to-first-token once per turn", () => {
    const meter = new RelayLatencyMeter();
    meter.onPromptReceived(1000);
    expect(meter.onFirstToken(1320)).toEqual({ sttMs: 0, brainMs: 320, ttsMs: 0, perceivedMs: 320, simulated: false });
    expect(meter.onFirstToken(1400)).toBeNull();
    expect(meter.all()).toHaveLength(1);
  });

  it("does not measure without a prompt", () => {
    const meter = new RelayLatencyMeter();
    expect(meter.onFirstToken(500)).toBeNull();
  });
});
