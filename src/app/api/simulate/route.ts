/**
 * POST /api/simulate — lance un appel simulé.
 * Body : { industry?, scriptId?, personaId, seed?, persist? }
 * Le simulateur est déterministe : même seed → même conversation.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { getPersonaById, PERSONAS } from "@/data/personas";
import { getScriptById, getScriptByIndustry, INDUSTRY_SCRIPTS } from "@/data/industry-scripts";
import { simulateCall } from "@/services/simulator";
import type { Industry } from "@/domain/company";
import { clientKey, createRateLimiter, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Démo publique : 30 simulations / 10 min / client.
const limiter = createRateLimiter(30, 10 * 60_000);

interface SimulateBody {
  industry?: Industry;
  scriptId?: string;
  personaId?: string;
  seed?: number;
  persist?: boolean;
}

export async function POST(req: Request) {
  const rl = limiter.check(clientKey(req));
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec);
  let body: SimulateBody = {};
  try {
    body = (await req.json()) as SimulateBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const store = getStore();
  const company = await store.getCompany(DEFAULT_COMPANY_ID);
  const agent = await store.getAgentByCompany(DEFAULT_COMPANY_ID);
  if (!company || !agent) return NextResponse.json({ error: "Compagnie de démonstration introuvable" }, { status: 500 });

  const script = body.scriptId
    ? getScriptById(body.scriptId)
    : getScriptByIndustry(body.industry ?? company.industry);
  if (!script) {
    return NextResponse.json(
      { error: `Script introuvable. Scripts valides : ${INDUSTRY_SCRIPTS.map((s) => s.id).join(", ")}` },
      { status: 400 },
    );
  }

  const persona = getPersonaById(body.personaId ?? "persona_magasineur");
  if (!persona) {
    return NextResponse.json(
      { error: `Persona introuvable. Personas valides : ${PERSONAS.map((p) => p.id).join(", ")}` },
      { status: 400 },
    );
  }

  const seed = Number.isFinite(body.seed) ? Math.abs(Math.floor(body.seed as number)) : Math.floor(Math.random() * 1_000_000);
  const result = simulateCall({ company, script, persona, seed, agent });

  if (body.persist !== false) await store.addCall(result.call, result.actions);

  return NextResponse.json({ ...result, seed, persisted: body.persist !== false });
}
