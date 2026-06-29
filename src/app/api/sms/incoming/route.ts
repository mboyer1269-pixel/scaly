/**
 * POST /api/sms/incoming — webhook Twilio Messaging : répondre au texto,
 * c'est parler à sa réceptionniste (P3.2).
 * v1 DÉTERMINISTE : mots-clés CHAUDS / MÉCONTENTS / À SAUVER / RÉSUMÉ / AIDE.
 * Sécurité : signature Twilio vérifiée (même contrat que /api/voice/incoming),
 * et SEUL le numéro du propriétaire (transferPhone) reçoit les données —
 * tout autre expéditeur obtient une réponse générique sans information.
 */
import { getStore } from "@/server/store";
import { validateTwilioSignature, xmlEscape } from "@/server/twilio";
import { resolveTwilioTenant } from "@/server/twilio-tenant";
import { answerOwnerKeyword, parseOwnerKeyword } from "@/services/digest";
import { isRevocationMessage } from "@/services/consent";
import { canonicalPhone } from "@/domain/consent";

export const dynamic = "force-dynamic";

function smsReply(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(body)}</Message></Response>`,
    { headers: { "Content-Type": "text/xml; charset=utf-8" } },
  );
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
  const resolved = await resolveTwilioTenant(store, params);
  if (resolved.status !== "matched") {
    await store.recordAudit({
      actor: "twilio",
      event: "sms_entrant_refusé",
      detail:
        resolved.status === "ambiguous"
          ? `Numéro appelé ambigu ${resolved.calledNumber} → ${resolved.companyIds.join(", ")}`
          : resolved.status === "not_found"
            ? `Numéro appelé non mappé ${resolved.calledNumber}`
            : "Numéro appelé absent du payload Twilio",
    });
    return smsReply("Service indisponible.");
  }
  const company = resolved.company;

  const from = params["From"] ?? "";
  const body = params["Body"] ?? "";

  // RÉVOCATION (ADR-018) — AVANT tout : « STOP / ARRÊT » de N'IMPORTE QUI
  // révoque ses consentements immédiatement. Loi 25 : le retrait doit être
  // aussi simple que le consentement.
  if (isRevocationMessage(body)) {
    const revoked = await store.revokeConsents(company.id, from, `SMS « ${body.trim().slice(0, 20)} »`);
    await store.recordAudit({
      companyId: company.id,
      actor: "twilio",
      event: "consentement_révoqué",
      detail: `${from} · ${revoked} consentement(s) révoqué(s) par texto — plus aucune relance automatique.`,
    });
    return smsReply("C'est noté : vous ne recevrez plus de rappels ni de textos de suivi de notre part. / You will no longer receive follow-up calls or texts from us.");
  }

  // Seul le propriétaire parle à sa réceptionniste — jamais de données à un tiers.
  if (canonicalPhone(from) !== canonicalPhone(company.transferPhone)) {
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
