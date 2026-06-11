/**
 * POST /api/actions/:id/execute — exécute une action.
 * SMS avec Twilio configuré → envoi RÉEL (audit + SID) ; sinon mock honnête.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { executeActionLive } from "@/services/action-engine";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const action = await store.getAction(params.id);
  if (!action) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  const result = await executeActionLive(action);
  await store.saveAction(result);
  return NextResponse.json({ action: result });
}
