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
import { VOICE_FALLBACK_ACTION_PATH, persistFallbackCall } from "@/server/voice-fallback";
import { getScriptById } from "@/data/industry-scripts";
import { tryAppendRuntimeEvent } from "@/services/event-outbox";
import { redactPhone } from "@/domain/runtime-event";

export const dynamic = "force-dynamic";

function xml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

const rejectXml = `<?xml version="1.0" encoding="UTF-8"?><Response><Reject /></Response>`;

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

  // Frontière (ADR-020) : le point UNIQUE par où passe 100 % des appels —
  // même événement de départ pour le repli humain, le relay et le realtime.
  const engineConfigured =
    process.env.SCALY_VOICE_ENGINE === "relay" && process.env.SCALY_RELAY_WS_URL
      ? "relay"
      : process.env.SCALY_REALTIME_WS_URL
        ? "realtime"
        : "human_fallback";
  await tryAppendRuntimeEvent({
    companyId: resolved.company.id,
    type: "call.session_started",
    correlationId: callSid,
    externalId: callSid,
    payload: {
      phone: redactPhone(from),
      calledNumber: redactPhone(resolved.calledNumber),
      engineConfigured,
      signatureVerified,
    },
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
          VOICE_FALLBACK_ACTION_PATH,
        ),
      );
    }
  }

  const wsUrl = process.env.SCALY_REALTIME_WS_URL;
  if (!wsUrl) {
    // Repli : pas de service temps réel → l'humain prend l'appel directement.
    // ≠ runtime.failure : c'est un choix de configuration, pas une panne.
    await tryAppendRuntimeEvent({
      companyId: resolved.company.id,
      type: "runtime.realtime_unavailable",
      correlationId: callSid,
      externalId: callSid,
      payload: { reason: "SCALY_REALTIME_WS_URL absente — repli <Dial> vers l'humain", phone: redactPhone(from) },
    });
    await persistFallbackCall({ company: resolved.company, callSid, from, signatureVerified });
    return xml(twimlFallbackTransfer({ to: resolved.company.transferPhone, lang: resolved.company.defaultLanguage, companyName: resolved.company.name }));
  }

  return xml(
    twimlConnectStream(
      wsUrl,
      {
        companyId: resolved.company.id,
        callSid,
        from,
      },
      VOICE_FALLBACK_ACTION_PATH,
    ),
  );
}
