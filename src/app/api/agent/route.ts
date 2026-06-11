/** GET/PUT /api/agent — configuration de l'agent vocal (tenant démo). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import type { VoiceAgentConfig } from "@/domain/agent";

export const dynamic = "force-dynamic";

export async function GET() {
  const agent = await getStore().getAgentByCompany(resolveCompanyId());
  if (!agent) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function PUT(req: Request) {
  let patch: Partial<VoiceAgentConfig>;
  try {
    patch = (await req.json()) as Partial<VoiceAgentConfig>;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  delete (patch as Record<string, unknown>).id;
  delete (patch as Record<string, unknown>).companyId;
  const agent = await getStore().updateAgent(resolveCompanyId(), patch);
  if (!agent) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ agent });
}
