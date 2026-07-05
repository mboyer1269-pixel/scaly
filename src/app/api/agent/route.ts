/** GET/PUT /api/agent — configuration de l'agent vocal (tenant démo). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId, requireTenant } from "@/server/tenant";
import type { VoiceAgentConfig } from "@/domain/agent";
import { isJsonObject, pickJsonFields } from "@/lib/request-body";

export const dynamic = "force-dynamic";

export async function GET() {
  const agent = await getStore().getAgentByCompany(await resolveCompanyId());
  if (!agent) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ agent });
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
  const patch = pickJsonFields<VoiceAgentConfig>(body, [
    "displayName",
    "persona",
    "style",
    "languages",
    "greetingScript",
    "closingScript",
    "allowedPhrases",
    "forbiddenPhrases",
    "safetyRules",
    "answerLimits",
    "transferPolicy",
    "ownerInstructions",
    "voiceProfile",
  ]);
  const agent = await getStore().updateAgent(companyId, patch);
  if (!agent) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ agent });
}
