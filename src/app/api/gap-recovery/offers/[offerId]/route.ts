/**
 * PUT /api/gap-recovery/offers/[offerId] — action du propriétaire sur une offre :
 * confirm (la personne a dit oui, la plage est comblée), decline (elle a dit non),
 * cancel (le propriétaire retire l'offre — raison conservée).
 * Tenant : resolveCompanyId() côté session (ADR-017) — une offre d'un autre
 * tenant est introuvable, jamais divulguée.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import {
  GapRecoveryError,
  cancelRecoveryOffer,
  confirmRecoveryOffer,
  declineRecoveryOffer,
  type ConfirmNotifyContext,
} from "@/services/gap-recovery";
import { isSmsConfigured, sendSms } from "@/adapters/integrations/twilio-sms";
import { isJsonObject } from "@/lib/request-body";
import { clientKey, createRateLimiter, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(60, 10 * 60_000);

export async function PUT(req: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const gate = limiter.check(clientKey(req));
  if (!gate.allowed) return tooManyRequests(gate.retryAfterSec);
  const companyId = await resolveCompanyId();
  const { offerId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const action = isJsonObject(body) && typeof body.action === "string" ? body.action : "";
  const reason = isJsonObject(body) && typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "retirée par le propriétaire";

  try {
    // « Premier arrivé, premier servi » complet : confirmer préviens aussi les
    // personnes qui avaient reçu le texto que la plage est prise (consenti).
    let notify: ConfirmNotifyContext | undefined;
    if (action === "confirm") {
      const store = getStore();
      const company = await store.getCompany(companyId);
      if (company) {
        notify = {
          company,
          smsPort: isSmsConfigured()
            ? { send: async (to: string, text: string) => ({ deliveryId: (await sendSms(to, text)).sid }) }
            : undefined,
          consents: await store.listConsents(companyId),
        };
      }
    }
    const offer =
      action === "confirm"
        ? await confirmRecoveryOffer(companyId, offerId, undefined, notify)
        : action === "decline"
          ? await declineRecoveryOffer(companyId, offerId)
          : action === "cancel"
            ? await cancelRecoveryOffer(companyId, offerId, reason)
            : null;
    if (!offer) return NextResponse.json({ error: "action doit être confirm, decline ou cancel" }, { status: 400 });
    return NextResponse.json({ offer });
  } catch (err) {
    if (err instanceof GapRecoveryError) {
      const notFound = /introuvable/.test(err.message);
      return NextResponse.json({ error: err.message }, { status: notFound ? 404 : 409 });
    }
    throw err;
  }
}
