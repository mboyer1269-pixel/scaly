/** POST /api/owner-notifications/dismiss — le propriétaire écarte une action traitée. */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { requireTenant } from "@/server/tenant";
import { dismissNotification } from "@/services/owner-notifications";
import { isJsonObject } from "@/lib/request-body";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!isJsonObject(body)) return NextResponse.json({ error: "Un objet JSON est requis" }, { status: 400 });
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Identifiant requis" }, { status: 400 });

  try {
    const tenant = await requireTenant();
    if ("block" in tenant) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
    const companyId = tenant.companyId;
    const notification = await dismissNotification(companyId, id);
    await getStore().recordAudit({
      companyId,
      actor: "owner",
      event: "owner_notification_dismissed",
      detail: notification.title,
    });
    return NextResponse.json({ notification });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mise a jour impossible" }, { status: 404 });
  }
}
