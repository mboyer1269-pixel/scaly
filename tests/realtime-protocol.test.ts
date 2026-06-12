import { describe, expect, it } from "vitest";
import {
  mapOpenAiEvent,
  openAiAudioAppend,
  openAiSessionUpdate,
  parseTwilioMessage,
  twilioClearFrame,
  twilioMediaFrame,
  TurnLatencyMeter,
} from "../realtime/protocol";

describe("messages Twilio", () => {
  it("parse start/media/stop et rejette le bruit", () => {
    const start = parseTwilioMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1", customParameters: { companyId: "comp_belair" } } }));
    expect(start?.event).toBe("start");
    expect(parseTwilioMessage(JSON.stringify({ event: "media", media: { payload: "AAAA" } }))?.event).toBe("media");
    expect(parseTwilioMessage("pas du json")).toBeNull();
    expect(parseTwilioMessage(JSON.stringify({ event: "inconnu" }))).toBeNull();
  });

  it("trames sortantes : media et clear (barge-in)", () => {
    expect(JSON.parse(twilioMediaFrame("MZ1", "AAAA"))).toEqual({ event: "media", streamSid: "MZ1", media: { payload: "AAAA" } });
    expect(JSON.parse(twilioClearFrame("MZ1"))).toEqual({ event: "clear", streamSid: "MZ1" });
  });
});

describe("session OpenAI Realtime (forme GA — vérifiée contre l'exemple officiel Twilio)", () => {
  const session = openAiSessionUpdate("PROMPT_TEST", "marin") as {
    type: string;
    session: {
      type: string;
      output_modalities: string[];
      audio: {
        input: { format: { type: string }; turn_detection: { type: string; eagerness?: string; interrupt_response?: boolean }; transcription: { model: string; language?: string } };
        output: { format: { type: string }; voice: string };
      };
      instructions: string;
      tools: { name: string }[];
    };
  };

  it("session.type realtime + audio/pcmu imbriqué dans les deux sens — zéro transcodage", () => {
    expect(session.session.type).toBe("realtime");
    expect(session.session.output_modalities).toEqual(["audio"]);
    expect(session.session.audio.input.format.type).toBe("audio/pcmu");
    expect(session.session.audio.output.format.type).toBe("audio/pcmu");
    expect(session.session.audio.output.voice).toBe("marin");
  });

  it("VAD sémantique (barge-in natif), transcription FR et prompt système", () => {
    expect(session.session.audio.input.turn_detection.type).toBe("semantic_vad");
    expect(session.session.audio.input.turn_detection.interrupt_response).toBe(true);
    expect(session.session.instructions).toBe("PROMPT_TEST");
    expect(session.session.audio.input.transcription.model).toBe("whisper-1");
    expect(session.session.audio.input.transcription.language).toBe("fr");
  });

  it("expose l'outil transfer_to_human", () => {
    expect(session.session.tools.map((t) => t.name)).toContain("transfer_to_human");
  });

  it("append audio", () => {
    expect(JSON.parse(openAiAudioAppend("BBBB"))).toEqual({ type: "input_audio_buffer.append", audio: "BBBB" });
  });
});

describe("mapping des événements OpenAI", () => {
  it("audio delta, VAD, transcripts, fin de réponse (noms GA + alias beta)", () => {
    expect(mapOpenAiEvent(JSON.stringify({ type: "response.output_audio.delta", delta: "QUJD" }))).toEqual({ type: "agent_audio", b64: "QUJD" });
    expect(mapOpenAiEvent(JSON.stringify({ type: "response.output_audio_transcript.done", transcript: "Allo" }))).toEqual({ type: "agent_transcript", text: "Allo" });
    expect(mapOpenAiEvent(JSON.stringify({ type: "response.audio.delta", delta: "QUJD" }))).toEqual({ type: "agent_audio", b64: "QUJD" });
    expect(mapOpenAiEvent(JSON.stringify({ type: "input_audio_buffer.speech_started" }))).toEqual({ type: "caller_speech_started" });
    expect(mapOpenAiEvent(JSON.stringify({ type: "input_audio_buffer.speech_stopped" }))).toEqual({ type: "caller_speech_stopped" });
    expect(mapOpenAiEvent(JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", transcript: " Allô ! " })))
      .toEqual({ type: "caller_transcript", text: "Allô !" });
    expect(mapOpenAiEvent(JSON.stringify({ type: "response.audio_transcript.done", transcript: "Bonjour !" })))
      .toEqual({ type: "agent_transcript", text: "Bonjour !" });
    expect(mapOpenAiEvent(JSON.stringify({ type: "response.done" }))).toEqual({ type: "response_done" });
  });

  it("appel d'outil transfer_to_human avec raison (et raison par défaut si args illisibles)", () => {
    expect(mapOpenAiEvent(JSON.stringify({ type: "response.function_call_arguments.done", name: "transfer_to_human", arguments: JSON.stringify({ reason: "Client frustré" }) })))
      .toEqual({ type: "transfer_requested", reason: "Client frustré" });
    const fallback = mapOpenAiEvent(JSON.stringify({ type: "response.function_call_arguments.done", name: "transfer_to_human", arguments: "{{{" }));
    expect(fallback.type).toBe("transfer_requested");
  });

  it("événements inconnus ignorés, erreurs remontées", () => {
    expect(mapOpenAiEvent(JSON.stringify({ type: "rate_limits.updated" }))).toEqual({ type: "ignore" });
    expect(mapOpenAiEvent("###").type).toBe("error");
    expect(mapOpenAiEvent(JSON.stringify({ type: "error", error: { message: "boom" } })).type).toBe("error");
  });
});

describe("TurnLatencyMeter — latences réelles", () => {
  it("mesure fin de parole → premier audio, une fois par tour, simulated:false", () => {
    const meter = new TurnLatencyMeter();
    expect(meter.onFirstAudioDelta(100)).toBeNull(); // audio sans fin de parole préalable → rien
    meter.onCallerSpeechStopped(1000);
    const l = meter.onFirstAudioDelta(1450);
    expect(l).toEqual({ sttMs: 0, brainMs: 450, ttsMs: 0, perceivedMs: 450, simulated: false });
    expect(meter.onFirstAudioDelta(1500)).toBeNull(); // deltas suivants du même tour ignorés
    meter.onCallerSpeechStopped(5000);
    expect(meter.onFirstAudioDelta(5620)?.perceivedMs).toBe(620);
    expect(meter.all().map((x) => x.perceivedMs)).toEqual([450, 620]);
  });
});
