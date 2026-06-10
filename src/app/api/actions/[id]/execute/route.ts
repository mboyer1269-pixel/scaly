/** POST /api/actions/:id/execute — exécute une action (mock, avec audit trail). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { executeAction } from "@/services/action-engine";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const action = getStore().getAction(params.id);
  if (!action) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  const result = executeAction(action);
  return NextResponse.json({ action: result });
}
