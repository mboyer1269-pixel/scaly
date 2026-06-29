/**
 * POST /api/actions/:id/execute — exécute une action.
 * SMS avec Twilio configuré → envoi RÉEL (audit + SID) ; sinon mock honnête.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { executeAction, executeActionLive } from "@/services/action-engine";
import { getSessionRole } from "@/server/auth";
import { requireTenant } from "@/server/tenant";
import { actionBelongsToCompany, canExecuteLiveActions } from "@/services/action-execution-policy";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = getStore();
  const { id } = await params;
  const action = await store.getAction(id);
  const [tenant, role] = await Promise.all([requireTenant(), getSessionRole()]);
  if ("block" in tenant) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  if (
    !action ||
    (!actionBelongsToCompany(action, tenant.companyId) && role !== "founder")
  ) {
    return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  }
  const live = canExecuteLiveActions(store.info(), process.env.ALLOW_LIVE_ACTIONS);
  const result = live ? await executeActionLive(action) : executeAction(action);
  await store.saveAction(result);
  return NextResponse.json({ action: result, executionMode: live ? "live" : "mock" });
}
