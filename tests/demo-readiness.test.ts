import { describe, expect, it } from "vitest";
import type { ReadinessEvidence } from "@/domain/readiness";
import { evaluateDemoReadiness, type DemoReadinessFacts } from "@/services/demo-readiness";
import { evaluatePilotReadiness } from "@/services/pilot-readiness";

const verticalEvidence: ReadinessEvidence = {
  id: "evidence_demo_call",
  companyId: "comp_belair",
  kind: "demo",
  status: "simulated",
  label: "Simulé",
  detail: "Appel, actions, révision et audit relus dans le repository partagé.",
  callId: "call_comp_belair_s0",
  createdAt: "2026-06-25T12:00:00.000Z",
};

function facts(over: Partial<DemoReadinessFacts> = {}): DemoReadinessFacts {
  return {
    store: {
      provider: "memory",
      persistent: false,
      description: "Mémoire locale",
    },
    brandBoundaryPass: true,
    verticalEvidence,
    callPersisted: true,
    actionsPersisted: true,
    reviewPersisted: true,
    auditRecorded: true,
    requiredSurfaces: {
      overview: true,
      calls: true,
      followUp: true,
      learn: true,
      demoReadiness: true,
    },
    ...over,
  };
}

describe("evaluateDemoReadiness", () => {
  it("peut déclarer la démonstration locale prête en mémoire sans prétendre être commercial-preview ready", () => {
    const report = evaluateDemoReadiness(facts());
    expect(report.verdict).toBe("pass");
    expect(report.localDemoReady).toBe(true);
    expect(report.commercialPreviewReady).toBe(false);
  });

  it("échoue si la preuve verticale partagée est absente", () => {
    const report = evaluateDemoReadiness(facts({ verticalEvidence: undefined }));
    expect(report.verdict).toBe("fail");
    expect(report.localDemoReady).toBe(false);
    expect(report.blockers.map((check) => check.id)).toContain("vertical_evidence");
  });

  it("exige Postgres et un live check pour l'aperçu commercial", () => {
    const report = evaluateDemoReadiness(facts({
      store: { provider: "prisma", persistent: true, description: "Postgres" },
      persistenceLiveCheck: { ok: true, detail: "Écriture, relecture et suppression réussies." },
    }));
    expect(report.verdict).toBe("pass");
    expect(report.commercialPreviewReady).toBe(true);
  });

  it("ne modifie pas le verdict live-call : mémoire reste un WARN de persistance", () => {
    const demo = evaluateDemoReadiness(facts());
    const live = evaluatePilotReadiness(
      { STORE_PROVIDER: "memory" },
      {
        packageScripts: { typecheck: "tsc", test: "vitest", build: "next build" },
        testFiles: ["golden-set", "voice-scenarios", "voice-runtime", "caller-memory", "tenant"],
        twilioTenantMapping: false,
      },
    );

    expect(demo.localDemoReady).toBe(true);
    expect(live.checks.find((check) => check.id === "store")?.status).toBe("warn");
    expect(live.singleTenantOnly).toBe(true);
  });
});
