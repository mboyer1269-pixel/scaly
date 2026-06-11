/**
 * Protocole scaly-realtime — la partie PURE et testée du pont
 * Twilio Media Streams ↔ OpenAI Realtime (tests/realtime-protocol.test.ts).
 * Tout ce qui touche au réseau vit dans realtime/server.ts ; ici : parsing,
 * payloads de session, mapping d'événements et mesure RÉELLE de latence.
 */
import type { VoiceTurnLatency } from "../src/domain/voice";

// ---------------------------------------------------------------------------
// Messages Twilio Media Streams (WebSocket, audio µ-law 8 kHz base64)
// ---------------------------------------------------------------------------

export type TwilioMessage =
  | { event: "connected" }
  | { event: "start"; start: { streamSid: string; callSid: string; customParameters?: Record<string, string> } }
  | { event: "media"; media: { payload: string; timestamp?: string } }
  | { event: "mark"; mark: { name: string } }
  | { event: "stop" };

export function parseTwilioMessage(raw: string): TwilioMessage | null {
  try {
    const msg = JSON.parse(raw) as { event?: string };
    if (!msg || typeof msg.event !== "string") return null;
    if (!["connected", "start", "media", "mark", "stop"].includes(msg.event)) return null;
    return msg as TwilioMessage;
  } catch {
    return null;
  }
}

/** Trame audio sortante vers Twilio (réponse de l'agente). */
export function twilioMediaFrame(streamSid: string, b64Payload: string): string {
  return JSON.stringify({ event: "media", streamSid, media: { payload: b64Payload } });
}

/** Vide le tampon audio Twilio (barge-in : l'appelant coupe l'agente). */
export function twilioClearFrame(streamSid: string): string {
  return JSON.stringify({ event: "clear", streamSid });
}

// ---------------------------------------------------------------------------
// Session OpenAI Realtime
// ---------------------------------------------------------------------------

/**
 * Configuration de session — API GA (gpt-realtime, vérifiée contre l'exemple
 * officiel twilio-samples/speech-assistant-openai-realtime-api-node) :
 * `session.type: "realtime"`, formats audio IMBRIQUÉS (`audio/pcmu` = µ-law
 * 8 kHz natif Twilio, AUCUN transcodage dans le pont), VAD serveur (barge-in),
 * transcription d'entrée activée (transcript final = preuve + intelligence).
 * NB : le header `OpenAI-Beta: realtime=v1` est REJETÉ par l'API GA.
 */
export function openAiSessionUpdate(systemPrompt: string, voice: string, model = "gpt-realtime"): object {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      model,
      output_modalities: ["audio"],
      audio: {
        input: {
          format: { type: "audio/pcmu" },
          turn_detection: { type: "server_vad" },
          transcription: { model: "whisper-1" },
        },
        output: {
          format: { type: "audio/pcmu" },
          voice,
        },
      },
      instructions: systemPrompt,
      tools: [
        {
          type: "function",
          name: "transfer_to_human",
          description:
            "Transférer l'appel à un humain. À utiliser dès que l'appelant le demande, en cas de frustration, ou pour une urgence critique une fois l'adresse et le téléphone confirmés.",
          parameters: {
            type: "object",
            properties: { reason: { type: "string", description: "Raison du transfert, une phrase." } },
            required: ["reason"],
          },
        },
      ],
    },
  };
}

export function openAiAudioAppend(b64Payload: string): string {
  return JSON.stringify({ type: "input_audio_buffer.append", audio: b64Payload });
}

// ---------------------------------------------------------------------------
// Mapping des événements OpenAI → actions du pont
// ---------------------------------------------------------------------------

export type BridgeAction =
  | { type: "agent_audio"; b64: string }
  | { type: "caller_speech_started" }
  | { type: "caller_speech_stopped" }
  | { type: "caller_transcript"; text: string }
  | { type: "agent_transcript"; text: string }
  | { type: "transfer_requested"; reason: string }
  | { type: "response_done" }
  | { type: "error"; message: string }
  | { type: "ignore" };

export function mapOpenAiEvent(raw: string): BridgeAction {
  let evt: Record<string, unknown>;
  try {
    evt = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { type: "error", message: "Événement OpenAI illisible (JSON invalide)" };
  }
  const t = evt.type as string;
  switch (t) {
    // Noms GA d'abord, alias beta conservés par robustesse (migration GA 2025).
    case "response.output_audio.delta":
    case "response.audio.delta":
      return { type: "agent_audio", b64: String(evt.delta ?? "") };
    case "input_audio_buffer.speech_started":
      return { type: "caller_speech_started" };
    case "input_audio_buffer.speech_stopped":
      return { type: "caller_speech_stopped" };
    case "conversation.item.input_audio_transcription.completed":
      return { type: "caller_transcript", text: String(evt.transcript ?? "").trim() };
    case "response.output_audio_transcript.done":
    case "response.audio_transcript.done":
      return { type: "agent_transcript", text: String(evt.transcript ?? "").trim() };
    case "response.function_call_arguments.done": {
      if (evt.name !== "transfer_to_human") return { type: "ignore" };
      let reason = "Transfert demandé par l'agente";
      try {
        const args = JSON.parse(String(evt.arguments ?? "{}")) as { reason?: string };
        if (args.reason) reason = args.reason;
      } catch {
        // raison par défaut conservée
      }
      return { type: "transfer_requested", reason };
    }
    case "response.done":
      return { type: "response_done" };
    case "error":
      return { type: "error", message: JSON.stringify(evt.error ?? evt) };
    default:
      return { type: "ignore" };
  }
}

// ---------------------------------------------------------------------------
// Mesure RÉELLE de latence par tour (remplace les latences simulées de P2A)
// ---------------------------------------------------------------------------

/**
 * Latence perçue = fin de parole de l'appelant (VAD) → premier octet audio de
 * la réponse. En audio↔audio temps réel, STT/cerveau/TTS ne sont pas
 * séparables : la mesure complète est portée par `brainMs`, stt/tts à 0,
 * `simulated:false`. Même contrat VoiceTurnLatency que le Voice Lab.
 */
export class TurnLatencyMeter {
  private speechStoppedAt: number | null = null;
  private readonly measures: VoiceTurnLatency[] = [];

  onCallerSpeechStopped(nowMs: number): void {
    this.speechStoppedAt = nowMs;
  }

  /** Retourne la latence du tour si c'est le PREMIER audio depuis la fin de parole. */
  onFirstAudioDelta(nowMs: number): VoiceTurnLatency | null {
    if (this.speechStoppedAt === null) return null;
    const perceived = Math.max(0, nowMs - this.speechStoppedAt);
    this.speechStoppedAt = null;
    const latency: VoiceTurnLatency = { sttMs: 0, brainMs: perceived, ttsMs: 0, perceivedMs: perceived, simulated: false };
    this.measures.push(latency);
    return latency;
  }

  all(): VoiceTurnLatency[] {
    return [...this.measures];
  }
}
