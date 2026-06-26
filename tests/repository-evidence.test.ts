import { describe, expect, it } from "vitest";
import type { ReadinessEvidence } from "@/domain/readiness";
import type { ReviewItem } from "@/domain/review";
import { InMemoryStore } from "@/server/store";

describe("shared repository evidence contract", () => {
  it("persiste la couverture, les révisions et les preuves de readiness", async () => {
    const store = new InMemoryStore();
    const company = (await store.listCompanies())[0];
    const call = (await store.listCalls(company.id))[0];

    await store.updateCompany(company.id, {
      coverage: { modes: ["after_hours", "overflow"], overflowDelaySec: 20 },
    });

    const review: ReviewItem = {
      id: "review_contract",
      companyId: company.id,
      callId: call.id,
      reason: "owner_correction",
      evidence: "Le propriétaire veut corriger la zone desservie.",
      status: "open",
      createdAt: "2026-06-25T12:00:00.000Z",
    };

    const evidence: ReadinessEvidence = {
      id: "evidence_contract",
      companyId: company.id,
      kind: "demo",
      status: "verified",
      label: "Flow local vérifié",
      detail: "Appel, action, révision et audit relus dans le store.",
      callId: call.id,
      verifiedAt: "2026-06-25T12:05:00.000Z",
      createdAt: "2026-06-25T12:05:00.000Z",
    };

    await store.saveReviewItem(review);
    await store.saveReadinessEvidence(evidence);

    expect((await store.getCompany(company.id))?.coverage?.modes).toContain("overflow");
    expect(await store.listReviewItems(company.id)).toContainEqual(review);
    expect(await store.listReadinessEvidence(company.id, "demo")).toContainEqual(evidence);
  });

  it("résout une révision avec une note et une date", async () => {
    const store = new InMemoryStore();
    const company = (await store.listCompanies())[0];
    const call = (await store.listCalls(company.id))[0];
    const review: ReviewItem = {
      id: "review_resolve",
      companyId: company.id,
      callId: call.id,
      reason: "owner_correction",
      evidence: "Correction demandée.",
      status: "open",
      createdAt: "2026-06-25T12:00:00.000Z",
    };
    await store.saveReviewItem(review);

    const resolved = await store.resolveReviewItem(
      review.id,
      "Zone desservie mise à jour.",
      "resolved",
      new Date("2026-06-25T12:10:00.000Z"),
    );

    expect(resolved).toEqual(expect.objectContaining({
      status: "resolved",
      resolution: "Zone desservie mise à jour.",
      resolvedAt: "2026-06-25T12:10:00.000Z",
    }));
  });
});
