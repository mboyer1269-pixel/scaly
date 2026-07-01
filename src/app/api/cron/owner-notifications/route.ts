/**
 * GET/POST /api/cron/owner-notifications — livre les notifications propriétaire
 * en attente. Protégé par CRON_SECRET (même contrat que /api/cron/digest).
 *
 * Twilio configuré → SMS RÉEL au propriétaire (transferPhone) ; sinon chaque
 * tentative est marquée `failed` (sms_not_configured) — jamais de faux « envoyé ».
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { deliverPendingOwnerNotifications } from "@/services/owner-notification-delivery";
import { TwilioOwnerNotificationDelivery } from "@/adapters/integrations/owner-notification-sms";
import { isSmsConfigured } from "@/adapters/integrations/twilio-sms";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configuré — livraison refusée." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const store = getStore();
  const smsReady = isSmsConfigured();
  const results: { companyId: string; attempted: number; delivered: number; failed: number }[] = [];

  for (const company of await store.listCompanies()) {
    const delivery = new TwilioOwnerNotificationDelivery({ to: company.transferPhone });
    const summary = await deliverPendingOwnerNotifications(company.id, delivery);
    if (summary.attempted > 0) {
      await store.recordAudit({
        companyId: company.id,
        actor: "system",
        event: "owner_notifications_delivery",
        detail: `${smsReady ? "SMS réel" : "non configuré"} · ${summary.delivered} envoyée(s), ${summary.failed} échec(s) sur ${summary.attempted}`,
      });
    }
    results.push({ companyId: company.id, attempted: summary.attempted, delivered: summary.delivered, failed: summary.failed });
  }

  return NextResponse.json({ ok: true, smsConfigured: smsReady, results, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
