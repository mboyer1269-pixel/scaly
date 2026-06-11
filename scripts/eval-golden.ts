/**
 * Évaluation golden set — CLI.
 * Usage :
 *   npm run eval:golden                      # rules-v1 (déterministe, hors-ligne)
 *   npm run eval:golden -- --engine=llm      # moteur LLM (OPENAI_API_KEY requis)
 *   npm run eval:golden -- --engine=llm --strict   # exit 1 si < 90 %
 */
import { existsSync, readFileSync } from "node:fs";
import { intelligenceEngine } from "../src/services/intelligence";
import { evaluateEngine, type EvalReport } from "../src/services/evaluation";

// tsx ne charge pas les fichiers .env — chargement minimal (sans dépendance).
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

const args = process.argv.slice(2);
const engineArg = args.find((a) => a.startsWith("--engine="))?.split("=")[1] ?? "rules";
const strict = args.includes("--strict");
const TARGET = 0.9;

function pct(n: number): string {
  return `${(n * 100).toFixed(1)} %`;
}

function printReport(r: EvalReport): void {
  console.log(`\n=== Golden set — moteur ${r.engine} — ${r.total} appels ===`);
  console.log(`Intention : ${pct(r.intentAccuracy)}  |  Urgence : ${pct(r.urgencyAccuracy)}  |  Les deux : ${pct(r.bothAccuracy)}  |  Erreurs : ${r.errors}`);
  const misses = r.results.filter((x) => !x.intentOk || !x.urgencyOk);
  if (misses.length) {
    console.log(`\nDésaccords (${misses.length}) :`);
    for (const m of misses) {
      const parts: string[] = [];
      if (!m.intentOk) parts.push(`intent ${m.predicted.intent} ≠ ${m.expected.intent}`);
      if (!m.urgencyOk) parts.push(`urgency ${m.predicted.urgency} ≠ ${m.expected.urgency}`);
      console.log(`  - ${m.key}\n      ${parts.join(" · ")}${m.error ? ` · ERREUR: ${m.error}` : ""}${m.note ? `\n      (annotation : ${m.note})` : ""}`);
    }
  }
}

async function main() {
  let report: EvalReport;
  if (engineArg === "llm") {
    const { llmIntelligenceEngine } = await import("../src/services/llm-intelligence");
    report = await evaluateEngine("llm", (call, script) => llmIntelligenceEngine.analyze(call, script), { concurrency: 6 });
  } else {
    report = await evaluateEngine("rules-v1", (call, script) => intelligenceEngine.analyze(call, script));
  }
  printReport(report);

  const pass = report.intentAccuracy >= TARGET && report.urgencyAccuracy >= TARGET;
  console.log(`\nCritère P1 (≥ ${pct(TARGET)} intention ET urgence) : ${pass ? "ATTEINT ✅" : "NON ATTEINT ❌"}`);
  if (strict && !pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Échec de l'évaluation :", err);
  process.exitCode = 1;
});
