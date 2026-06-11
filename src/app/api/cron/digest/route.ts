/**
 * GET/POST /api/cron/digest — le pouls quotidien par texto (P3.2) + la
 * planification des suivis de soumission J+2 (P3.3).
 * Protégé par CRON_SECRET (même contrat que /api/cron/purge).
 * À céduler vers `followUp.dailyDigestHour` (ex. Vercel Cron 21h UTC = 17h QC).
 *
 * Envoi : Twilio configuré → SMS RÉEL au propriétaire (transferPhone) ;
 * sinon, le pouls est journalisé dans l'audit — jamais de faux « envoyé ».
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { buildDailyDigest } from "@/services/digest";
import { alertAlreadySent, buildOverageAlert, overageAuditDetail, OVERAGE_AUDIT_EVENT } from "@/services/overage";
import { planQuoteFollowUps } from "@/services/follow-up";
import { executeActionLive } from "@/services/action-engine";
import { isSmsConfigured, sendSms } from "@/adapters/integrations/twilio-sms";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configuré — digest refusé." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const store = getStore();
  const results: { companyId: string; sent: boolean; followUpsPlanned: number; detail: string }[] = [];

  for (const company of await store.listCompanies()) {
    const calls = await store.listCalls(company.id);
    const actions = await store.listActions(company.id);

    // 1) Suivis de soumission J+2 (consentement obligatoire) — planifiés puis tentés.
    const followUps = planQuoteFollowUps(company, calls, actions);
    for (const fu of followUps) {
      const executed = await executeActionLive(fu);
      await store.saveAction(executed);
    }

    // 2) Pouls du jour au propriétaire.
    const digest = buildDailyDigest(company, calls, actions);
    let sent = false;
    let detail: string;
    if (isSmsConfigured()) {
      try {
        const r = await sendSms(company.transferPhone, digest.smsText);
        sent = true;
        detail = `SMS réel ${r.sid} → ${company.transferPhone}`;
      } catch (err) {
        detail = `Échec d'envoi : ${err instanceof Error ? err.message : String(err)}`;
      }
    } else {
      detail = "Twilio non configuré — pouls journalisé seulement (aucun SMS réel).";
    }
    await store.recordAudit({
      companyId: company.id,
      actor: "system",
      event: "pouls_quotidien",
      detail: `${sent ? "ENVOYÉ" : "NON ENVOYÉ"} · ${digest.hotCount} chauds, ${digest.unhappyCount} mécontents, ${digest.savedCount} sauvés, ${followUps.length} suivi(s) J+2 · ${detail}`,
    });
    // 3) Alerte de dépassement de minutes (P4) — une seule par seuil et par mois.
    const alert = buildOverageAlert(company, calls);
    if (alert && !alertAlreadySent(await store.getAuditLog(300), company.id, alert)) {
      let alertStatus: "envoye" | "journalise" | "echec" = "journalise";
      if (isSmsConfigured()) {
        try {
          await sendSms(company.transferPhone, alert.smsText);
          alertStatus = "envoye";
        } catch {
          alertStatus = "echec"; // non dédupliqué : retentée au prochain passage
        }
      }
      await store.recordAudit({
        companyId: company.id,
        actor: "system",
        event: OVERAGE_AUDIT_EVENT,
        detail: overageAuditDetail(alert, alertStatus),
      });
    }

    results.push({ companyId: company.id, sent, followUpsPlanned: followUps.length, detail });
  }

  return NextResponse.json({ ok: true, results, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
