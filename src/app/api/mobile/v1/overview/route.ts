import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompany } from "@/server/tenant";
import { computeDashboard } from "@/services/analytics";
import { requireMobileBearer } from "@/server/mobile-auth";

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
    company: { id: company.id, name: company.name, sectorLabel: company.sectorLabel, city: company.city },
    dashboard: computeDashboard(company, calls, actions),
    store: store.info(),
  });
}
