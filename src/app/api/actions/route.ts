/** GET /api/actions — liste des actions (filtre : status, callId). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const callId = url.searchParams.get("callId") ?? undefined;
  let actions = await getStore().listActions(resolveCompanyId(), callId);
  if (status) actions = actions.filter((a) => a.status === status);
  return NextResponse.json({ actions });
}
