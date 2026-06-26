/**
 * POST /api/simulate — lance un appel simulé.
 * Body : { industry?, scriptId?, personaId, seed?, persist? }
 * Le simulateur est déterministe : même seed → même conversation.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { getPersonaById, PERSONAS } from "@/data/personas";
import { INDUSTRY_SCRIPTS } from "@/data/industry-scripts";
import { simulateCall } from "@/services/simulator";
import { runSimulationWorkflow } from "@/services/simulation-workflow";
import { resolveCompanySimulationScript } from "@/services/simulation-policy";
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
  const companyId = await resolveCompanyId();
  const company = await store.getCompany(companyId);
  const agent = await store.getAgentByCompany(companyId);
  if (!company || !agent) return NextResponse.json({ error: "Compagnie introuvable" }, { status: 500 });

  let script;
  try {
    script = resolveCompanySimulationScript(company, agent, body.scriptId);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Script invalide",
        configuredScript: agent.qualificationScriptId,
        scripts: INDUSTRY_SCRIPTS.map((candidate) => candidate.id),
      },
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
  const input = { company, script, persona, seed, agent };
  if (body.persist === false) {
    const result = simulateCall(input);
    return NextResponse.json({ ...result, seed, persisted: false });
  }

  const result = await runSimulationWorkflow(store, input);
  return NextResponse.json({ ...result, seed, persisted: true });
}
