/**
 * Stub OpenAI Realtime (dialogue audio temps réel) — P2. NON CONFIGURÉ : échoue explicitement.
 * Implémentation prévue : session WebSocket audio↔audio avec barge-in,
 * prompt système construit depuis VoiceAgentConfig + IndustryScript.
 */
import { NotConfiguredError, type RealtimeDialogueProvider, type VoiceSessionEvent, type VoiceSessionHandle } from "./types";

const ENV_VARS = ["OPENAI_API_KEY"];

export class OpenAiRealtimeProvider implements RealtimeDialogueProvider {
  readonly name = "openai-realtime";

  isConfigured(): boolean {
    return ENV_VARS.every((v) => Boolean(process.env[v]));
  }

  async openSession(_systemPrompt: string, _onEvent: (e: VoiceSessionEvent) => void): Promise<VoiceSessionHandle> {
    if (!this.isConfigured()) throw new NotConfiguredError("OpenAI Realtime", ENV_VARS);
    throw new Error("OpenAiRealtimeProvider.openSession : implémentation prévue en P2 (docs/VOICE.md).");
  }
}

export const openAiRealtimeProvider = new OpenAiRealtimeProvider();
