import { describe, expect, it } from "vitest";
import { evaluateMobileStoreReadiness } from "@/services/mobile-readiness";

describe("mobile store readiness gate", () => {
  it("is not ready without native project, auth, privacy and store metadata", () => {
    const report = evaluateMobileStoreReadiness({
      expoProjectConfigured: false,
      easConfigured: false,
      apiBaseUrlConfigured: false,
      mobileAuthModel: "none",
      accountDeletionPath: false,
      privacyExportPath: false,
      storeMetadataPrepared: false,
      pushNotificationPlan: false,
      deepLinkSchemeConfigured: false,
    });

    expect(report.structureReady).toBe(false);
    expect(report.readyForStoreSubmission).toBe(false);
    expect(report.blockers.map((item) => item.id)).toContain("expo-project");
    expect(report.blockers.map((item) => item.id)).toContain("account-deletion");
  });

  it("is structurally ready with shared bearer auth but not store-submission ready", () => {
    const report = evaluateMobileStoreReadiness({
      expoProjectConfigured: true,
      easConfigured: true,
      apiBaseUrlConfigured: true,
      mobileAuthModel: "shared_bearer",
      accountDeletionPath: true,
      privacyExportPath: true,
      storeMetadataPrepared: true,
      pushNotificationPlan: true,
      deepLinkSchemeConfigured: true,
    });

    expect(report.structureReady).toBe(true);
    expect(report.readyForStoreSubmission).toBe(false);
    expect(report.blockers).toEqual([]);
    expect(report.storeBlockers.map((item) => item.id)).toContain("native-user-auth");
  });

  it("passes store submission readiness only with native per-user auth", () => {
    const report = evaluateMobileStoreReadiness({
      expoProjectConfigured: true,
      easConfigured: true,
      apiBaseUrlConfigured: true,
      mobileAuthModel: "native_user",
      accountDeletionPath: true,
      privacyExportPath: true,
      storeMetadataPrepared: true,
      pushNotificationPlan: true,
      deepLinkSchemeConfigured: true,
    });

    expect(report.structureReady).toBe(true);
    expect(report.readyForStoreSubmission).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.storeBlockers).toEqual([]);
  });
});
