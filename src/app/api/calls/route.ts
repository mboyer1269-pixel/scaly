/** GET /api/calls — liste des appels (filtres : status, urgency, intent, q). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getSessionRole } from "@/server/auth";
import { requireTenant } from "@/server/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  // ?companyId= : réservé au fondateur (vue cross-tenant de /admin) — sinon le tenant de la session.
  const requested = url.searchParams.get("companyId");
  const role = await getSessionRole();
  const tenant = requested && role === "founder" ? { companyId: requested } : await requireTenant();
  if ("block" in tenant) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  const companyId = tenant.companyId;
  const status = url.searchParams.get("status");
  const urgency = url.searchParams.get("urgency");
  const intent = url.searchParams.get("intent");
  const q = url.searchParams.get("q")?.toLowerCase();

  let calls = await getStore().listCalls(companyId);
  if (status) calls = calls.filter((c) => c.status === status);
  if (urgency) calls = calls.filter((c) => c.intelligence?.urgency === urgency);
  if (intent) calls = calls.filter((c) => c.intelligence?.intent === intent);
  if (q) {
    calls = calls.filter(
      (c) =>
        c.callerName?.toLowerCase().includes(q) ||
        c.fromNumber.includes(q) ||
        c.intelligence?.summary.toLowerCase().includes(q),
    );
  }
  return NextResponse.json({ calls });
}
