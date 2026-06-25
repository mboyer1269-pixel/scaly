import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEED_AGENTS, SEED_COMPANIES } from "../src/data/companies";
import { getPersonaById } from "../src/data/personas";
import { getScriptByIndustry } from "../src/data/industry-scripts";
import { InMemoryStore } from "../src/server/store";
import { evaluateDemoReadiness } from "../src/services/demo-readiness";
import { runSimulationWorkflow } from "../src/services/simulation-workflow";

const root = process.cwd();
const file = (path: string) => resolve(root, path);
const exists = (path: string) => existsSync(file(path));

const customerFiles = [
  "src/app/page.tsx",
  "src/app/pricing/page.tsx",
  "src/components/Sidebar.tsx",
  "src/app/(app)/dashboard/page.tsx",
  "src/components/SimulatorClient.tsx",
  "src/components/AgentForm.tsx",
  "src/components/OnboardingWizard.tsx",
];

function exposesScalyAsProduct(path: string): boolean {
  if (!exists(path)) return false;
  const source = readFileSync(file(path), "utf8");
  return /(["'`>])Scaly\b/.test(source);
}

async function main() {
  const store = new InMemoryStore();
  const company = SEED_COMPANIES[0];
  const agent = SEED_AGENTS[0];
  const persona = getPersonaById("persona_urgence");
  if (!persona) throw new Error("Persona urgence absente.");
  const script = getScriptByIndustry(company.industry);
  const result = await runSimulationWorkflow(store, {
    company,
    agent,
    persona,
    script,
    seed: 0,
    at: new Date("2026-06-25T12:00:00-04:00"),
  });

  const [call, actions, reviews, evidence, audit] = await Promise.all([
    store.getCall(result.call.id),
    store.listActions(company.id, result.call.id),
    store.listReviewItems(company.id),
    store.listReadinessEvidence(company.id, "demo"),
    store.getAuditLog(),
  ]);

  const report = evaluateDemoReadiness({
    store: store.info(),
    brandBoundaryPass: customerFiles.every((path) => !exposesScalyAsProduct(path)),
    verticalEvidence: evidence.find((item) => item.callId === result.call.id),
    callPersisted: Boolean(call),
    actionsPersisted: actions.length === result.actions.length,
    reviewPersisted: reviews.some((item) => item.callId === result.call.id),
    auditRecorded: audit.some((entry) => entry.detail?.includes(result.call.id)),
    requiredSurfaces: {
      overview: exists("src/app/(app)/dashboard/page.tsx"),
      calls: exists("src/app/(app)/calls/page.tsx"),
      followUp: exists("src/app/(app)/follow-up/page.tsx"),
      learn: exists("src/app/(app)/learn/page.tsx"),
      demoReadiness: exists("src/app/(app)/readiness/demo/page.tsx"),
    },
  });

  console.log("\nALLÔ MAUDE — DEMO READINESS\n");
  for (const check of report.checks) {
    const icon = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`[${icon}] ${check.label}: ${check.detail}`);
  }
  console.log(`\nVerdict local: ${report.localDemoReady ? "READY" : "NOT READY"}`);
  console.log(`Aperçu commercial: ${report.commercialPreviewReady ? "READY" : "NOT READY (PostgreSQL vérifié requis)"}`);

  if (!report.localDemoReady) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
