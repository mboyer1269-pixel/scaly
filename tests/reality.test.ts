import { describe, expect, it } from "vitest";
import type { Call } from "@/domain/call";
import type { ReadinessEvidence } from "@/domain/readiness";
import type { StoreInfo } from "@/server/store";
import { deriveCallReality, deriveProviderReality } from "@/services/reality";

function call(source: Call["source"]): Call {
  return {
    id: `call_${source}`,
    companyId: "comp_test",
    direction: "inbound",
    status: "completed",
    source,
    fromNumber: "514-555-0101",
    language: "fr",
    startedAt: "2026-06-25T12:00:00.000Z",
    durationSec: 60,
    transcript: [],
    recordingUrl: null,
  };
}

const memory: StoreInfo = { provider: "memory", persistent: false, description: "mémoire" };
const prisma: StoreInfo = { provider: "prisma", persistent: true, description: "Postgres" };

const verified: ReadinessEvidence = {
  id: "evidence_live_call",
  companyId: "comp_test",
  kind: "live_call",
  status: "verified",
  label: "Appel réel vérifié",
  detail: "Twilio CA123 terminé et persisté.",
  callId: "call_live",
  verifiedAt: "2026-06-25T12:05:00.000Z",
  createdAt: "2026-06-25T12:05:00.000Z",
};

describe("reality labels", () => {
  it("marque un appel du simulateur comme simulé même si le store est persistant", () => {
    expect(deriveCallReality(call("simulator"), prisma).state).toBe("simulated");
  });

  it("marque un appel live persistant comme vérifié seulement avec une preuve vérifiée", () => {
    expect(deriveCallReality(call("live"), prisma, verified).state).toBe("verified");
  });

  it("ne présente jamais un appel live en mémoire comme vérifié", () => {
    expect(deriveCallReality(call("live"), memory, verified).state).toBe("configured_not_verified");
  });

  it("distingue configuré non vérifié et indisponible pour un provider", () => {
    expect(deriveProviderReality({ configured: true, verified: false, detail: "Clé présente" }).state)
      .toBe("configured_not_verified");
    expect(deriveProviderReality({ configured: false, verified: false, detail: "Clé absente" }).state)
      .toBe("unavailable");
  });
});
