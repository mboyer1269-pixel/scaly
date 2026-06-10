import { describe, expect, it } from "vitest";
import {
  computeCommercialScore,
  estimateValueCad,
  extractMentionedAmountCad,
  leadWeight,
  urgencyWeight,
} from "@/services/scoring";

describe("scoring", () => {
  it("ordonne les poids d'urgence", () => {
    expect(urgencyWeight("critique")).toBeGreaterThan(urgencyWeight("haute"));
    expect(urgencyWeight("haute")).toBeGreaterThan(urgencyWeight("normale"));
    expect(urgencyWeight("normale")).toBeGreaterThan(urgencyWeight("basse"));
  });

  it("estime la valeur selon le palier", () => {
    expect(estimateValueCad("haut", 1000)).toBe(1600);
    expect(estimateValueCad("moyen", 1000)).toBe(1000);
    expect(estimateValueCad("bas", 1000)).toBe(400);
    expect(estimateValueCad("nul", 1000)).toBe(0);
  });

  it("extrait les montants FR et EN", () => {
    expect(extractMentionedAmountCad("autour de 5 000 $")).toBe(5000);
    expect(extractMentionedAmountCad("my budget is around $3,500")).toBe(3500);
    expect(extractMentionedAmountCad("environ 2500 dollars")).toBe(2500);
    expect(extractMentionedAmountCad("aucun montant ici")).toBeNull();
  });

  it("borne le score commercial entre 0 et 100, lead chaud > froid", () => {
    const base = { sentiment: "neutre" as const, fieldsCollected: 4, fieldsRequired: 4, estimatedValueCad: 1000, valueBaselineCad: 1000 };
    const hot = computeCommercialScore({ ...base, urgency: "critique", leadQuality: "chaud" });
    const cold = computeCommercialScore({ ...base, urgency: "basse", leadQuality: "froid" });
    expect(hot).toBeGreaterThan(cold);
    expect(hot).toBeLessThanOrEqual(100);
    expect(cold).toBeGreaterThanOrEqual(0);
    expect(leadWeight("chaud")).toBe(1);
  });
});
