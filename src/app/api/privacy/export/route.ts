import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { requireClaimedTenant } from "@/server/tenant";
import { buildCompanyPrivacyExport } from "@/services/privacy";

export const dynamic = "force-dynamic";

/**
 * Export des données (portabilité, Loi 25). Fuite de données évitée : on exige
 * un tenant explicitement réclamé — jamais d'export du tenant démo/pilote via le
 * repli no-auth/démo de la résolution de tenant. Sans claim → 409, pas de dump.
 */
export async function GET() {
  const tenant = await requireClaimedTenant();
  if ("block" in tenant) {
    return NextResponse.json(
      { error: "Export indisponible : aucun tenant authentifié résolu (companyId manquant sur la session)." },
      { status: 409 },
    );
  }

  const exported = await buildCompanyPrivacyExport(getStore(), tenant.companyId);
  return NextResponse.json(exported, {
    headers: {
      "content-disposition": `attachment; filename="allo-maude-export-${tenant.companyId}.json"`,
    },
  });
}
