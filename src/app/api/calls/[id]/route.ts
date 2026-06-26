/** GET /api/calls/:id — détail d'un appel + ses actions. */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getSessionRole } from "@/server/auth";
import { resolveCompanyId } from "@/server/tenant";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = getStore();
  const { id } = await params;
  const call = await store.getCall(id);
  // Garde d'appartenance : un appel d'un autre tenant = introuvable (anti-IDOR), sauf fondateur.
  if (!call || (call.companyId !== await resolveCompanyId() && await getSessionRole() !== "founder")) {
    return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
  }
  const actions = await store.listActions(undefined, call.id);
  return NextResponse.json({ call, actions });
}
