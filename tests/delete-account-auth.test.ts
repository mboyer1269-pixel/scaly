/**
 * Barrière de suppression de compte (P0 sécurité) : owner/founder seulement,
 * jamais sur un repli démo/no-auth. Tests PURS de la décision de tenant + test
 * de contrat sur le code des routes (comme public-route-contract).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { decideTenant, requireClaimedTenantDecision } from "@/server/tenant";

function sourceAt(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("requireClaimedTenantDecision (garde des opérations destructrices)", () => {
  it("autorise UNIQUEMENT un tenant issu d'un claim réel", () => {
    const decision = decideTenant(true, { metadata: { companyId: "comp_reel" } });
    expect(requireClaimedTenantDecision(decision)).toEqual({ companyId: "comp_reel" });
  });

  it("bloque le mode no-auth (dev/démo) — jamais de suppression sans session", () => {
    const decision = decideTenant(false, {});
    expect(decision.companyId).toBe(DEFAULT_COMPANY_ID);
    expect(requireClaimedTenantDecision(decision)).toEqual({ block: true });
  });

  it("bloque un utilisateur authentifié SANS companyId (repli démo) — non-founder", () => {
    const decision = decideTenant(true, {}); // rôle owner par défaut, aucun companyId
    expect(decision.source).toBe("demo-fallback");
    expect(requireClaimedTenantDecision(decision)).toEqual({ block: true });
  });

  it("bloque MÊME le founder sur le repli démo — supprimer la démo reste interdit", () => {
    const decision = decideTenant(true, { metadata: { role: "founder" } });
    expect(decision.companyId).toBe(DEFAULT_COMPANY_ID);
    expect(decision.warn).toBe(false); // le founder lit la démo sans alarme…
    expect(requireClaimedTenantDecision(decision)).toEqual({ block: true }); // …mais ne l'efface pas
  });
});

describe("contrat des routes de suppression de compte", () => {
  it("la route web exige le rôle owner/founder ET un tenant réclamé", () => {
    const src = sourceAt("src/app/api/privacy/delete-account/route.ts");
    expect(src, "doit lire le rôle de session").toContain("getSessionRole");
    expect(src, "doit exiger owner/founder").toMatch(/"owner"|'owner'/);
    expect(src, "doit refuser (403) les autres rôles").toContain("403");
    expect(src, "doit exiger un tenant réclamé").toContain("requireClaimedTenant");
    expect(src, "ne doit PLUS utiliser resolveCompanyId (repli démo)").not.toContain("resolveCompanyId");
  });

  it("la route mobile exige le bearer ET un tenant réclamé (pas de repli démo)", () => {
    const src = sourceAt("src/app/api/mobile/v1/privacy/delete-account/route.ts");
    expect(src, "doit exiger le bearer mobile").toContain("requireMobileBearer");
    expect(src, "doit exiger un tenant réclamé").toContain("requireClaimedTenant");
    expect(src, "ne doit PLUS utiliser resolveCompanyId (repli démo)").not.toContain("resolveCompanyId");
  });
});
