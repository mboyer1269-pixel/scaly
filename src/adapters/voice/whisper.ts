/**
 * Stub Whisper / STT externe (transcription) — P2. NON CONFIGURÉ : échoue explicitement.
 * Implémentation prévue : transcription FR-QC/EN avec détection de langue par segment.
 */
import type { LanguageCode } from "@/domain/company";
import { NotConfiguredError, type SpeechToTextProvider } from "./types";

const ENV_VARS = ["OPENAI_API_KEY"];

export class WhisperSttProvider implements SpeechToTextProvider {
  readonly name = "whisper";

  isConfigured(): boolean {
    return ENV_VARS.every((v) => Boolean(process.env[v]));
  }

  async transcribe(_audio: ArrayBuffer, _lang: LanguageCode): Promise<string> {
    if (!this.isConfigured()) throw new NotConfiguredError("Whisper STT", ENV_VARS);
    throw new Error("WhisperSttProvider.transcribe : implémentation prévue en P2 (docs/VOICE.md).");
  }
}

export const whisperProvider = new WhisperSttProvider();
