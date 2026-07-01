/** PUT /api/knowledge/:id — approuver ou archiver une connaissance owner. */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { approveKnowledgeItem, archiveKnowledgeItem } from "@/services/business-brain";
import { isJsonObject } from "@/lib/request-body";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!isJsonObject(body)) return NextResponse.json({ error: "Un objet JSON est requis" }, { status: 400 });

  try {
    const companyId = await resolveCompanyId();
    const { id } = await params;
    const action = body.action;
    const item =
      action === "approve"
        ? await approveKnowledgeItem(companyId, id)
        : action === "archive"
          ? await archiveKnowledgeItem(companyId, id)
          : null;
    if (!item) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    await getStore().recordAudit({
      companyId,
      actor: "owner",
      event: action === "approve" ? "business_knowledge_approved" : "business_knowledge_archived",
      detail: item.title,
    });
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mise a jour impossible" }, { status: 422 });
  }
}
