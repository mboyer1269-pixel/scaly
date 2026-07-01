/** POST /api/knowledge/ask — test deterministe du Business Brain approuve. */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { answerBusinessQuestion, listBusinessKnowledgeItems } from "@/services/business-brain";
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
  return NextResponse.json({ answer: answerBusinessQuestion(question, items) });
}
