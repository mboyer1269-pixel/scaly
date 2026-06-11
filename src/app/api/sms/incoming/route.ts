/**
 * POST /api/sms/incoming — webhook Twilio Messaging : répondre au texto,
 * c'est parler à sa réceptionniste (P3.2).
 * v1 DÉTERMINISTE : mots-clés CHAUDS / MÉCONTENTS / À SAUVER / RÉSUMÉ / AIDE.
 * Sécurité : signature Twilio vérifiée (même contrat que /api/voice/incoming),
 * et SEUL le numéro du propriétaire (transferPhone) reçoit les données —
 * tout autre expéditeur obtient une réponse générique sans information.
 */
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { validateTwilioSignature, xmlEscape } from "@/server/twilio";
import { answerOwnerKeyword, parseOwnerKeyword } from "@/services/digest";

export const dynamic = "force-dynamic";

function smsReply(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(body)}</Message></Response>`,
    { headers: { "Content-Type": "text/xml; charset=utf-8" } },
  );
}

/** Normalise un numéro pour comparaison : chiffres seulement, sans le 1 initial. */
function canon(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^1/, "");
}

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const base = process.env.SCALY_PUBLIC_URL ?? `${proto}://${host}`;
    const signature = req.headers.get("x-twilio-signature") ?? "";
    if (!validateTwilioSignature(authToken, `${base}/api/sms/incoming`, params, signature)) {
      return new Response("Signature Twilio invalide", { status: 403 });
    }
  }

  const store = getStore();
  const company = await store.getCompany(DEFAULT_COMPANY_ID);
  if (!company) return smsReply("Service indisponible.");

  const from = params["From"] ?? "";
  const body = params["Body"] ?? "";

  // Seul le propriétaire parle à sa réceptionniste — jamais de données à un tiers.
  if (canon(from) !== canon(company.transferPhone)) {
    await store.recordAudit({ companyId: company.id, actor: "twilio", event: "sms_entrant_tiers", detail: `De ${from} — réponse générique sans données.` });
    return smsReply(`${company.name} : merci pour votre message ! Pour nous joindre, appelez-nous — on s'occupe de vous rapidement.`);
  }

  const keyword = parseOwnerKeyword(body);
  const calls = await store.listCalls(company.id);
  const actions = await store.listActions(company.id);
  const answer = answerOwnerKeyword(keyword, company, calls, actions);
  await store.recordAudit({ companyId: company.id, actor: "owner-sms", event: "dialogue_proprietaire", detail: `« ${body.slice(0, 40)} » → ${keyword}` });
  return smsReply(answer);
}
