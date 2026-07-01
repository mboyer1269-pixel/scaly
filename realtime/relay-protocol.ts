/**
 * Pure protocol helpers for the ConversationRelay A/B prototype.
 *
 * Twilio owns ASR and TTS in this path; the relay receives caller text,
 * streams LLM text tokens back, and records only the brain latency we can
 * actually observe.
 */
import type { VoiceTurnLatency } from "../src/domain/voice";

export type RelayMessage =
  | {
      type: "setup";
      sessionId?: string;
      callSid: string;
      from?: string;
      to?: string;
      customParameters?: Record<string, string>;
    }
  | { type: "prompt"; voicePrompt: string; lang?: string; last?: boolean }
  | { type: "interrupt"; utteranceUntilInterrupt?: string; durationUntilInterruptMs?: number }
  | { type: "dtmf"; digit: string }
  | { type: "error"; description?: string };

export function parseRelayMessage(raw: string): RelayMessage | null {
  try {
    const msg = JSON.parse(raw) as { type?: string };
    if (!msg || typeof msg.type !== "string") return null;
    if (!["setup", "prompt", "interrupt", "dtmf", "error"].includes(msg.type)) return null;
    return msg as RelayMessage;
  } catch {
    return null;
  }
}

export function relayTextToken(token: string, last: boolean): string {
  return JSON.stringify({ type: "text", token, last });
}

export function relayEnd(reason?: string): string {
  return JSON.stringify({ type: "end", ...(reason ? { handoffData: JSON.stringify({ reason }) } : {}) });
}

export const RELAY_TTS_RULES = [
  `# Sortie vocale (synthèse)`,
  `Tes réponses sont lues mot à mot par une synthèse vocale : texte brut SEULEMENT — ` +
    `aucune liste, aucun symbole, aucune mise en forme, aucun émoji. ` +
    `Phrases courtes. Les abréviations s'écrivent au long (« monsieur », jamais « M. »).`,
].join("\n");

export function withRelayTtsRules(championPrompt: string): string {
  return `${championPrompt}\n${RELAY_TTS_RULES}`;
}

export type RelayLlmAction =
  | { type: "token"; text: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "done"; finishReason: string | null };

export class ChatStreamAccumulator {
  private toolName = "";
  private toolArgs = "";

  feedLine(line: string): RelayLlmAction[] {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return [];
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") return [];

    let evt: { choices?: { delta?: { content?: string; tool_calls?: { function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[] };
    try {
      evt = JSON.parse(payload) as typeof evt;
    } catch {
      return [];
    }
    const choice = evt.choices?.[0];
    if (!choice) return [];

    const actions: RelayLlmAction[] = [];
    if (choice.delta?.content) actions.push({ type: "token", text: choice.delta.content });
    for (const tc of choice.delta?.tool_calls ?? []) {
      if (tc.function?.name) this.toolName = tc.function.name;
      if (tc.function?.arguments) this.toolArgs += tc.function.arguments;
    }
    if (choice.finish_reason) {
      if (this.toolName) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(this.toolArgs || "{}") as Record<string, unknown>;
        } catch {
          // Invalid tool args should not crash the live call.
        }
        actions.push({ type: "tool_call", name: this.toolName, args });
        this.toolName = "";
        this.toolArgs = "";
      }
      actions.push({ type: "done", finishReason: choice.finish_reason });
    }
    return actions;
  }
}

export function chatCompletionBody(model: string, messages: { role: string; content: string }[]): object {
  return {
    model,
    messages,
    stream: true,
    max_tokens: 300,
    tools: [
      {
        type: "function",
        function: {
          name: "transfer_to_human",
          description:
            "Transferer l'appel a un humain des que l'appelant le demande, en cas de frustration, ou pour une urgence critique une fois l'adresse et le telephone confirmes.",
          parameters: {
            type: "object",
            properties: { reason: { type: "string", description: "Raison du transfert, une phrase." } },
            required: ["reason"],
          },
        },
      },
    ],
  };
}

export class RelayLatencyMeter {
  private promptAt: number | null = null;
  private readonly measures: VoiceTurnLatency[] = [];

  onPromptReceived(nowMs: number): void {
    this.promptAt = nowMs;
  }

  onFirstToken(nowMs: number): VoiceTurnLatency | null {
    if (this.promptAt === null) return null;
    const brain = Math.max(0, nowMs - this.promptAt);
    this.promptAt = null;
    const latency: VoiceTurnLatency = { sttMs: 0, brainMs: brain, ttsMs: 0, perceivedMs: brain, simulated: false };
    this.measures.push(latency);
    return latency;
  }

  all(): VoiceTurnLatency[] {
    return [...this.measures];
  }
}
