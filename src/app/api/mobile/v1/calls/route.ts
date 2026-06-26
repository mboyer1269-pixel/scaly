import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { requireMobileBearer } from "@/server/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = requireMobileBearer(req);
  if (authError) return authError;

  const companyId = await resolveCompanyId();
  const calls = await getStore().listCalls(companyId);
  return NextResponse.json({
    calls: calls.slice(0, 50).map((call) => ({
      id: call.id,
      startedAt: call.startedAt,
      callerName: call.callerName,
      fromNumber: call.fromNumber,
      status: call.status,
      language: call.language,
      urgency: call.intelligence?.urgency,
      intent: call.intelligence?.intent,
      summary: call.intelligence?.summary,
      nextAction: call.intelligence?.nextAction,
      estimatedValueCad: call.intelligence?.estimatedValueCad,
    })),
  });
}
