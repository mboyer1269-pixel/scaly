import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { InMemoryStore } from "@/server/store";
import { buildCompanyPrivacyExport, deleteCompanyAccountData } from "@/services/privacy";

describe("privacy export and account deletion", () => {
  it("exports inspectable company data needed for account portability", async () => {
    const store = new InMemoryStore();

    const exported = await buildCompanyPrivacyExport(store, DEFAULT_COMPANY_ID);

    expect(exported.company.id).toBe(DEFAULT_COMPANY_ID);
    expect(exported.calls.length).toBeGreaterThan(0);
    expect(exported.generatedAt).toMatch(/T/);
    expect(exported.realityLabel.state).toBe("configured_not_verified");
  });

  it("deletes account data and leaves only an audit proof", async () => {
    const store = new InMemoryStore();

    const result = await deleteCompanyAccountData(store, DEFAULT_COMPANY_ID, "owner-request");

    expect(result.deleted.calls).toBeGreaterThan(0);
    expect(result.deleted.actions).toBeGreaterThan(0);
    expect(result.deleted.usagePeriods).toBe(0);
    expect(await store.getCompany(DEFAULT_COMPANY_ID)).toBeUndefined();
    expect((await store.listCalls(DEFAULT_COMPANY_ID)).length).toBe(0);
    expect((await store.listActions(DEFAULT_COMPANY_ID)).length).toBe(0);
    expect((await store.getAuditLog(5)).some((entry) => entry.event === "account_data_deleted")).toBe(true);
  });
});
