import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { requireClaimedTenant } from "@/server/tenant";
import { requireMobileBearer } from "@/server/mobile-auth";
import { deleteCompanyAccountData } from "@/services/privacy";

export const dynamic = "force-dynamic";

/**
 * Suppression de compte mobile — DESTRUCTRICE. Le bearer partagé prouve
 * l'application, pas l'utilisateur : il ne borne aucun tenant. On exige donc
 * en plus un tenant explicitement réclamé (claim de session), sinon la requête
 * effacerait le tenant démo par repli. Tant que le mobile ne porte pas de claim
 * companyId propre, cette route bloque — c'est volontaire (jamais de repli démo).
 */
export async function POST(req: Request) {
  const authError = requireMobileBearer(req);
  if (authError) return authError;

  const tenant = await requireClaimedTenant();
  if ("block" in tenant) {
    return NextResponse.json(
      { error: "Suppression indisponible : aucun tenant authentifié résolu (companyId manquant)." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { confirmation?: unknown };
  if (body.confirmation !== "SUPPRIMER ALLO MAUDE") {
    return NextResponse.json({ error: "Confirmation requise : SUPPRIMER ALLO MAUDE" }, { status: 400 });
  }

  return NextResponse.json(await deleteCompanyAccountData(getStore(), tenant.companyId, "owner-mobile"));
}
