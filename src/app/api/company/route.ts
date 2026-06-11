/** GET/PUT /api/company — configuration de l'entreprise (tenant démo). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import type { Company } from "@/domain/company";

export const dynamic = "force-dynamic";

export async function GET() {
  const company = await getStore().getCompany(DEFAULT_COMPANY_ID);
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
  const company = await getStore().updateCompany(DEFAULT_COMPANY_ID, patch);
  if (!company) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ company });
}
