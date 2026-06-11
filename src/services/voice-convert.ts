/**
 * Conversion VoiceSession → Call + CallIntelligence + Actions.
 * C'est la boucle de valeur complète : une session du Voice Lab sauvegardée
 * devient un appel de première classe — visible dans /calls, analysé par le
 * MÊME moteur d'intelligence que tout le produit, avec les actions planifiées
 * par le MÊME Action Engine. Le runtime n'est pas un jouet à côté du produit :
 * il alimente le produit.
 */
import type { Call, CallStatus, TranscriptTurn } from "@/domain/call";
import type { Company } from "@/domain/company";
import type { IndustryScript } from "@/domain/script";
import type { ScalyAction } from "@/domain/action";
import type { VoiceSession, VoiceSessionRecord } from "@/domain/voice";
import { newId } from "@/lib/format";
import { intelligenceEngine } from "./intelligence";
import { planActionsForCall } from "./action-engine";
import { VOICE_TO_SCRIPT } from "./voice-runtime";

export interface VoiceConversionResult {
  call: Call;
  actions: ScalyAction[];
}

export function voiceSessionToCall(session: VoiceSession, company: Company, script: IndustryScript): VoiceConversionResult {
  const transcript: TranscriptTurn[] = session.turns.map((t) => ({
    speaker: t.speaker,
    text: t.interrupted ? `${t.text} [interrompu]` : t.text,
    atMs: t.atMs,
    lang: t.lang,
  }));

  const status: CallStatus = session.transfer ? "transferred" : session.state === "failed" ? "abandoned" : "completed";

  // Champs runtime → champs script (seules les valeurs inférées/confirmées passent).
  const collectedFields: Record<string, string> = {};
  for (const f of session.fields) {
    const scriptKey = VOICE_TO_SCRIPT[f.key];
    if (scriptKey && f.value && (f.status === "confirmed" || f.status === "inferred")) {
      collectedFields[scriptKey] = f.value;
    }
  }

  const call: Call = {
    id: newId("call"),
    companyId: company.id,
    direction: "inbound",
    status,
    // HONNÊTETÉ : une session du lab est une simulation, jamais un appel "live".
    source: "simulator",
    fromNumber: collectedFields["telephone"] ?? "inconnu",
    callerName: collectedFields["nom"],
    language: session.dominantLanguage,
    startedAt: session.startedAtIso,
    durationSec: Math.round(session.clockMs / 1000),
    scriptId: script.id,
    seed: session.seed,
    transcript,
    recordingUrl: null,
  };

  call.intelligence = intelligenceEngine.analyze(call, script, {
    collectedFields,
    transferred: Boolean(session.transfer),
    transferReason: session.transfer?.reason,
  });

  return { call, actions: planActionsForCall(call, company) };
}

/** Session → enregistrement persistable (flight recorder consultable). */
export function voiceSessionToRecord(session: VoiceSession, callId?: string): VoiceSessionRecord {
  return {
    id: session.id,
    companyId: session.companyId,
    scenarioId: session.scenarioId,
    status: session.state,
    language: session.dominantLanguage,
    startedAt: session.startedAtIso,
    endedAt: session.endedAtIso,
    turns: session.turns,
    events: session.events,
    fields: session.fields,
    telemetry: session.telemetry,
    callId,
  };
}
