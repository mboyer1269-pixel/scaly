/**
 * GET /api/voice/context?companyId=… — contexte d'appel pour scaly-realtime.
 * Une seule source de vérité comportementale : le pont construit son prompt
 * des MÊMES objets (Company + VoiceAgentConfig + IndustryScript) que le
 * simulateur et le Voice Lab. Protégé par REALTIME_SHARED_SECRET si défini.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getScriptById } from "@/data/industry-scripts";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { buildCallerMemory, selectCallerHistory } from "@/services/caller-memory";
import type { CallerMemory } from "@/domain/caller";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.REALTIME_SHARED_SECRET;
  // En production, le secret est OBLIGATOIRE — jamais d'endpoint pont ouvert.
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "REALTIME_SHARED_SECRET requis en production" }, { status: 503 });
  }
  if (secret && req.headers.get("x-scaly-secret") !== secret) {
    return NextResponse.json({ error: "Secret partagé invalide" }, { status: 401 });
  }

  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") || DEFAULT_COMPANY_ID;
  const from = url.searchParams.get("from") ?? "";

  const store = getStore();
  const company = await store.getCompany(companyId);
  const agent = company ? await store.getAgentByCompany(company.id) : undefined;
  const script = agent ? getScriptById(agent.qualificationScriptId) : undefined;
  if (!company || !agent || !script) {
    return NextResponse.json({ error: `Contexte incomplet pour ${companyId}` }, { status: 404 });
  }

  // Dossier client synthétisé : historique des appels de CE numéro pour CE
  // tenant. selectCallerHistory() ferme les deux fuites — numéro masqué (aucune
  // mémoire) et croisement de tenant — ; buildCallerMemory() retourne undefined
  // sans antécédent. L'agente ne prétend jamais une mémoire qu'elle n'a pas.
  const previous = selectCallerHistory(await store.listCalls(companyId), companyId, from);
  const callerMemory: CallerMemory | undefined = buildCallerMemory(previous);

  return NextResponse.json({ company, agent, script, callerMemory });
}
