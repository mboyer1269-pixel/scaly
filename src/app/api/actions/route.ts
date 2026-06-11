/** GET /api/actions — liste des actions (filtre : status, callId). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const callId = url.searchParams.get("callId") ?? undefined;
  let actions = await getStore().listActions(DEFAULT_COMPANY_ID, callId);
  if (status) actions = actions.filter((a) => a.status === status);
  return NextResponse.json({ actions });
}
