/**
 * Voice Lab — orchestration des scénarios du runtime vocal (P2A).
 * Partagé par les tests CI, l'API /api/voice-lab et la preuve vivante de /status :
 * une seule définition de « rejouer un scénario » et de « vérifier ses attentes »,
 * pour que le vert de /status soit exactement le vert de la CI.
 */
import type { VoiceScenario, VoiceScenarioExpectation, VoiceSession } from "@/domain/voice";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { getScriptById } from "@/data/industry-scripts";
import { VOICE_SCENARIOS } from "@/data/voice-scenarios";
import {
  advanceVoiceSession,
  createVoiceSession,
  type VoiceRuntimeContext,
} from "./voice-runtime";

/** Contexte runtime depuis les données seed (déterministe, sans IO ni store). */
export function buildVoiceContext(companyId: string, scriptId: string): VoiceRuntimeContext {
  const company = SEED_COMPANIES.find((c) => c.id === companyId);
  if (!company) throw new Error(`Compagnie inconnue : ${companyId}`);
  const agent = SEED_AGENTS.find((a) => a.companyId === companyId);
  if (!agent) throw new Error(`Agent vocal introuvable pour : ${companyId}`);
  const script = getScriptById(scriptId);
  if (!script) throw new Error(`Script inconnu : ${scriptId}`);
  return { company, agent, script };
}

/** Rejoue un scénario complet : tous les tours appelant, dans l'ordre. */
export function runVoiceScenario(scenario: VoiceScenario): VoiceSession {
  const ctx = buildVoiceContext(scenario.companyId, scenario.scriptId);
  let session = createVoiceSession(ctx, { seed: scenario.seed, scenarioId: scenario.id });
  for (const turn of scenario.callerTurns) {
    session = advanceVoiceSession(ctx, session, { text: turn.text, lang: turn.lang, interrupt: turn.interrupt });
  }
  return session;
}

export interface ScenarioCheck {
  scenarioId: string;
  title: string;
  pass: boolean;
  failures: string[];
  session: VoiceSession;
}

/** Vérifie les attentes verrouillées d'un scénario. Chaque échec est nommé. */
export function checkScenarioExpectations(scenario: VoiceScenario, session: VoiceSession): ScenarioCheck {
  const e: VoiceScenarioExpectation = scenario.expected;
  const t = session.telemetry;
  const failures: string[] = [];
  if (t.finalStatus !== e.finalStatus) failures.push(`statut final « ${t.finalStatus} » ≠ attendu « ${e.finalStatus} »`);
  if (t.transferRequested !== e.transferRequested) failures.push(`transfert ${t.transferRequested ? "demandé" : "absent"} ≠ attendu ${e.transferRequested ? "demandé" : "absent"}`);
  if (t.fieldsConfirmed < e.minFieldsConfirmed) failures.push(`${t.fieldsConfirmed} champ(s) confirmé(s) < minimum ${e.minFieldsConfirmed}`);
  if (t.fieldsMissing > e.maxFieldsMissing) failures.push(`${t.fieldsMissing} champ(s) manquant(s) > maximum ${e.maxFieldsMissing}`);
  if (e.minLanguageSwitches !== undefined && t.languageSwitches < e.minLanguageSwitches) {
    failures.push(`${t.languageSwitches} switch(s) de langue < minimum ${e.minLanguageSwitches}`);
  }
  if (e.minInterruptions !== undefined && t.interruptions < e.minInterruptions) {
    failures.push(`${t.interruptions} interruption(s) < minimum ${e.minInterruptions}`);
  }
  if (session.dominantLanguage !== e.dominantLanguage) {
    failures.push(`langue dominante « ${session.dominantLanguage} » ≠ attendue « ${e.dominantLanguage} »`);
  }
  return { scenarioId: scenario.id, title: scenario.title, pass: failures.length === 0, failures, session };
}

export interface VoiceLabReport {
  checks: ScenarioCheck[];
  allPass: boolean;
  /** p50/p95 agrégés sur tous les tours agent de tous les scénarios. */
  aggregateP50Ms: number;
  aggregateP95Ms: number;
  latencyBudgetMet: boolean;
  latenciesSimulated: boolean;
}

/** Rejoue tous les scénarios et agrège — la « preuve vivante » de /status. */
export function runAllVoiceScenarios(): VoiceLabReport {
  const checks = VOICE_SCENARIOS.map((s) => checkScenarioExpectations(s, runVoiceScenario(s)));
  const latencies = checks
    .flatMap((c) => c.session.telemetry.perceivedLatenciesMs)
    .sort((a, b) => a - b);
  const pct = (p: number) => (latencies.length === 0 ? 0 : latencies[Math.max(0, Math.min(latencies.length - 1, Math.ceil((p / 100) * latencies.length) - 1))]);
  const p50 = pct(50);
  const p95 = pct(95);
  return {
    checks,
    allPass: checks.every((c) => c.pass),
    aggregateP50Ms: p50,
    aggregateP95Ms: p95,
    latencyBudgetMet: p50 < 800 && p95 < 1200,
    latenciesSimulated: checks.every((c) => c.session.telemetry.latenciesSimulated),
  };
}
