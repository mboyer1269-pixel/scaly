/**
 * POST /api/voice/incoming — webhook Twilio Voice (appel entrant).
 * Chaîne : Twilio → ce webhook → TwiML <Connect><Stream> vers scaly-realtime.
 * Règle produit : le téléphone ne casse JAMAIS — sans SCALY_REALTIME_WS_URL,
 * repli honnête : court message + <Dial> vers le numéro humain de l'entreprise.
 *
 * Sécurité : si TWILIO_AUTH_TOKEN est défini, la signature X-Twilio-Signature
 * est vérifiée (HMAC-SHA1 de l'URL publique + paramètres). Sans token (dev
 * local), la vérification est sautée et tracée dans l'audit.
 */
import { getStore } from "@/server/store";
import { relaySessionToken, twimlConnectRelay, twimlConnectStream, twimlFallbackTransfer, validateTwilioSignature } from "@/server/twilio";
import { resolveTwilioTenant } from "@/server/twilio-tenant";
import { getScriptById } from "@/data/industry-scripts";
import { intelligenceEngine } from "@/services/intelligence";
import { planActionsForCall } from "@/services/action-engine";
import { newId } from "@/lib/format";
import type { Call, TranscriptTurn } from "@/domain/call";
import type { Company } from "@/domain/company";

export const dynamic = "force-dynamic";

function xml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

const rejectXml = `<?xml version="1.0" encoding="UTF-8"?><Response><Reject /></Response>`;

function callIdFromTwilio(callSid: string): string {
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

async function persistFallbackCall(opts: {
  company: Company;
  callSid: string;
  from: string;
  signatureVerified: boolean;
}): Promise<void> {
  const store = getStore();
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
      transferReason: "Repli humain Twilio: service realtime absent.",
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

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  let signatureVerified = false;
  if (authToken) {
    // Twilio signe l'URL PUBLIQUE qu'il a appelée : SCALY_PUBLIC_URL si défini,
    // sinon reconstruite depuis les en-têtes du proxy (ngrok, Vercel).
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const base = process.env.SCALY_PUBLIC_URL ?? `${proto}://${host}`;
    const signature = req.headers.get("x-twilio-signature") ?? "";
    if (!validateTwilioSignature(authToken, `${base}/api/voice/incoming`, params, signature)) {
      return new Response("Signature Twilio invalide", { status: 403 });
    }
    signatureVerified = true;
  }

  const store = getStore();
  const resolved = await resolveTwilioTenant(store, params);
  if (resolved.status !== "matched") {
    await store.recordAudit({
      actor: "twilio",
      event: "appel_entrant_refusé",
      detail:
        resolved.status === "ambiguous"
          ? `Numéro appelé ambigu ${resolved.calledNumber} → ${resolved.companyIds.join(", ")}`
          : resolved.status === "not_found"
            ? `Numéro appelé non mappé ${resolved.calledNumber}`
            : "Numéro appelé absent du payload Twilio",
    });
    return xml(rejectXml);
  }

  const callSid = params["CallSid"] ?? "inconnu";
  const from = params["From"] ?? "inconnu";
  await store.recordAudit({
    companyId: resolved.company.id,
    actor: "twilio",
    event: "appel_entrant_reçu",
    detail: `${callSid} de ${from} vers ${resolved.calledNumber}${authToken ? "" : " · signature NON vérifiée (TWILIO_AUTH_TOKEN absent)"}`,
  });

  const relayWsUrl = process.env.SCALY_RELAY_WS_URL;
  if (process.env.SCALY_VOICE_ENGINE === "relay" && relayWsUrl) {
    const agent = await store.getAgentByCompany(resolved.company.id);
    const script = agent ? getScriptById(agent.qualificationScriptId) : undefined;
    if (agent && script) {
      const greeting = (agent.greetingScript || script.greeting)
        .replace(/\{company\}/g, resolved.company.name)
        .replace(/\{agent\}/g, agent.displayName);
      await store.recordAudit({
        companyId: resolved.company.id,
        actor: "twilio",
        event: "prototype_relay_servi",
        detail: `${callSid} -> ConversationRelay (${process.env.SCALY_RELAY_TTS_PROVIDER ?? "Amazon"}/${process.env.SCALY_RELAY_VOICE ?? "Gabrielle-Neural"})`,
      });
      const relayParameters: Record<string, string> = { companyId: resolved.company.id, callSid, from, greeting };
      if (process.env.REALTIME_SHARED_SECRET) {
        relayParameters.relayToken = relaySessionToken(process.env.REALTIME_SHARED_SECRET, {
          companyId: resolved.company.id,
          callSid,
          from,
        });
      }
      return xml(
        twimlConnectRelay(
          relayWsUrl,
          {
            welcomeGreeting: greeting,
            language: process.env.SCALY_RELAY_LANGUAGE ?? "fr-CA",
            ttsProvider: process.env.SCALY_RELAY_TTS_PROVIDER ?? "Amazon",
            voice: process.env.SCALY_RELAY_VOICE ?? "Gabrielle-Neural",
            transcriptionProvider: process.env.SCALY_RELAY_STT_PROVIDER ?? "Google",
            speechModel: process.env.SCALY_RELAY_SPEECH_MODEL,
          },
          relayParameters,
        ),
      );
    }
  }

  const wsUrl = process.env.SCALY_REALTIME_WS_URL;
  if (!wsUrl) {
    // Repli : pas de service temps réel → l'humain prend l'appel directement.
    await persistFallbackCall({ company: resolved.company, callSid, from, signatureVerified });
    return xml(twimlFallbackTransfer({ to: resolved.company.transferPhone, lang: resolved.company.defaultLanguage, companyName: resolved.company.name }));
  }

  return xml(
    twimlConnectStream(wsUrl, {
      companyId: resolved.company.id,
      callSid,
      from,
    }),
  );
}
