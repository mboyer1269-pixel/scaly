/**
 * GET/POST /api/gap-recovery/gaps — remplissage intelligent des annulations.
 *
 * POST : « une plage vient de se libérer » (annulation au comptoir, no-show…)
 * → persiste la plage, matche les candidats consentants du tenant et PRÉPARE
 * les offres (l'envoi SMS réel passe par le consent gate + Twilio configuré).
 * GET : l'état de la boucle pour le tenant (plages, liste d'attente, offres).
 *
 * Tenant : resolveCompanyId() côté session (ADR-017) — jamais d'id client.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import {
  GapRecoveryError,
  getGapRecoveryRepository,
  openAppointmentGap,
  sendPreparedOffers,
  type RecoverySmsPort,
} from "@/services/gap-recovery";
import { isSmsConfigured, sendSms } from "@/adapters/integrations/twilio-sms";
import { isJsonObject } from "@/lib/request-body";

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await resolveCompanyId();
  const repo = getGapRecoveryRepository();
  const [gaps, waitlist, offers] = await Promise.all([
    repo.listGaps(companyId),
    repo.listWaitlistEntries(companyId),
    repo.listOffers(companyId),
  ]);
  return NextResponse.json({ gaps, waitlist, offers });
}

export async function POST(req: Request) {
  const companyId = await resolveCompanyId();
  const company = await getStore().getCompany(companyId);
  if (!company) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!isJsonObject(body) || typeof body.humanLabel !== "string" || !body.humanLabel.trim()) {
    return NextResponse.json({ error: "humanLabel (libellé humain de la plage) est requis" }, { status: 400 });
  }

  const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  try {
    const result = await openAppointmentGap(
      {
        companyId,
        humanLabel: body.humanLabel.trim(),
        serviceCategory: str(body.serviceCategory),
        serviceLabel: str(body.serviceLabel),
        startsAt: str(body.startsAt),
        endsAt: str(body.endsAt),
        idempotencyKey: str(body.idempotencyKey),
        source: "manual",
      },
      company,
    );

    // Envoi immédiat des offres consenties si Twilio est branché ; sinon elles
    // restent PRÉPARÉES et visibles (honnête — même contrat que le rescue SMS).
    const smsPort: RecoverySmsPort | undefined = isSmsConfigured()
      ? { send: async (to, bodyText) => ({ deliveryId: (await sendSms(to, bodyText)).sid }) }
      : undefined;
    const consents = await getStore().listConsents(companyId);
    const delivery = await sendPreparedOffers(company, consents, smsPort);

    return NextResponse.json({
      gap: result.gap,
      offers: await getGapRecoveryRepository().listOffers(companyId, result.gap.id),
      idempotent: result.idempotent,
      sent: delivery.sent.length,
    });
  } catch (err) {
    if (err instanceof GapRecoveryError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
