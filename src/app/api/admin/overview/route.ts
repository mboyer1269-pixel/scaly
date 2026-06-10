/** GET /api/admin/overview — cockpit fondateur (MRR, minutes, coûts IA estimés). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { computeAdminOverview } from "@/services/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  const rows = store.listCompanies().map((company) => ({ company, calls: store.listCalls(company.id) }));
  return NextResponse.json({ overview: computeAdminOverview(rows), audit: store.getAuditLog(20) });
}
