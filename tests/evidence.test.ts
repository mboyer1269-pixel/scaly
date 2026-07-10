/**
 * Dossier d'appel vérifiable — assemblage, empreinte SHA-256 stable,
 * détection d'altération, export protégé (anti-IDOR), audit sans transcript.
 */
import { describe, expect, it, afterEach, vi } from "vitest";
import { InMemoryStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import {
  buildEvidencePackage,
  computeEvidenceHash,
  stableStringify,
  verifyEvidencePackage,
} from "@/services/evidence";
import type { Call } from "@/domain/call";
import type { Company } from "@/domain/company";

const GENERATED_AT = "2026-07-01T15:00:00.000Z";

function fakeCall(over: Partial<Call> = {}): Call {
  return {
    id: "call_twilio_CA_EVID",
    companyId: DEFAULT_COMPANY_ID,
    direction: "inbound",
    status: "completed",
    source: "live",
    fromNumber: "+15145550111",
    language: "fr",
    startedAt: "2026-07-01T14:00:00.000Z",
    durationSec: 95,
    transcript: [
      { speaker: "agent", text: "Plomberie Bélair, bonjour !", atMs: 500, lang: "fr" },
      { speaker: "caller", text: "Je conteste : je n'ai jamais annulé mon rendez-vous.", atMs: 4200, lang: "fr" },
    ],
    recordingUrl: null,
    provenance: { provider: "twilio", externalId: "CA_EVID", verifiedAt: "2026-07-01T14:00:01.000Z" },
    ...over,
  };
}

const COMPANY = { id: DEFAULT_COMPANY_ID, name: "Plomberie Bélair" } as Company;

function build(call: Call = fakeCall()) {
  return buildEvidencePackage({
    company: COMPANY,
    call,
    consents: [],
    auditTrail: [
      { at: "2026-07-01T14:02:00.000Z", companyId: DEFAULT_COMPANY_ID, actor: "scaly-realtime", event: "appel_live_persisté", detail: "call_twilio_CA_EVID" },
      { at: "2026-07-01T14:00:00.500Z", companyId: DEFAULT_COMPANY_ID, actor: "twilio", event: "appel_entrant_reçu", detail: "CA_EVID de +15145550111" },
    ],
    provenanceEvidence: [],
    generatedAt: GENERATED_AT,
  });
}

afterEach(() => {
  vi.resetModules();
  delete (globalThis as { __scalyStore?: unknown }).__scalyStore;
});

describe("buildEvidencePackage + empreinte", () => {
  it("empreinte stable : mêmes données → même hash, et l'audit est trié chronologiquement", () => {
    const a = build();
    const b = build();
    expect(a.evidenceHash).toBe(b.evidenceHash);
    expect(a.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.auditTrail[0].event).toBe("appel_entrant_reçu"); // le plus ancien d'abord
    expect(a.provenance.signatureVerified).toBe(true);
  });

  it("altération d'un mot du transcript → hash différent et vérification en échec", () => {
    const pkg = build();
    const tampered = structuredClone(pkg);
    tampered.call.transcript[1].text = "Je confirme avoir annulé mon rendez-vous.";

    expect(computeEvidenceHash(tampered)).not.toBe(pkg.evidenceHash);
    const check = verifyEvidencePackage(tampered);
    expect(check.valid).toBe(false);
    expect(check.actualHash).not.toBe(check.expectedHash);
  });

  it("dossier intact → vérification réussie", () => {
    const check = verifyEvidencePackage(build());
    expect(check.valid).toBe(true);
    expect(check.actualHash).toBe(check.expectedHash);
  });

  it("transcript vide, sans consentement ni analyse : aucun crash, dossier valide", () => {
    const pkg = build(fakeCall({ transcript: [], intelligence: undefined, provenance: undefined }));
    expect(pkg.call.transcript).toHaveLength(0);
    expect(pkg.analysis).toBeUndefined();
    expect(pkg.provenance.signatureVerified).toBe(false);
    expect(verifyEvidencePackage(pkg).valid).toBe(true);
  });

  it("stableStringify : ordre des clés indifférent, undefined omis", () => {
    expect(stableStringify({ b: 1, a: { d: undefined, c: [1, "x"] } })).toBe(`{"a":{"c":[1,"x"]},"b":1}`);
    expect(stableStringify({ a: { c: [1, "x"] }, b: 1 })).toBe(`{"a":{"c":[1,"x"]},"b":1}`);
  });

  it("le vocabulaire produit reste prudent — jamais de promesse juridique", () => {
    const pkg = build();
    for (const banned of ["certifié", "opposable", "preuve légale", "court-proof"]) {
      expect(pkg.disclaimer.toLowerCase()).not.toContain(banned);
    }
    expect(pkg.disclaimer).toContain("vérifiable");
    expect(pkg.disclaimer).toContain("ne constitue pas un avis juridique");
  });
});

describe("GET /api/calls/:id/evidence — export protégé", () => {
  async function setup(call: Call) {
    process.env.STORE_PROVIDER = "memory";
    const store = new InMemoryStore();
    await store.saveCall(call);
    (globalThis as { __scalyStore?: unknown }).__scalyStore = store;
    const { GET } = await import("@/app/api/calls/[id]/evidence/route");
    const get = (id: string) => GET(new Request(`https://scaly.test/api/calls/${id}/evidence`), { params: Promise.resolve({ id }) });
    return { store, get };
  }

  it("exporte un dossier complet pour un appel du tenant, et trace l'export SANS le transcript", async () => {
    const { store, get } = await setup(fakeCall());
    const res = await get("call_twilio_CA_EVID");
    const pkg = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("dossier-appel-call_twilio_CA_EVID.json");
    expect(pkg.schemaVersion).toBe(1);
    expect(pkg.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(pkg.call.transcript).toHaveLength(2);
    expect(pkg.provenance.signatureVerified).toBe(true);

    const audit = (await store.getAuditLog(10)).find((a) => a.event === "dossier_appel_exporté");
    expect(audit?.detail).toContain("call_twilio_CA_EVID");
    expect(audit?.detail).toContain(pkg.evidenceHash.slice(0, 16));
    expect(audit?.detail).not.toContain("rendez-vous"); // jamais de contenu de transcript dans l'audit
  });

  it("anti-IDOR : l'appel d'un autre tenant est introuvable", async () => {
    const { get } = await setup(fakeCall({ companyId: "comp_rivnord" }));
    expect((await get("call_twilio_CA_EVID")).status).toBe(404);
  });

  it("appel inexistant → 404 ; brouillon in_progress → 409", async () => {
    const { get } = await setup(fakeCall({ status: "in_progress", provenance: { provider: "twilio", externalId: "CA_EVID", checkpointAt: "2026-07-01T14:01:00.000Z" } }));
    expect((await get("call_inconnu")).status).toBe(404);
    expect((await get("call_twilio_CA_EVID")).status).toBe(409);
  });
});
