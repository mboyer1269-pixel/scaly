/**
 * POST /api/calls/:id/analyze — ré-analyse un appel avec le moteur LLM
 * (transcript brut, aucun hint de génération) et persiste le résultat.
 * 503 honnête si OPENAI_API_KEY est absente.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getSessionRole } from "@/server/auth";
import { resolveCompanyId } from "@/server/tenant";
import { getScriptById, getScriptByIndustry } from "@/data/industry-scripts";
import { llmIntelligenceEngine, LlmNotConfiguredError } from "@/services/llm-intelligence";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const call = await store.getCall(params.id);
  // Garde d'appartenance (anti-IDOR) : même contrat que GET /api/calls/:id.
  if (!call || (call.companyId !== resolveCompanyId() && getSessionRole() !== "founder")) {
    return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
  }

  const company = await store.getCompany(call.companyId);
  const script = (call.scriptId ? getScriptById(call.scriptId) : undefined) ?? (company ? getScriptByIndustry(company.industry) : undefined);
  if (!script) return NextResponse.json({ error: "Script d'industrie introuvable pour cet appel" }, { status: 500 });

  try {
    const intelligence = await llmIntelligenceEngine.analyze(call, script, {
      savedReason: call.intelligence?.saved?.reason,
      transferReason: call.intelligence?.transferReason,
    });
    const updated = await store.saveCall({ ...call, intelligence });
    await store.recordAudit({
      companyId: call.companyId,
      actor: "llm",
      event: "appel_réanalysé",
      detail: `${call.id} · moteur ${intelligence.engine} · intent ${intelligence.intent} · urgence ${intelligence.urgency}`,
    });
    return NextResponse.json({ call: updated });
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
