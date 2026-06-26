import { describe, expect, it } from "vitest";
import { authRuntimeMode, shouldBlockWithoutAuthConfig } from "@/server/auth-policy";
import { mobileAuthReport } from "@/server/mobile-auth";

describe("auth runtime policy", () => {
  it("blocks protected app surfaces in production when Clerk is not configured", () => {
    const env = { NODE_ENV: "production" };

    expect(authRuntimeMode(env).mode).toBe("blocked");
    expect(shouldBlockWithoutAuthConfig(env, false)).toBe(true);
  });

  it("allows local demo mode only when production auth is not required", () => {
    const env = { NODE_ENV: "development" };

    expect(authRuntimeMode(env).mode).toBe("demo-open");
    expect(shouldBlockWithoutAuthConfig(env, false)).toBe(false);
  });

  it("uses Clerk when both public and secret keys are configured", () => {
    const env = {
      NODE_ENV: "production",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_123",
      CLERK_SECRET_KEY: "sk_test_123",
    };

    expect(authRuntimeMode(env).mode).toBe("clerk");
    expect(shouldBlockWithoutAuthConfig(env, false)).toBe(false);
  });

  it("never blocks public routes only because auth keys are missing", () => {
    const env = { NODE_ENV: "production" };

    expect(shouldBlockWithoutAuthConfig(env, true)).toBe(false);
  });

  it("keeps mobile APIs fail-closed in production unless explicitly opened for demo", () => {
    expect(mobileAuthReport({ NODE_ENV: "production", SCALY_AUTH_MODE: "demo-open" }).mode).toBe("blocked");
    expect(mobileAuthReport({
      NODE_ENV: "production",
      SCALY_AUTH_MODE: "demo-open",
      SCALY_MOBILE_AUTH_MODE: "demo-open",
    }).mode).toBe("demo-open");
  });
});
