/**
 * Service — Évaluation des moteurs d'intelligence sur le golden set.
 * Reconstruit les 53 appels seed (déterministes), les joint aux annotations
 * humaines, fait analyser chaque transcript BRUT (sans hints de génération —
 * c'est tout l'intérêt : le moteur doit comprendre, pas recopier), et mesure
 * l'accord intention/urgence. Critère P1 : ≥ 90 % sur les deux axes.
 */
import type { Call, CallIntelligence, Intent, Urgency } from "@/domain/call";
import type { IndustryScript } from "@/domain/script";
import { buildSeedData } from "@/server/seed";
import { GOLDEN_ANNOTATIONS, goldenKey } from "@/data/golden-set";
import { getScriptById } from "@/data/industry-scripts";

export interface GoldenCase {
  key: string;
  call: Call;
  script: IndustryScript;
  expected: { intent: Intent; urgency: Urgency };
  note?: string;
}

/** Joint les appels seed aux annotations. Lève une erreur si la couverture n'est pas bijective. */
export function buildGoldenCases(): GoldenCase[] {
  const seed = buildSeedData();
  const byKey = new Map(GOLDEN_ANNOTATIONS.map((a) => [a.key, a]));
  if (byKey.size !== GOLDEN_ANNOTATIONS.length) throw new Error("Clés d'annotation dupliquées dans le golden set");

  const cases = seed.calls.map((call) => {
    const key = goldenKey(call);
    const ann = byKey.get(key);
    if (!ann) throw new Error(`Annotation manquante pour l'appel seed ${key}`);
    const script = call.scriptId ? getScriptById(call.scriptId) : undefined;
    if (!script) throw new Error(`Script introuvable pour ${key}`);
    return { key, call, script, expected: ann.expected, note: ann.note };
  });

  if (cases.length !== GOLDEN_ANNOTATIONS.length) {
    throw new Error(`Couverture incomplète : ${cases.length} appels vs ${GOLDEN_ANNOTATIONS.length} annotations`);
  }
  return cases;
}

export type AnalyzeFn = (call: Call, script: IndustryScript) => CallIntelligence | Promise<CallIntelligence>;

export interface CaseResult {
  key: string;
  expected: { intent: Intent; urgency: Urgency };
  predicted: { intent: Intent; urgency: Urgency };
  intentOk: boolean;
  urgencyOk: boolean;
  note?: string;
  error?: string;
}

export interface EvalReport {
  engine: string;
  total: number;
  intentAccuracy: number;
  urgencyAccuracy: number;
  bothAccuracy: number;
  errors: number;
  results: CaseResult[];
}

/** Évalue un moteur sur tout le golden set (concurrence bornée pour les moteurs réseau). */
export async function evaluateEngine(engineName: string, analyze: AnalyzeFn, opts: { concurrency?: number } = {}): Promise<EvalReport> {
  const cases = buildGoldenCases();
  const concurrency = Math.max(1, opts.concurrency ?? 1);
  const results: CaseResult[] = new Array(cases.length);

  let next = 0;
  async function worker(): Promise<void> {
    while (next < cases.length) {
      const i = next++;
      const c = cases[i];
      try {
        const intel = await analyze(c.call, c.script);
        results[i] = {
          key: c.key,
          expected: c.expected,
          predicted: { intent: intel.intent, urgency: intel.urgency },
          intentOk: intel.intent === c.expected.intent,
          urgencyOk: intel.urgency === c.expected.urgency,
          note: c.note,
        };
      } catch (err) {
        results[i] = {
          key: c.key,
          expected: c.expected,
          predicted: { intent: "autre", urgency: "normale" },
          intentOk: false,
          urgencyOk: false,
          note: c.note,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const total = results.length;
  const intentCorrect = results.filter((r) => r.intentOk).length;
  const urgencyCorrect = results.filter((r) => r.urgencyOk).length;
  const bothCorrect = results.filter((r) => r.intentOk && r.urgencyOk).length;
  return {
    engine: engineName,
    total,
    intentAccuracy: intentCorrect / total,
    urgencyAccuracy: urgencyCorrect / total,
    bothAccuracy: bothCorrect / total,
    errors: results.filter((r) => r.error).length,
    results,
  };
}
