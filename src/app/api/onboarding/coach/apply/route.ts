import { NextResponse } from "next/server";
import { isJsonObject } from "@/lib/request-body";
import { validateCoachingDraft } from "@/services/onboarding";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!isJsonObject(body) || body.approved !== true || !isJsonObject(body.draft)) {
    return NextResponse.json(
      { error: "Brouillon valide et approbation explicite requis." },
      { status: 400 },
    );
  }

  const store = getStore();
  const companyId = await resolveCompanyId();
  const [company, agent] = await Promise.all([
    store.getCompany(companyId),
    store.getAgentByCompany(companyId),
  ]);
  if (!company || !agent) {
    return NextResponse.json({ error: "Entreprise ou configuration de Maude introuvable." }, { status: 404 });
  }

  const draft = validateCoachingDraft(body.draft, company, agent);
  const [updatedCompany, updatedAgent] = await Promise.all([
    store.updateCompany(companyId, {
      businessDescription: draft.businessDescription,
      tone: draft.tone,
      services: draft.services,
      serviceAreas: draft.serviceAreas,
      essentialQuestions: draft.essentialQuestions,
      policies: draft.policies,
    }),
    store.updateAgent(companyId, {
      persona: draft.persona,
      style: draft.style,
      greetingScript: draft.greetingScript,
      closingScript: draft.closingScript,
      allowedPhrases: draft.allowedPhrases,
      forbiddenPhrases: draft.forbiddenPhrases,
      answerLimits: draft.answerLimits,
      transferPolicy: draft.transferPolicy,
      ownerInstructions: draft.ownerInstructions,
    }),
  ]);

  await store.recordAudit({
    companyId,
    actor: "owner",
    event: "coaching_approuvé",
    detail: `${draft.ownerInstructions.length} consigne(s) propriétaire · ${draft.changedFields.join(", ")}`,
  });

  return NextResponse.json({
    company: updatedCompany,
    agent: updatedAgent,
    appliedFields: draft.changedFields,
  });
}
