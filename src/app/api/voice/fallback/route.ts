/**
 * POST /api/voice/fallback — callback `action` de <Connect> (Stream et
 * ConversationRelay). Twilio requête cette URL quand le stream se termine.
 * Deux cas :
 *  - L'appel est FINI (CallStatus completed/…) : l'appelant a raccroché, fin
 *    normale — le TwiML retourné est ignoré par Twilio, on répond <Hangup/>.
 *  - L'appel est ENCORE ACTIF : le pont realtime est injoignable ou a crashé
 *    (il ne ferme jamais le WS en fin normale) → <Dial> vers l'humain.
 *    Le téléphone ne casse JAMAIS.
 *
 * Sécurité : même vérification X-Twilio-Signature que /api/voice/incoming.
 */
import { getStore } from "@/server/store";
import { twimlFallbackTransfer, validateTwilioSignature } from "@/server/twilio";
import { resolveTwilioTenant } from "@/server/twilio-tenant";
import { persistFallbackCall } from "@/server/voice-fallback";
import { tryAppendRuntimeEvent } from "@/services/event-outbox";
import { redactPhone } from "@/domain/runtime-event";

export const dynamic = "force-dynamic";

function xml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

const hangupXml = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup /></Response>`;

/** Statuts Twilio où l'appel est déjà terminé — plus personne à transférer. */
const ENDED_STATUSES = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  let signatureVerified = false;
  if (authToken) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const base = process.env.SCALY_PUBLIC_URL ?? `${proto}://${host}`;
    const signature = req.headers.get("x-twilio-signature") ?? "";
    if (!validateTwilioSignature(authToken, `${base}/api/voice/fallback`, params, signature)) {
      return new Response("Signature Twilio invalide", { status: 403 });
    }
    signatureVerified = true;
  }

  const store = getStore();
  const resolved = await resolveTwilioTenant(store, params);
  if (resolved.status !== "matched") {
    // Aucun tenant → aucun numéro humain vers qui transférer.
    await store.recordAudit({
      actor: "twilio",
      event: "repli_stream_sans_tenant",
      detail: `Callback action sans tenant résolu (${params["CallSid"] ?? "?"}, statut ${resolved.status})`,
    });
    return xml(hangupXml);
  }

  const callSid = params["CallSid"] ?? "inconnu";
  const from = params["From"] ?? "inconnu";
  const callStatus = (params["CallStatus"] ?? "").toLowerCase();
  const streamError = params["StreamError"] ?? params["ErrorMessage"] ?? "";

  if (ENDED_STATUSES.has(callStatus)) {
    // Fin normale (l'appelant a raccroché) : rien à secourir. On trace quand
    // même une erreur de stream éventuelle pour le diagnostic prod.
    if (streamError) {
      await store.recordAudit({
        companyId: resolved.company.id,
        actor: "twilio",
        event: "stream_erreur_appel_terminé",
        detail: `${callSid} · ${streamError}`,
      });
    }
    return xml(hangupXml);
  }

  // Appel encore actif + stream terminé = pont down/crashé → transfert humain.
  await store.recordAudit({
    companyId: resolved.company.id,
    actor: "twilio",
    event: "repli_pont_indisponible",
    detail: `${callSid} de ${from} · statut ${callStatus || "?"}${streamError ? ` · ${streamError}` : ""} · <Dial> ${resolved.company.transferPhone}`,
  });
  // Frontière (ADR-020) : LA panne runtime de production — le pont était censé
  // prendre l'appel et ne l'a pas fait. Distinct de runtime.realtime_unavailable
  // (choix de config) : ici quelque chose a cassé en plein vol.
  await tryAppendRuntimeEvent({
    companyId: resolved.company.id,
    type: "runtime.failure",
    correlationId: callSid,
    externalId: callSid !== "inconnu" ? callSid : undefined,
    payload: {
      component: "realtime_bridge",
      phone: redactPhone(from),
      callStatus: callStatus || null,
      streamError: streamError || null,
      recoveredVia: "human_fallback",
    },
  });
  await persistFallbackCall({
    company: resolved.company,
    callSid,
    from,
    signatureVerified,
    transferReason: `Repli humain Twilio: stream realtime interrompu${streamError ? ` (${streamError})` : ""}.`,
  });
  return xml(
    twimlFallbackTransfer({
      to: resolved.company.transferPhone,
      lang: resolved.company.defaultLanguage,
      companyName: resolved.company.name,
    }),
  );
}
