/** GET /api/actions — liste des actions (filtre : status, callId). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { requireTenant } from "@/server/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const callId = url.searchParams.get("callId") ?? undefined;
  const tenant = await requireTenant();
  if ("block" in tenant) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  let actions = await getStore().listActions(tenant.companyId, callId);
  if (status) actions = actions.filter((a) => a.status === status);
  return NextResponse.json({ actions });
}
