/**
 * POST /api/onboarding/draft — onboarding magique (P3.4).
 * Body : { url, blurb? } → { draft, sourceChars }.
 * Le brouillon n'applique RIEN : l'application passe par
 * /api/onboarding/apply après édition et approbation explicite dans /onboarding.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { draftFromWebsite, OnboardingNotConfiguredError } from "@/services/onboarding";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { url?: string; blurb?: string };
  try {
    body = (await req.json()) as { url?: string; blurb?: string };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!body.url || body.url.trim().length < 4) {
    return NextResponse.json({ error: "URL du site requise" }, { status: 400 });
  }

  try {
    const result = await draftFromWebsite(body.url.trim(), (body.blurb ?? "").slice(0, 600));
    await getStore().recordAudit({
      companyId: DEFAULT_COMPANY_ID,
      actor: "onboarding",
      event: "brouillon_genere",
      detail: `${body.url} · ${result.sourceChars} caractères analysés · en attente d'approbation`,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof OnboardingNotConfiguredError ? 503 : 422;
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status });
  }
}
