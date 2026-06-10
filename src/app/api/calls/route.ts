/** GET /api/calls — liste des appels (filtres : status, urgency, intent, q). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") ?? DEFAULT_COMPANY_ID;
  const status = url.searchParams.get("status");
  const urgency = url.searchParams.get("urgency");
  const intent = url.searchParams.get("intent");
  const q = url.searchParams.get("q")?.toLowerCase();

  let calls = getStore().listCalls(companyId);
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
