/**
 * Golden conversations — les 6 scénarios du Voice Lab sont verrouillés en CI.
 * Toute régression conversationnelle (champ perdu, transfert manqué, langue
 * mal suivie, budget latence explosé) casse le build. C'est le pendant vocal
 * du golden set d'intelligence (tests/golden-set.test.ts).
 */
import { describe, expect, it } from "vitest";
import { VOICE_SCENARIOS } from "@/data/voice-scenarios";
import { checkScenarioExpectations, runAllVoiceScenarios, runVoiceScenario } from "@/services/voice-lab";
import { LATENCY_TARGET_P50_MS, LATENCY_TARGET_P95_MS } from "@/domain/voice";

describe("scénarios golden du Voice Lab", () => {
  for (const scenario of VOICE_SCENARIOS) {
    it(`${scenario.id} — ${scenario.title}`, () => {
      const session = runVoiceScenario(scenario);
      const check = checkScenarioExpectations(scenario, session);
      expect(check.failures, check.failures.join(" ; ")).toEqual([]);
      expect(check.pass).toBe(true);
    });
  }

  it("le rapport agrégé est vert : 6/6 scénarios, budget latence respecté", () => {
    const report = runAllVoiceScenarios();
    expect(report.checks).toHaveLength(VOICE_SCENARIOS.length);
    expect(report.allPass).toBe(true);
    expect(report.aggregateP50Ms).toBeLessThan(LATENCY_TARGET_P50_MS);
    expect(report.aggregateP95Ms).toBeLessThan(LATENCY_TARGET_P95_MS);
    // Honnêteté : tant que P2B n'existe pas, les latences sont simulées et déclarées telles.
    expect(report.latenciesSimulated).toBe(true);
  });

  it("chaque scénario documente ce qu'il prouve", () => {
    for (const s of VOICE_SCENARIOS) {
      expect(s.proves.length).toBeGreaterThan(10);
      expect(s.callerTurns.length).toBeGreaterThan(0);
    }
  });
});
