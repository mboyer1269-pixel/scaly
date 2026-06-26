import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompany } from "@/server/tenant";
import { requireMobileBearer } from "@/server/mobile-auth";
import { computeRescueQueue } from "@/services/rescue";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = requireMobileBearer(req);
  if (authError) return authError;

  const company = await resolveCompany();
  if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
  const store = getStore();
  const [calls, actions] = await Promise.all([
    store.listCalls(company.id),
    store.listActions(company.id),
  ]);
  return NextResponse.json({
    rescue: computeRescueQueue(company, calls, actions).slice(0, 10),
    actions: actions.filter((action) => ["pending", "failed", "requires_config"].includes(action.status)).slice(0, 50),
  });
}
