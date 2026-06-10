/**
 * Seed — données de démonstration réalistes.
 * La majorité des appels sont GÉNÉRÉS PAR LE SIMULATEUR avec des seeds fixes
 * (dogfooding : le seed prouve que le simulateur fonctionne), plus 4 appels
 * curés rédigés à la main et 3 appels manqués.
 */
import type { Call } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import type { Company } from "@/domain/company";
import type { VoiceAgentConfig } from "@/domain/agent";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { getPersonaById } from "@/data/personas";
import { getScriptByIndustry } from "@/data/industry-scripts";
import { buildCuratedCalls, buildMissedCalls } from "@/data/curated-calls";
import { simulateCall } from "@/services/simulator";
import { executeAction, planActionsForCall, planDailyDigest } from "@/services/action-engine";
import { mulberry32 } from "@/lib/rng";

export interface SeedData {
  companies: Company[];
  agents: VoiceAgentConfig[];
  calls: Call[];
  actions: ScalyAction[];
}

function dateAt(daysAgo: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const MAIN_PERSONA_CYCLE = [
  "persona_magasineur",
  "persona_regulier",
  "persona_urgence",
  "persona_presse",
  "persona_magasineur",
  "persona_anglophone",
  "persona_regulier",
  "persona_spam",
  "persona_magasineur",
  "persona_regulier",
  "persona_presse",
  "persona_urgence",
  "persona_regulier",
  "persona_magasineur",
  "persona_spam",
  "persona_frustre",
];

const OTHER_PERSONA_CYCLE = [
  "persona_magasineur",
  "persona_regulier",
  "persona_urgence",
  "persona_presse",
  "persona_spam",
  "persona_regulier",
];

export function buildSeedData(): SeedData {
  const calls: Call[] = [];
  const actions: ScalyAction[] = [];

  const main = SEED_COMPANIES[0];
  const mainAgent = SEED_AGENTS[0];
  const mainScript = getScriptByIndustry(main.industry);

  // --- Appels curés + manqués (compagnie principale) ---
  for (const call of [...buildCuratedCalls(main, mainScript), ...buildMissedCalls(main, mainScript)]) {
    calls.push(call);
    actions.push(...planActionsForCall(call, main));
  }

  // --- Appels générés par le simulateur (compagnie principale) ---
  MAIN_PERSONA_CYCLE.forEach((personaId, i) => {
    const persona = getPersonaById(personaId);
    if (!persona) throw new Error(`Persona seed introuvable : ${personaId}`);
    // Répartition sur 13 jours, heures de bureau + 2 appels hors heures (sauvés).
    const daysAgo = (i * 5) % 13;
    const hour = i === 5 ? 21 : i === 11 ? 6 : 8 + ((i * 3) % 9);
    const minute = (i * 17) % 60;
    const result = simulateCall({
      company: main,
      script: mainScript,
      persona,
      seed: 101 + i,
      at: dateAt(daysAgo, hour, minute),
      agent: mainAgent,
    });
    calls.push(result.call);
    actions.push(...result.actions);
  });

  // --- Autres compagnies (cockpit admin) ---
  SEED_COMPANIES.slice(1).forEach((company, ci) => {
    const agent = SEED_AGENTS.find((a) => a.companyId === company.id);
    if (!agent) throw new Error(`Agent seed introuvable : ${company.id}`);
    const script = getScriptByIndustry(company.industry);
    OTHER_PERSONA_CYCLE.forEach((personaId, i) => {
      const persona = getPersonaById(personaId);
      if (!persona) throw new Error(`Persona seed introuvable : ${personaId}`);
      const daysAgo = (i * 3 + ci) % 12;
      const result = simulateCall({
        company,
        script,
        persona,
        seed: 200 + ci * 20 + i,
        at: dateAt(daysAgo, 9 + ((i * 2 + ci) % 8), (i * 23) % 60),
        agent,
      });
      calls.push(result.call);
      actions.push(...result.actions);
    });
  });

  // --- Exécution mock d'une partie des actions (déterministe, ~80 %) ---
  const rng = mulberry32(99);
  for (const action of actions) {
    if (action.status === "pending" && rng() < 0.82) executeAction(action);
  }

  // --- Résumé quotidien (exemple d'action récurrente) ---
  const digest = planDailyDigest(main, calls.filter((c) => c.companyId === main.id).length, 0);
  executeAction(digest);
  actions.push(digest);

  return { companies: SEED_COMPANIES, agents: SEED_AGENTS, calls, actions };
}
