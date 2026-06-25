/** GET/PUT /api/company — configuration de l'entreprise (tenant démo). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import type { Company } from "@/domain/company";
import { normalizeCoveragePolicy } from "@/services/coverage";

export const dynamic = "force-dynamic";

export async function GET() {
  const company = await getStore().getCompany(resolveCompanyId());
  if (!company) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ company });
}

export async function PUT(req: Request) {
  let patch: Partial<Company>;
  try {
    patch = (await req.json()) as Partial<Company>;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  // Champs protégés : id, planId et billing (réservé au webhook Stripe) ne se modifient pas par cette route.
  delete (patch as Record<string, unknown>).id;
  delete (patch as Record<string, unknown>).planId;
  delete (patch as Record<string, unknown>).billing;
  if (patch.coverage) {
    try {
      patch.coverage = normalizeCoveragePolicy(patch.coverage);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Politique de couverture invalide" },
        { status: 400 },
      );
    }
  }
  const company = await getStore().updateCompany(resolveCompanyId(), patch);
  if (!company) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ company });
}
