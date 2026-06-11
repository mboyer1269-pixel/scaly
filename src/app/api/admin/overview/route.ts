/** GET /api/admin/overview — cockpit fondateur (MRR, minutes, coûts IA estimés). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { computeAdminOverview } from "@/services/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  const companies = await store.listCompanies();
  const rows = await Promise.all(companies.map(async (company) => ({ company, calls: await store.listCalls(company.id) })));
  return NextResponse.json({ overview: computeAdminOverview(rows), audit: await store.getAuditLog(20) });
}
