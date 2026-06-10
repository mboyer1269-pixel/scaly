import { describe, expect, it } from "vitest";
import { computeInvoice, PLANS } from "@/domain/billing";

describe("billing", () => {
  it("ne facture pas d'excédent sous le quota", () => {
    const inv = computeInvoice("pro", 500);
    expect(inv.overageMinutes).toBe(0);
    expect(inv.totalCad).toBe(PLANS.pro.priceMonthlyCad);
  });

  it("calcule l'excédent exactement", () => {
    const inv = computeInvoice("starter", 350);
    expect(inv.overageMinutes).toBe(50);
    expect(inv.overageCad).toBeCloseTo(50 * PLANS.starter.overagePerMinuteCad, 2);
    expect(inv.totalCad).toBeCloseTo(PLANS.starter.priceMonthlyCad + inv.overageCad, 2);
  });

  it("définit les trois plans avec minutes incluses croissantes", () => {
    expect(PLANS.starter.includedMinutes).toBeLessThan(PLANS.pro.includedMinutes);
    expect(PLANS.pro.includedMinutes).toBeLessThan(PLANS.premium.includedMinutes);
  });
});
