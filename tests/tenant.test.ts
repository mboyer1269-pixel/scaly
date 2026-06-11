import { describe, expect, it } from "vitest";
import { companyIdFromSessionClaims } from "@/server/tenant";

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
