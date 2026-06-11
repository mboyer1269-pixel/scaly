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
import { canonicalPhone } from "@/domain/consent";
import type { KnownCaller } from "@/services/voice-prompt";

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

  // Dossier client RÉEL : historique d'appels de ce numéro. L'agente ne dira
  // « comme la dernière fois » QUE si ces données existent vraiment.
  let knownCaller: KnownCaller | undefined;
  const canon = canonicalPhone(from);
  if (canon.length === 10) {
    const previous = (await store.listCalls(companyId)).filter((c) => canonicalPhone(c.fromNumber) === canon);
    if (previous.length > 0) {
      const name = previous.find((c) => c.callerName || c.intelligence?.collectedFields?.nom);
      const address = previous.find((c) => c.intelligence?.collectedFields?.adresse);
      knownCaller = {
        callCount: previous.length,
        name: name?.callerName ?? name?.intelligence?.collectedFields?.nom,
        address: address?.intelligence?.collectedFields?.adresse,
        lastCallAt: previous[0].startedAt,
      };
    }
  }

  return NextResponse.json({ company, agent, script, knownCaller });
}
