import { evaluateMobileStoreReadiness } from "../src/services/mobile-readiness";
import { collectMobileStoreReadinessFacts } from "../src/services/mobile-readiness-facts";

const report = evaluateMobileStoreReadiness(collectMobileStoreReadinessFacts());

console.log("\nALLÔ MAUDE — MOBILE STRUCTURE CHECK\n");
for (const check of report.checks) {
  console.log(`${check.status === "pass" ? "[PASS]" : "[FAIL]"} ${check.label}: ${check.detail}`);
}
console.log("\nPRÉREQUIS STORES\n");
for (const check of report.storeChecks) {
  console.log(`${check.status === "pass" ? "[PASS]" : "[FAIL]"} ${check.label}: ${check.detail}`);
}

console.log(`\nStructure mobile: ${report.structureReady ? "READY" : "NOT READY"}`);
console.log(`Soumission App Store / Google Play: ${report.readyForStoreSubmission ? "READY" : "NOT READY"}`);

if (!report.structureReady) {
  process.exitCode = 1;
}
