/**
 * Repli humain — persistance partagée entre /api/voice/incoming (realtime non
 * configuré) et /api/voice/fallback (callback `action` de <Connect> quand le
 * stream meurt pendant l'appel). Règle produit : le téléphone ne casse JAMAIS.
 */
import { getStore } from "@/server/store";
import { getScriptById } from "@/data/industry-scripts";
import { intelligenceEngine } from "@/services/intelligence";
import { planActionsForCall } from "@/services/action-engine";
import { newId } from "@/lib/format";
import type { Call, TranscriptTurn } from "@/domain/call";
import type { Company } from "@/domain/company";

/** URL relative du callback `action` — Twilio la résout contre l'URL du webhook. */
export const VOICE_FALLBACK_ACTION_PATH = "/api/voice/fallback";

export function callIdFromTwilio(callSid: string): string {
  const safe = callSid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return safe ? `call_twilio_${safe}` : newId("call_live");
}

function fallbackTranscript(company: Company): TranscriptTurn[] {
  const text =
    company.defaultLanguage === "en"
      ? `Thank you for calling ${company.name}. One moment, we're connecting you.`
      : `Merci d'appeler ${company.name}. Un instant, nous vous mettons en relation.`;
  return [{ speaker: "agent", text, atMs: 0, lang: company.defaultLanguage }];
}

/**
 * Persiste l'appel de repli (statut "transferred") + preuve + audit.
 * Idempotent par callSid : un retry Twilio ou un double callback `action`
 * ne crée ni doublon d'appel, ni doublon de preuve/audit.
 */
export async function persistFallbackCall(opts: {
  company: Company;
  callSid: string;
  from: string;
  signatureVerified: boolean;
  transferReason?: string;
}): Promise<void> {
  const store = getStore();
  if (opts.callSid && opts.callSid !== "inconnu") {
    const existing = await store.findCallByExternalId(opts.company.id, opts.callSid);
    if (existing) return;
  }
  const agent = await store.getAgentByCompany(opts.company.id);
  const script = agent ? getScriptById(agent.qualificationScriptId) : undefined;
  const now = new Date().toISOString();
  const call: Call = {
    id: callIdFromTwilio(opts.callSid),
    companyId: opts.company.id,
    direction: "inbound",
    status: "transferred",
    source: "live",
    fromNumber: opts.from || "inconnu",
    language: opts.company.defaultLanguage,
    startedAt: now,
    durationSec: 1,
    scriptId: script?.id,
    transcript: fallbackTranscript(opts.company),
    provenance: {
      provider: "twilio",
      externalId: opts.callSid,
      verifiedAt: opts.signatureVerified ? now : undefined,
    },
    recordingUrl: null,
  };
  if (script) {
    call.intelligence = intelligenceEngine.analyze(call, script, {
      transferred: true,
      transferReason: opts.transferReason ?? "Repli humain Twilio: service realtime absent.",
    });
  }

  const actions = call.intelligence ? planActionsForCall(call, opts.company) : [];
  await store.addCall(call, actions);
  await store.saveReadinessEvidence({
    id: `evidence_${call.id}`,
    companyId: opts.company.id,
    kind: "live_call",
    status: opts.signatureVerified ? "verified" : "configured_not_verified",
    label: opts.signatureVerified ? "Webhook Twilio signé vérifié" : "Webhook Twilio sans signature vérifiée",
    detail: `Appel entrant Twilio ${opts.callSid || "inconnu"} routé vers ${opts.company.id} puis transféré en repli humain.`,
    callId: call.id,
    externalId: opts.callSid || undefined,
    verifiedAt: opts.signatureVerified ? now : undefined,
    createdAt: now,
  });
  await store.recordAudit({
    companyId: opts.company.id,
    actor: "twilio",
    event: "appel_live_repli_persisté",
    detail: `${call.id} · Twilio ${opts.callSid || "?"} · transfert vers humain`,
  });
}
