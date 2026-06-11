/** GET /api/calls/:id — détail d'un appel + ses actions. */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const call = await store.getCall(params.id);
  if (!call) return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
  const actions = await store.listActions(undefined, call.id);
  return NextResponse.json({ call, actions });
}
