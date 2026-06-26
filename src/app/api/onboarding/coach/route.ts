import { NextResponse } from "next/server";
import { isJsonObject } from "@/lib/request-body";
import { buildCoachingDraft } from "@/services/onboarding";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { clientKey, createRateLimiter, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(20, 10 * 60_000);

export async function POST(req: Request) {
  const rl = limiter.check(clientKey(req));
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!isJsonObject(body) || typeof body.instruction !== "string") {
    return NextResponse.json({ error: "Une consigne en texte est requise." }, { status: 400 });
  }

  const instruction = body.instruction.trim();
  if (instruction.length < 10 || instruction.length > 2000) {
    return NextResponse.json({ error: "La consigne doit contenir entre 10 et 2 000 caractères." }, { status: 400 });
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

  const draft = buildCoachingDraft(company, agent, instruction);
  await store.recordAudit({
    companyId,
    actor: "owner-coach",
    event: "coaching_brouillon_généré",
    detail: `${draft.changedFields.join(", ")} · en attente d'approbation`,
  });

  return NextResponse.json({
    draft,
    reality: {
      state: "simulated",
      label: "Interprétation locale",
      detail: "La consigne exacte est conservée; les champs structurés sont proposés par des règles déterministes.",
    },
  });
}
