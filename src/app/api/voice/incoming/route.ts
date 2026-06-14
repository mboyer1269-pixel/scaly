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
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { getScriptById } from "@/data/industry-scripts";
import { twimlConnectRelay, twimlConnectStream, twimlFallbackTransfer, validateTwilioSignature } from "@/server/twilio";

export const dynamic = "force-dynamic";

function xml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
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
  }

  const store = getStore();
  const company = await store.getCompany(DEFAULT_COMPANY_ID);
  if (!company) return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject /></Response>`, 200);

  const callSid = params["CallSid"] ?? "inconnu";
  const from = params["From"] ?? "inconnu";
  await store.recordAudit({
    companyId: company.id,
    actor: "twilio",
    event: "appel_entrant_reçu",
    detail: `${callSid} de ${from}${authToken ? "" : " · signature NON vérifiée (TWILIO_AUTH_TOKEN absent)"}`,
  });

  // --- Prototype A/B ConversationRelay (voix fr-CA native) ---
  // Activé UNIQUEMENT par SCALY_VOICE_ENGINE=relay : on retire la variable,
  // le champion Media Streams reprend tel quel. Jamais les deux à la fois —
  // <Connect><Stream> et <Connect><ConversationRelay> s'excluent par appel.
  const relayWsUrl = process.env.SCALY_RELAY_WS_URL;
  if (process.env.SCALY_VOICE_ENGINE === "relay" && relayWsUrl) {
    const agent = await store.getAgentByCompany(company.id);
    const script = agent ? getScriptById(agent.qualificationScriptId) : undefined;
    if (agent && script) {
      // Même accueil que le prompt champion : celui du proprio (/agent) prime,
      // celui du script d'industrie sert de repli.
      const greeting = (agent.greetingScript || script.greeting)
        .replace(/\{company\}/g, company.name)
        .replace(/\{agent\}/g, agent.displayName);
      await store.recordAudit({
        companyId: company.id,
        actor: "twilio",
        event: "prototype_relay_servi",
        detail: `${callSid} → ConversationRelay (${process.env.SCALY_RELAY_TTS_PROVIDER ?? "Amazon"}/${process.env.SCALY_RELAY_VOICE ?? "Gabrielle-Neural"})`,
      });
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
          { companyId: company.id, callSid, from, greeting },
        ),
      );
    }
    // Contexte incomplet pour le prototype : on retombe sur le champion.
  }

  const wsUrl = process.env.SCALY_REALTIME_WS_URL;
  if (!wsUrl) {
    // Repli : pas de service temps réel → l'humain prend l'appel directement.
    return xml(twimlFallbackTransfer({ to: company.transferPhone, lang: company.defaultLanguage, companyName: company.name }));
  }

  return xml(
    twimlConnectStream(wsUrl, {
      companyId: company.id,
      callSid,
      from,
    }),
  );
}
