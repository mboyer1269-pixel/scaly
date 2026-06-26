import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { buildCompanyPrivacyExport } from "@/services/privacy";

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await resolveCompanyId();
  const exported = await buildCompanyPrivacyExport(getStore(), companyId);
  return NextResponse.json(exported, {
    headers: {
      "content-disposition": `attachment; filename="allo-maude-export-${companyId}.json"`,
    },
  });
}
