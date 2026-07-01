/** GET /api/review-requests — demandes d'avis par tenant. */
import { NextResponse } from "next/server";
import { requireTenant } from "@/server/tenant";
import { listReviewRequests } from "@/services/review-requests";
import type { ReviewRequestStatus } from "@/domain/review-request";

export const dynamic = "force-dynamic";

const STATUSES: ReviewRequestStatus[] = ["eligible", "drafted", "sent", "skipped", "failed"];

export async function GET(req: Request) {
  const tenant = await requireTenant();
  if ("block" in tenant) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  const statusParam = new URL(req.url).searchParams.get("status");
  const status = STATUSES.find((value) => value === statusParam);
  const requests = await listReviewRequests(tenant.companyId, status ? { status } : {});
  return NextResponse.json({ requests });
}
