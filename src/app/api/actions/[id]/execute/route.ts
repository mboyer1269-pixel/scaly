/** POST /api/actions/:id/execute — exécute une action (mock, avec audit trail). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { executeAction } from "@/services/action-engine";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const action = await store.getAction(params.id);
  if (!action) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  const result = executeAction(action);
  await store.saveAction(result);
  return NextResponse.json({ action: result });
}
