import { describe, expect, it } from "vitest";
import { companyIdFromSessionClaims, decideTenant } from "@/server/tenant";
import { DEFAULT_COMPANY_ID } from "@/data/companies";

describe("companyIdFromSessionClaims", () => {
  it("lit le claim metadata.companyId (session token personnalisé, ADR-013)", () => {
    expect(companyIdFromSessionClaims({ metadata: { companyId: "comp_rivnord" } })).toBe("comp_rivnord");
  });

  it("retombe sur publicMetadata.companyId, et trim la valeur", () => {
    expect(companyIdFromSessionClaims({ publicMetadata: { companyId: " comp_belair " } })).toBe("comp_belair");
  });

  it("null pour claims absents, vides ou de mauvais type — jamais d'invention de tenant", () => {
    expect(companyIdFromSessionClaims(null)).toBeNull();
    expect(companyIdFromSessionClaims({})).toBeNull();
    expect(companyIdFromSessionClaims({ metadata: { companyId: "  " } })).toBeNull();
    expect(companyIdFromSessionClaims({ metadata: { companyId: 42 } })).toBeNull();
  });
});

describe("decideTenant — le repli démo n'est JAMAIS silencieux (ADR-019)", () => {
  it("auth désactivée → tenant démo, sans alarme (mode dev assumé)", () => {
    expect(decideTenant(false, null)).toEqual({ companyId: DEFAULT_COMPANY_ID, source: "no-auth", warn: false });
  });

  it("auth active + claim présent → tenant explicite, sans alarme", () => {
    expect(decideTenant(true, { metadata: { companyId: "comp_rivnord" } })).toEqual({
      companyId: "comp_rivnord",
      source: "claim",
      warn: false,
    });
  });

  it("DANGER : auth active + non-founder sans companyId → repli démo SIGNALÉ", () => {
    const d = decideTenant(true, { metadata: { role: "owner" } });
    expect(d.companyId).toBe(DEFAULT_COMPANY_ID);
    expect(d.source).toBe("demo-fallback");
    expect(d.warn).toBe(true);
  });

  it("founder sans companyId → repli démo PAR CONCEPTION, pas d'alarme (ADR-017)", () => {
    const d = decideTenant(true, { metadata: { role: "founder" } });
    expect(d.source).toBe("demo-fallback");
    expect(d.warn).toBe(false);
  });

  it("rôle par défaut (owner) sans claim → signalé (jamais founder par défaut)", () => {
    expect(decideTenant(true, {}).warn).toBe(true);
  });
});
