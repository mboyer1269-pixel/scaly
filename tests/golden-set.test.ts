/**
 * Golden set — intégrité des annotations + plancher de précision rules-v1.
 * Le critère P1 (≥ 90 % intention ET urgence) est verrouillé en CI pour le
 * moteur déterministe ; le moteur LLM est évalué via `npm run eval:golden --
 * --engine=llm` (réseau + clé requis, hors CI).
 */
import { describe, expect, it } from "vitest";
import { GOLDEN_ANNOTATIONS, goldenKey } from "@/data/golden-set";
import { buildGoldenCases, evaluateEngine } from "@/services/evaluation";
import { buildSeedData } from "@/server/seed";
import { intelligenceEngine } from "@/services/intelligence";

describe("golden set — intégrité", () => {
  it("couvre exactement les 65 appels seed (bijection, clés uniques)", () => {
    const keys = GOLDEN_ANNOTATIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(65);

    const cases = buildGoldenCases(); // lève si une annotation manque ou si un script est introuvable
    expect(cases.length).toBe(65);
  });

  it("les clés de génération sont stables d'un build seed à l'autre", () => {
    const a = buildSeedData().calls.map(goldenKey).sort();
    const b = buildSeedData().calls.map(goldenKey).sort();
    expect(a).toEqual(b);
  });
});

describe("golden set — précision rules-v1 (critère P1)", () => {
  it("≥ 90 % d'accord sur intention ET urgence", async () => {
    const report = await evaluateEngine("rules-v1", (call, script) => intelligenceEngine.analyze(call, script));
    expect(report.errors).toBe(0);
    // Mesuré le 2026-07-01 : 65 appels (59 + 6 comp_horizon, Industry Pack concessionnaire).
    // 93,8 % intention / 92,3 % urgence — 8 désaccords documentés, limites connues du moteur à mots-clés.
    expect(report.intentAccuracy).toBeGreaterThanOrEqual(0.9);
    expect(report.urgencyAccuracy).toBeGreaterThanOrEqual(0.9);
  });
});
