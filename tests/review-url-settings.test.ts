/**
 * PR #31 — validation du lien Google Review + persistance Company.reviewUrl.
 * Aucun appel externe : validateur pur + InMemoryStore isolé.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { InMemoryStore } from "@/server/store";
import { normalizeReviewUrl } from "@/services/review-requests";

describe("normalizeReviewUrl", () => {
  it("accepte une URL https et la retourne trimmée", () => {
    expect(normalizeReviewUrl("https://g.page/r/mon-commerce/review")).toBe("https://g.page/r/mon-commerce/review");
    expect(normalizeReviewUrl("   https://g.page/r/x/review   ")).toBe("https://g.page/r/x/review");
  });

  it("accepte le vide (aucun lien) — chaîne vide ou espaces", () => {
    expect(normalizeReviewUrl("")).toBeUndefined();
    expect(normalizeReviewUrl("   ")).toBeUndefined();
    expect(normalizeReviewUrl(undefined)).toBeUndefined();
    expect(normalizeReviewUrl(null)).toBeUndefined();
  });

  it("refuse http (non https)", () => {
    expect(() => normalizeReviewUrl("http://g.page/r/x/review")).toThrow(/https/);
  });

  it("refuse une valeur non-URL ou non-chaîne", () => {
    expect(() => normalizeReviewUrl("pas une url")).toThrow();
    expect(() => normalizeReviewUrl("javascript:alert(1)")).toThrow();
    expect(() => normalizeReviewUrl(42)).toThrow();
  });
});

describe("Company.reviewUrl — sauvegarde et préservation", () => {
  it("sauvegarde un nouveau lien https", async () => {
    const store = new InMemoryStore();
    const updated = await store.updateCompany(DEFAULT_COMPANY_ID, {
      reviewUrl: normalizeReviewUrl("https://g.page/r/nouveau/review"),
    });
    expect(updated?.reviewUrl).toBe("https://g.page/r/nouveau/review");
    expect((await store.getCompany(DEFAULT_COMPANY_ID))?.reviewUrl).toBe("https://g.page/r/nouveau/review");
  });

  it("préserve reviewUrl quand un autre champ est modifié sans le toucher", async () => {
    const store = new InMemoryStore();
    await store.updateCompany(DEFAULT_COMPANY_ID, { reviewUrl: "https://g.page/r/garde/review" });
    // Mise à jour d'un autre champ, sans reviewUrl dans le patch.
    const updated = await store.updateCompany(DEFAULT_COMPANY_ID, { city: "Terrebonne" });
    expect(updated?.city).toBe("Terrebonne");
    expect(updated?.reviewUrl).toBe("https://g.page/r/garde/review");
  });

  it("efface le lien quand on sauvegarde une valeur vide", async () => {
    const store = new InMemoryStore();
    await store.updateCompany(DEFAULT_COMPANY_ID, { reviewUrl: "https://g.page/r/x/review" });
    const cleared = await store.updateCompany(DEFAULT_COMPANY_ID, { reviewUrl: normalizeReviewUrl("") });
    expect(cleared?.reviewUrl).toBeUndefined();
  });
});
