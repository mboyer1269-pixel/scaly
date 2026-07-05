/**
 * Barrière des exports de données (Loi 25) : jamais d'export du tenant démo via
 * le repli no-auth/démo. Test de contrat sur le code des deux routes d'export
 * (la décision pure requireClaimedTenantDecision est testée dans
 * delete-account-auth.test.ts).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sourceAt(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("contrat des routes d'export privé", () => {
  it("la route web exige un tenant réclamé (pas de repli démo)", () => {
    const src = sourceAt("src/app/api/privacy/export/route.ts");
    expect(src, "doit exiger un tenant réclamé").toContain("requireClaimedTenant");
    expect(src, "doit bloquer (409) sans claim").toContain("409");
    expect(src, "ne doit PLUS utiliser resolveCompanyId (repli démo)").not.toContain("resolveCompanyId");
  });

  it("la route mobile exige le bearer ET un tenant réclamé", () => {
    const src = sourceAt("src/app/api/mobile/v1/privacy/export/route.ts");
    expect(src, "doit exiger le bearer mobile").toContain("requireMobileBearer");
    expect(src, "doit exiger un tenant réclamé").toContain("requireClaimedTenant");
    expect(src, "ne doit PLUS utiliser resolveCompanyId (repli démo)").not.toContain("resolveCompanyId");
  });
});
