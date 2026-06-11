/**
 * POST /api/onboarding/apply — application du brouillon APRÈS approbation
 * explicite (P3.4). Body : { draft, approved: true }.
 * Refuse sans approved=true ; revalide le brouillon côté serveur (jamais
 * confiance au client) ; met à jour entreprise + agent + script d'industrie
 * et trace « brouillon_approuvé » dans l'audit.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { INDUSTRY_LABELS } from "@/domain/company";
import { getScriptByIndustry } from "@/data/industry-scripts";
import { validateDraft } from "@/services/onboarding";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { draft?: Record<string, unknown>; approved?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (body.approved !== true) {
    return NextResponse.json({ error: "Approbation explicite requise — le brouillon ne s'applique jamais seul." }, { status: 403 });
  }
  if (!body.draft || typeof body.draft !== "object") {
    return NextResponse.json({ error: "Brouillon manquant" }, { status: 400 });
  }

  const store = getStore();
  const existing = await store.getCompany(DEFAULT_COMPANY_ID);
  if (!existing) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });

  const draft = validateDraft(body.draft, existing.name);
  const script = getScriptByIndustry(draft.industry);

  const company = await store.updateCompany(DEFAULT_COMPANY_ID, {
    name: draft.name,
    industry: draft.industry,
    sectorLabel: INDUSTRY_LABELS[draft.industry],
    city: draft.city,
    services: draft.services,
    serviceAreas: draft.serviceAreas,
    languages: draft.languages,
    defaultLanguage: draft.languages[0],
    tone: draft.tone,
  });
  const agent = await store.updateAgent(DEFAULT_COMPANY_ID, {
    persona: draft.persona,
    languages: draft.languages,
    qualificationScriptId: script.id,
  });

  await store.recordAudit({
    companyId: DEFAULT_COMPANY_ID,
    actor: "onboarding",
    event: "brouillon_approuvé",
    detail: `${draft.name} · ${INDUSTRY_LABELS[draft.industry]} · script ${script.id} · approuvé par le propriétaire`,
  });

  return NextResponse.json({ company, agent });
}
