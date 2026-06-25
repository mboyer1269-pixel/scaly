import type { ReadinessEvidence } from "@/domain/readiness";
import type { LiveCheck, StoreInfo } from "@/server/store";
import type { GateCheck, GateStatus } from "./pilot-readiness";

export interface DemoReadinessFacts {
  store: StoreInfo;
  persistenceLiveCheck?: Pick<LiveCheck, "ok" | "detail">;
  brandBoundaryPass: boolean;
  verticalEvidence?: ReadinessEvidence;
  callPersisted: boolean;
  actionsPersisted: boolean;
  reviewPersisted: boolean;
  auditRecorded: boolean;
  requiredSurfaces: {
    overview: boolean;
    calls: boolean;
    followUp: boolean;
    learn: boolean;
    demoReadiness: boolean;
  };
}

export interface DemoReadinessReport {
  verdict: GateStatus;
  localDemoReady: boolean;
  commercialPreviewReady: boolean;
  checks: GateCheck[];
  blockers: GateCheck[];
}

export function evaluateDemoReadiness(facts: DemoReadinessFacts): DemoReadinessReport {
  const checks: GateCheck[] = [];
  const add = (check: GateCheck) => checks.push(check);

  add({
    id: "brand_boundary",
    label: "Marque client",
    status: facts.brandBoundaryPass ? "pass" : "fail",
    blocking: !facts.brandBoundaryPass,
    detail: facts.brandBoundaryPass
      ? "Les surfaces client utilisent Allô Maude; Scaly reste technique."
      : "Une surface client expose encore Scaly comme produit.",
  });

  const evidenceValid =
    facts.verticalEvidence?.kind === "demo" &&
    facts.verticalEvidence.status === "simulated" &&
    Boolean(facts.verticalEvidence.callId);
  add({
    id: "vertical_evidence",
    label: "Preuve verticale",
    status: evidenceValid ? "pass" : "fail",
    blocking: !evidenceValid,
    detail: evidenceValid
      ? facts.verticalEvidence?.detail ?? "Preuve verticale persistée."
      : "Aucune preuve simulée liée à un appel persisté.",
  });

  const persisted = facts.callPersisted && facts.actionsPersisted && facts.reviewPersisted && facts.auditRecorded;
  add({
    id: "shared_repository",
    label: "Repository partagé",
    status: persisted ? "pass" : "fail",
    blocking: !persisted,
    detail: persisted
      ? "Appel, actions, révision et audit relus dans le même repository."
      : "Au moins un artefact du flow n'est pas relu dans le repository partagé.",
  });

  const missingSurfaces = Object.entries(facts.requiredSurfaces)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  add({
    id: "operational_surfaces",
    label: "Surfaces opérationnelles",
    status: missingSurfaces.length === 0 ? "pass" : "fail",
    blocking: missingSurfaces.length > 0,
    detail: missingSurfaces.length === 0
      ? "Overview, Calls, To follow up, Learn et Demo readiness sont reliés."
      : `Surfaces absentes : ${missingSurfaces.join(", ")}.`,
  });

  const commercialPreviewReady =
    facts.store.provider === "prisma" &&
    facts.store.persistent &&
    facts.persistenceLiveCheck?.ok === true;
  add({
    id: "commercial_persistence",
    label: "Persistance commerciale",
    status: commercialPreviewReady ? "pass" : "warn",
    detail: commercialPreviewReady
      ? facts.persistenceLiveCheck?.detail ?? "PostgreSQL vérifié."
      : "Mode local seulement : la mémoire ne peut pas recevoir un verdict d'aperçu commercial.",
  });

  const blockers = checks.filter((check) => check.status === "fail" || check.blocking);
  const localDemoReady = blockers.length === 0;
  return {
    verdict: localDemoReady ? "pass" : "fail",
    localDemoReady,
    commercialPreviewReady,
    checks,
    blockers,
  };
}
