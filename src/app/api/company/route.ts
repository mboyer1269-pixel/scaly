/** GET/PUT /api/company — configuration de l'entreprise (tenant démo). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId, requireTenant } from "@/server/tenant";
import type { Company } from "@/domain/company";
import { normalizeCoveragePolicy } from "@/services/coverage";
import { isJsonObject, pickJsonFields } from "@/lib/request-body";

export const dynamic = "force-dynamic";

export async function GET() {
  const company = await getStore().getCompany(await resolveCompanyId());
  if (!company) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ company });
}

export async function PUT(req: Request) {
  const tenant = await requireTenant();
  if ("block" in tenant) return NextResponse.json({ error: "Tenant authentifié requis." }, { status: 409 });
  const companyId = tenant.companyId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "Un objet JSON est requis" }, { status: 400 });
  }
  const patch = pickJsonFields<Company>(body, [
    "name",
    "businessDescription",
    "sectorLabel",
    "ownerName",
    "ownerEmail",
    "mainPhone",
    "transferPhone",
    "city",
    "languages",
    "defaultLanguage",
    "tone",
    "hours",
    "escalationRules",
    "essentialQuestions",
    "services",
    "serviceAreas",
    "policies",
    "followUp",
    "coverage",
    "compliance",
  ]);
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
  const company = await getStore().updateCompany(companyId, patch);
  if (!company) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ company });
}
