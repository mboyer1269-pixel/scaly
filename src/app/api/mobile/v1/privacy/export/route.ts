import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { requireClaimedTenant } from "@/server/tenant";
import { requireMobileBearer } from "@/server/mobile-auth";
import { buildCompanyPrivacyExport } from "@/services/privacy";

export const dynamic = "force-dynamic";

/**
 * Export mobile — le bearer partagé prouve l'app, pas l'utilisateur, et ne borne
 * aucun tenant. On exige donc en plus un tenant réclamé : sinon la requête
 * exporterait le tenant démo par repli. Sans claim → 409, pas de dump.
 */
export async function GET(req: Request) {
  const authError = requireMobileBearer(req);
  if (authError) return authError;

  const tenant = await requireClaimedTenant();
  if ("block" in tenant) {
    return NextResponse.json(
      { error: "Export indisponible : aucun tenant authentifié résolu (companyId manquant)." },
      { status: 409 },
    );
  }

  return NextResponse.json(await buildCompanyPrivacyExport(getStore(), tenant.companyId));
}
