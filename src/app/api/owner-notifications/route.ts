/** GET /api/owner-notifications — actions owner-facing par tenant. */
import { NextResponse } from "next/server";
import { requireTenant } from "@/server/tenant";
import { listOwnerNotifications } from "@/services/owner-notifications";
import type { OwnerNotificationStatus } from "@/domain/owner-notification";

export const dynamic = "force-dynamic";

const STATUSES: OwnerNotificationStatus[] = ["pending", "sent", "failed", "dismissed"];

export async function GET(req: Request) {
  const tenant = await requireTenant();
  if ("block" in tenant) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  const statusParam = new URL(req.url).searchParams.get("status");
  const status = STATUSES.find((value) => value === statusParam);
  const notifications = await listOwnerNotifications(tenant.companyId, status ? { status } : {});
  return NextResponse.json({ notifications });
}
