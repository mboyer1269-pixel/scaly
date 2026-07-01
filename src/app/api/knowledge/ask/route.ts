/** POST /api/knowledge/ask — test deterministe du Business Brain approuve. */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { answerBusinessQuestion, listBusinessKnowledgeItems } from "@/services/business-brain";
import { createUnknownAnswerNotification } from "@/services/owner-notifications";
import { isJsonObject } from "@/lib/request-body";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!isJsonObject(body)) return NextResponse.json({ error: "Un objet JSON est requis" }, { status: 400 });
  const question = typeof body.question === "string" ? body.question : "";
  const companyId = await resolveCompanyId();
  const company = await getStore().getCompany(companyId);
  if (!company) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  const items = await listBusinessKnowledgeItems(company);
  const answer = answerBusinessQuestion(question, items);

  // Un vrai trou de connaissance devient une action owner. Best-effort : ne
  // jamais faire échouer la réponse à cause de la notification.
  if (answer.status === "unknown" && answer.refusedReason === "no_approved_source") {
    try {
      const notification = await createUnknownAnswerNotification(companyId, {
        question,
        reason: "no_approved_source",
      });
      await getStore().recordAudit({
        companyId,
        actor: "system",
        event: "owner_notification_created",
        detail: notification.type,
      });
    } catch {
      // Notification non bloquante : la réponse au client reste prioritaire.
    }
  }

  return NextResponse.json({ answer });
}
