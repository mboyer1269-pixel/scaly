/**
 * `npm run pilot:check` — Pilot Readiness Gate (ADR-019).
 *
 * Collecte l'environnement réel, les faits du dépôt (scripts package.json,
 * fichiers de tests) et — si STORE_PROVIDER=prisma — un aller-retour RÉEL en
 * base, puis délègue le verdict à evaluatePilotReadiness() (pur, testé).
 *
 * Sortie : rapport PASS / WARN / FAIL lisible en CI. Code de sortie 1 si FAIL,
 * sinon 0 — un WARN (ex. mono-tenant, mode démo) ne casse pas la CI.
 *
 * HONNÊTETÉ : ce gate lit la configuration, jamais ne la maquille. Il ne place
 * AUCUN appel — il dit seulement si on le pourrait, et ce qui manque sinon.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  evaluatePilotReadiness,
  type GateStatus,
  type PilotEnv,
  type PilotFacts,
  type GateCheck,
} from "../src/services/pilot-readiness";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function packageScripts(): Record<string, string> {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as { scripts?: Record<string, string> };
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

function testFiles(): string[] {
  try {
    return readdirSync(join(root, "tests"));
  } catch {
    return [];
  }
}

/**
 * Aller-retour réel en base, seulement si STORE_PROVIDER=prisma.
 * Importé dynamiquement pour ne pas charger Prisma (ni .env) quand on est en
 * mémoire — et ne jamais faire échouer le gate sur l'absence du client Prisma.
 */
async function liveCheck(): Promise<PilotFacts["liveCheck"]> {
  if (process.env.STORE_PROVIDER !== "prisma") return undefined;
  try {
    const { getStore } = await import("../src/server/store");
    const res = await getStore().verifyLive();
    return { ok: res.ok, detail: `${res.detail} (${res.latencyMs} ms)` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

const TAG: Record<GateStatus, string> = { pass: "PASS", warn: "WARN", fail: "FAIL" };
const ICON: Record<GateStatus, string> = { pass: "✅", warn: "🟡", fail: "❌" };

function line(c: GateCheck): string {
  return `  ${ICON[c.status]} [${TAG[c.status]}] ${c.label}${c.blocking && c.status !== "pass" ? " (BLOQUANT)" : ""}\n        ${c.detail}`;
}

async function main(): Promise<void> {
  const env = process.env as PilotEnv;
  const facts: PilotFacts = {
    packageScripts: packageScripts(),
    testFiles: testFiles(),
    // Mapping Twilio numéro→companyId : non implémenté tant que ce flag est false.
    // À passer à true LE JOUR où /api/voice/incoming résout la company par le
    // numéro appelé (To/Called) au lieu de DEFAULT_COMPANY_ID — pas avant.
    twilioTenantMapping: false,
    liveCheck: await liveCheck(),
  };

  const report = evaluatePilotReadiness(env, facts);

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  ALLÔ MAUDE — LIVE-CALL READINESS GATE");
  console.log("══════════════════════════════════════════════════════════════\n");
  console.log(`  VERDICT : ${ICON[report.verdict]} ${TAG[report.verdict]}`);
  console.log(`  Premier appel réel aujourd'hui : ${report.canMakeRealCall.possible ? "OUI" : "NON"} (${report.canMakeRealCall.mode})`);
  console.log(`     → ${report.canMakeRealCall.reason}`);
  console.log(`  Posture tenant : ${report.singleTenantOnly ? "MONO-TENANT PILOTE UNIQUEMENT" : "multi-tenant"}\n`);

  console.log("  Détail des vérifications :");
  for (const c of report.checks) console.log(line(c));

  if (report.blockers.length > 0) {
    console.log("\n  ──────────────────────────────────────────────────────────");
    console.log("  À RÉGLER AVANT / SELON LE CONTEXTE :");
    for (const b of report.blockers) console.log(`   • ${b.label} — ${b.detail}`);
  }
  console.log("\n══════════════════════════════════════════════════════════════\n");

  process.exit(report.verdict === "fail" ? 1 : 0);
}

void main();
