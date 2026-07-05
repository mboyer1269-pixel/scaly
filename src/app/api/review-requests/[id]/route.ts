/** POST /api/review-requests/:id — le propriétaire marque envoyé ou ignore une demande d'avis. */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { requireTenant } from "@/server/tenant";
import { markReviewRequestSent, markReviewRequestSkipped } from "@/services/review-requests";
import { isJsonObject } from "@/lib/request-body";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!isJsonObject(body)) return NextResponse.json({ error: "Un objet JSON est requis" }, { status: 400 });

  try {
    const tenant = await requireTenant();
    if ("block" in tenant) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
    const companyId = tenant.companyId;
    const { id } = await params;
    const action = body.action;
    const request =
      action === "sent"
        ? await markReviewRequestSent(companyId, id)
        : action === "skip"
          ? await markReviewRequestSkipped(companyId, id)
          : null;
    if (!request) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    await getStore().recordAudit({
      companyId,
      actor: "owner",
      event: action === "sent" ? "review_request_marked_sent" : "review_request_skipped",
      detail: request.sourceCallId ?? request.id,
    });
    return NextResponse.json({ request });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mise a jour impossible" }, { status: 404 });
  }
}
