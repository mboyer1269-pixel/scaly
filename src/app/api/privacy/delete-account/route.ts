import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { requireClaimedTenant } from "@/server/tenant";
import { getSessionRole } from "@/server/auth";
import { deleteCompanyAccountData } from "@/services/privacy";

export const dynamic = "force-dynamic";

/**
 * Suppression de compte (droit à l'effacement, Loi 25) — opération DESTRUCTRICE.
 * Barrières, dans l'ordre :
 *  1. Rôle : owner ou founder seulement (jamais staff).
 *  2. Tenant : un claim réel exigé — jamais de suppression sur le repli démo /
 *     no-auth, donc jamais sur DEFAULT_COMPANY_ID par accident.
 *  3. Phrase de confirmation exacte.
 * (La session Clerk elle-même est déjà exigée par le middleware : cette route
 * n'est pas dans l'allowlist publique.)
 */
export async function POST(req: Request) {
  const role = await getSessionRole();
  if (role !== "owner" && role !== "founder") {
    return NextResponse.json(
      { error: "Suppression de compte réservée au propriétaire du compte." },
      { status: 403 },
    );
  }

  const tenant = await requireClaimedTenant();
  if ("block" in tenant) {
    return NextResponse.json(
      {
        error:
          "Suppression indisponible : aucun tenant authentifié résolu. " +
          "Connectez-vous au compte à supprimer (companyId manquant sur la session).",
      },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { confirmation?: unknown };
  if (body.confirmation !== "SUPPRIMER ALLO MAUDE") {
    return NextResponse.json({
      error: "Confirmation requise : SUPPRIMER ALLO MAUDE",
    }, { status: 400 });
  }

  const result = await deleteCompanyAccountData(getStore(), tenant.companyId, `owner-in-app:${role}`);
  return NextResponse.json(result);
}
