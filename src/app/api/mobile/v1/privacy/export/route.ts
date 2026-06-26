import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { requireMobileBearer } from "@/server/mobile-auth";
import { buildCompanyPrivacyExport } from "@/services/privacy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = requireMobileBearer(req);
  if (authError) return authError;
  return NextResponse.json(await buildCompanyPrivacyExport(getStore(), await resolveCompanyId()));
}
