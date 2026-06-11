/**
 * POST /api/voice-lab — le tour par tour du Voice Runtime Lab.
 * Sans état côté serveur : le réducteur est pur, la session voyage dans le body.
 *  - { op: "start", seed?, scenarioId? }            → session initiale (accueil)
 *  - { op: "step", session, input: { text, lang?, interrupt? } } → session avancée
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { getScriptById } from "@/data/industry-scripts";
import { getVoiceScenarioById } from "@/data/voice-scenarios";
import { advanceVoiceSession, createVoiceSession, type VoiceRuntimeContext } from "@/services/voice-runtime";
import type { VoiceSession } from "@/domain/voice";
import type { LanguageCode } from "@/domain/company";

export const dynamic = "force-dynamic";

interface VoiceLabBody {
  op?: "start" | "step";
  seed?: number;
  scenarioId?: string;
  session?: VoiceSession;
  input?: { text?: string; lang?: LanguageCode; interrupt?: boolean };
}

async function buildContext(scriptId: string): Promise<VoiceRuntimeContext | NextResponse> {
  const store = getStore();
  const company = await store.getCompany(DEFAULT_COMPANY_ID);
  const agent = await store.getAgentByCompany(DEFAULT_COMPANY_ID);
  if (!company || !agent) return NextResponse.json({ error: "Compagnie de démonstration introuvable" }, { status: 500 });
  const script = getScriptById(scriptId);
  if (!script) return NextResponse.json({ error: `Script introuvable : ${scriptId}` }, { status: 400 });
  return { company, agent, script };
}

export async function POST(req: Request) {
  let body: VoiceLabBody = {};
  try {
    body = (await req.json()) as VoiceLabBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  if (body.op === "start") {
    const scenario = body.scenarioId ? getVoiceScenarioById(body.scenarioId) : undefined;
    if (body.scenarioId && !scenario) {
      return NextResponse.json({ error: `Scénario introuvable : ${body.scenarioId}` }, { status: 400 });
    }
    const scriptId = scenario?.scriptId ?? "script_domicile";
    const ctx = await buildContext(scriptId);
    if (ctx instanceof NextResponse) return ctx;
    const seed = Number.isFinite(body.seed) ? Math.abs(Math.floor(body.seed as number)) : scenario?.seed ?? Math.floor(Math.random() * 1_000_000);
    const session = createVoiceSession(ctx, { seed, scenarioId: scenario?.id });
    return NextResponse.json({ session });
  }

  if (body.op === "step") {
    const session = body.session;
    const text = body.input?.text;
    if (!session?.id || !Array.isArray(session.turns) || !Array.isArray(session.fields)) {
      return NextResponse.json({ error: "Session manquante ou malformée" }, { status: 400 });
    }
    if (typeof text !== "string" || text.length > 2000) {
      return NextResponse.json({ error: "input.text requis (max 2000 caractères)" }, { status: 400 });
    }
    const ctx = await buildContext(session.scriptId);
    if (ctx instanceof NextResponse) return ctx;
    const next = advanceVoiceSession(ctx, session, { text, lang: body.input?.lang, interrupt: body.input?.interrupt });
    return NextResponse.json({ session: next });
  }

  return NextResponse.json({ error: "op invalide — utilisez \"start\" ou \"step\"" }, { status: 400 });
}
