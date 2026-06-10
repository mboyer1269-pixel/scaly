/**
 * Adapters — Abstraction de l'infrastructure vocale (ports)
 *
 * ARCHITECTURE CIBLE (voir docs/VOICE.md) :
 *   Appel entrant → Twilio Programmable Voice → Media Streams (WebSocket)
 *   → Service temps réel Scaly (Node long-lived, PAS AWS Lambda)
 *   → RealtimeDialogueProvider (OpenAI Realtime) OU pipeline STT→LLM→TTS
 *   → logs de session + fallback humain (transfert Twilio).
 *
 * AWS Lambda est réservé aux traitements asynchrones (actions, webhooks,
 * notifications, résumés) — jamais au flux audio temps réel.
 *
 * HONNÊTETÉ : seuls les types et le provider mock existent. Twilio, OpenAI
 * Realtime, ElevenLabs et Whisper sont des stubs typés NON CONFIGURÉS qui
 * échouent explicitement (NotConfiguredError) au lieu de simuler un succès.
 */
import type { LanguageCode } from "@/domain/company";

export type VoiceSessionEvent =
  | { type: "transcript_partial"; speaker: "caller" | "agent"; text: string }
  | { type: "transcript_final"; speaker: "caller" | "agent"; text: string }
  | { type: "audio_chunk"; bytes: number }
  | { type: "transfer_initiated"; to: string }
  | { type: "session_ended"; reason: string };

export interface VoiceSessionHandle {
  sessionId: string;
  say(text: string): Promise<void>;
  transferTo(phoneNumber: string): Promise<void>;
  hangup(): Promise<void>;
}

/** Téléphonie (numéros, appels entrants, transferts) — Twilio en P2. */
export interface TelephonyProvider {
  readonly name: string;
  isConfigured(): boolean;
  answerInbound(callSid: string, onEvent: (e: VoiceSessionEvent) => void): Promise<VoiceSessionHandle>;
}

/** Transcription (audio → texte) — Whisper ou STT externe. */
export interface SpeechToTextProvider {
  readonly name: string;
  isConfigured(): boolean;
  transcribe(audio: ArrayBuffer, lang: LanguageCode): Promise<string>;
}

/** Synthèse vocale (texte → audio) — ElevenLabs. */
export interface TextToSpeechProvider {
  readonly name: string;
  isConfigured(): boolean;
  synthesize(text: string, voiceId?: string): Promise<ArrayBuffer>;
}

/** Dialogue temps réel bout-en-bout (audio ↔ audio) — OpenAI Realtime. */
export interface RealtimeDialogueProvider {
  readonly name: string;
  isConfigured(): boolean;
  openSession(systemPrompt: string, onEvent: (e: VoiceSessionEvent) => void): Promise<VoiceSessionHandle>;
}

/** Erreur explicite : un provider réel a été appelé sans configuration. */
export class NotConfiguredError extends Error {
  constructor(provider: string, envVars: string[]) {
    super(
      `${provider} n'est pas configuré. Variables requises : ${envVars.join(", ")}. ` +
        `Voir docs/VOICE.md et .env.example. Aucun comportement n'est simulé ici par honnêteté.`,
    );
    this.name = "NotConfiguredError";
  }
}
