/**
 * Stub ElevenLabs (synthèse vocale) — P2. NON CONFIGURÉ : échoue explicitement.
 * Implémentation prévue : voix FR-QC naturelle, streaming bas-latence.
 */
import { NotConfiguredError, type TextToSpeechProvider } from "./types";

const ENV_VARS = ["ELEVENLABS_API_KEY"];

export class ElevenLabsTtsProvider implements TextToSpeechProvider {
  readonly name = "elevenlabs";

  isConfigured(): boolean {
    return ENV_VARS.every((v) => Boolean(process.env[v]));
  }

  async synthesize(_text: string, _voiceId?: string): Promise<ArrayBuffer> {
    if (!this.isConfigured()) throw new NotConfiguredError("ElevenLabs", ENV_VARS);
    throw new Error("ElevenLabsTtsProvider.synthesize : implémentation prévue en P2 (docs/VOICE.md).");
  }
}

export const elevenLabsProvider = new ElevenLabsTtsProvider();
