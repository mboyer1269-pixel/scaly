/**
 * PUT /api/gap-recovery/offers/[offerId] — action du propriétaire sur une offre :
 * confirm (la personne a dit oui, la plage est comblée), decline (elle a dit non),
 * cancel (le propriétaire retire l'offre — raison conservée).
 * Tenant : resolveCompanyId() côté session (ADR-017) — une offre d'un autre
 * tenant est introuvable, jamais divulguée.
 */
import { NextResponse } from "next/server";
import { resolveCompanyId } from "@/server/tenant";
import {
  GapRecoveryError,
  cancelRecoveryOffer,
  confirmRecoveryOffer,
  declineRecoveryOffer,
} from "@/services/gap-recovery";
import { isJsonObject } from "@/lib/request-body";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ offerId: string }> }) {
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
    const offer =
      action === "confirm"
        ? await confirmRecoveryOffer(companyId, offerId)
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
