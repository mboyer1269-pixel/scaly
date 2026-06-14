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

describe("messages ConversationRelay (entrants)", () => {
  it("parse setup avec callSid, from et customParameters", () => {
    const msg = parseRelayMessage(
      JSON.stringify({
        type: "setup",
        sessionId: "VX1",
        callSid: "CA123",
        from: "+18194141269",
        to: "+18190000000",
        customParameters: { companyId: "comp_belair", greeting: "Bonjour !" },
      }),
    );
    expect(msg).not.toBeNull();
    if (msg?.type !== "setup") throw new Error("setup attendu");
    expect(msg.callSid).toBe("CA123");
    expect(msg.customParameters?.companyId).toBe("comp_belair");
  });

  it("parse prompt (transcript final de l'appelant) et interrupt (barge-in)", () => {
    const prompt = parseRelayMessage(JSON.stringify({ type: "prompt", voicePrompt: "J'ai une fuite d'eau", lang: "fr-CA", last: true }));
    if (prompt?.type !== "prompt") throw new Error("prompt attendu");
    expect(prompt.voicePrompt).toBe("J'ai une fuite d'eau");

    const intr = parseRelayMessage(JSON.stringify({ type: "interrupt", utteranceUntilInterrupt: "Je peux vous" }));
    if (intr?.type !== "interrupt") throw new Error("interrupt attendu");
    expect(intr.utteranceUntilInterrupt).toBe("Je peux vous");
  });

  it("rejette le JSON invalide et les types inconnus — jamais de crash sur un message Twilio", () => {
    expect(parseRelayMessage("pas du json")).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ type: "info", description: "x" }))).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ noType: true }))).toBeNull();
  });
});

describe("messages ConversationRelay (sortants)", () => {
  it("jeton de texte : token + last (sans last:true, Twilio ne joue rien)", () => {
    expect(JSON.parse(relayTextToken("Bonjour", false))).toEqual({ type: "text", token: "Bonjour", last: false });
    expect(JSON.parse(relayTextToken("", true))).toEqual({ type: "text", token: "", last: true });
  });

  it("fin de session avec raison transmise en handoffData", () => {
    const end = JSON.parse(relayEnd("transfert humain")) as { type: string; handoffData?: string };
    expect(end.type).toBe("end");
    expect(JSON.parse(end.handoffData ?? "{}")).toEqual({ reason: "transfert humain" });
  });
});

describe("prompt relais", () => {
  it("ajoute les règles TTS SANS toucher au prompt champion", () => {
    const champion = "# Identité\nTu es Sophie.";
    const prompt = withRelayTtsRules(champion);
    expect(prompt.startsWith(champion)).toBe(true);
    expect(prompt).toContain("# Sortie vocale (synthèse)");
    expect(prompt).toContain("aucune liste");
  });
});

describe("flux Chat Completions (SSE)", () => {
  const sse = (obj: object) => `data: ${JSON.stringify(obj)}`;

  it("les deltas de contenu sortent en jetons, au fil de l'eau", () => {
    const acc = new ChatStreamAccumulator();
    const a1 = acc.feedLine(sse({ choices: [{ delta: { content: "Bonjour" } }] }));
    const a2 = acc.feedLine(sse({ choices: [{ delta: { content: " !" } }] }));
    expect(a1).toEqual([{ type: "token", text: "Bonjour" }]);
    expect(a2).toEqual([{ type: "token", text: " !" }]);
  });

  it("un appel d'outil s'accumule sur plusieurs deltas et sort au finish_reason", () => {
    const acc = new ChatStreamAccumulator();
    acc.feedLine(sse({ choices: [{ delta: { tool_calls: [{ function: { name: "transfer_to_human", arguments: '{"rea' } }] } }] }));
    acc.feedLine(sse({ choices: [{ delta: { tool_calls: [{ function: { arguments: 'son":"urgence"}' } }] } }] }));
    const final = acc.feedLine(sse({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }));
    expect(final).toEqual([
      { type: "tool_call", name: "transfer_to_human", args: { reason: "urgence" } },
      { type: "done", finishReason: "tool_calls" },
    ]);
  });

  it("ignore [DONE], les lignes vides, les commentaires SSE et le JSON cassé", () => {
    const acc = new ChatStreamAccumulator();
    expect(acc.feedLine("data: [DONE]")).toEqual([]);
    expect(acc.feedLine("")).toEqual([]);
    expect(acc.feedLine(": keep-alive")).toEqual([]);
    expect(acc.feedLine("data: {json cassé")).toEqual([]);
  });

  it("des arguments d'outil illisibles donnent des args vides — jamais de crash", () => {
    const acc = new ChatStreamAccumulator();
    acc.feedLine(sse({ choices: [{ delta: { tool_calls: [{ function: { name: "transfer_to_human", arguments: "{cassé" } }] } }] }));
    const final = acc.feedLine(sse({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }));
    expect(final[0]).toEqual({ type: "tool_call", name: "transfer_to_human", args: {} });
  });

  it("le corps de requête est en streaming avec l'outil de transfert", () => {
    const body = chatCompletionBody("gpt-4.1-mini", [{ role: "system", content: "x" }]) as {
      stream: boolean;
      tools: { function: { name: string } }[];
    };
    expect(body.stream).toBe(true);
    expect(body.tools[0].function.name).toBe("transfer_to_human");
  });
});

describe("RelayLatencyMeter (latence cerveau réelle, partielle et assumée)", () => {
  it("mesure transcript reçu → premier jeton, une fois par tour", () => {
    const meter = new RelayLatencyMeter();
    meter.onPromptReceived(1000);
    const l1 = meter.onFirstToken(1320);
    expect(l1).toEqual({ sttMs: 0, brainMs: 320, ttsMs: 0, perceivedMs: 320, simulated: false });
    // Deuxième jeton du même tour : pas de nouvelle mesure.
    expect(meter.onFirstToken(1400)).toBeNull();
    expect(meter.all()).toHaveLength(1);
  });

  it("sans transcript préalable, aucun jeton ne mesure rien", () => {
    const meter = new RelayLatencyMeter();
    expect(meter.onFirstToken(500)).toBeNull();
  });
});
