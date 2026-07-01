/** GET/POST /api/knowledge — Business Brain approuve par tenant. */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { createKnowledgeDraft, listBusinessKnowledgeItems } from "@/services/business-brain";
import { isJsonObject } from "@/lib/request-body";

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await resolveCompanyId();
  const company = await getStore().getCompany(companyId);
  if (!company) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  return NextResponse.json({ items: await listBusinessKnowledgeItems(company) });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!isJsonObject(body)) return NextResponse.json({ error: "Un objet JSON est requis" }, { status: 400 });

  try {
    const companyId = await resolveCompanyId();
    const item = await createKnowledgeDraft(companyId, {
      title: typeof body.title === "string" ? body.title : "",
      content: typeof body.content === "string" ? body.content : "",
      sourceLabel: typeof body.sourceLabel === "string" ? body.sourceLabel : undefined,
    });
    await getStore().recordAudit({
      companyId,
      actor: "owner",
      event: "business_knowledge_draft_created",
      detail: item.title,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Creation impossible" }, { status: 422 });
  }
}
