import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sourceAt(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function routeFilesUnder(path: string): string[] {
  const absolute = resolve(process.cwd(), path);
  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...routeFilesUnder(relative(process.cwd(), child)));
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(relative(process.cwd(), child).replaceAll("\\", "/"));
    }
  }
  return files.sort();
}

function publicMiddlewareRoutes(): string[] {
  const middleware = sourceAt("src/middleware.ts");
  const match = middleware.match(/const isPublicRoute = createRouteMatcher\(\[([\s\S]*?)\]\);/);
  if (!match) throw new Error("isPublicRoute matcher not found");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe("public route contract", () => {
  it("keeps the middleware public API allowlist explicit", () => {
    const publicApiRoutes = publicMiddlewareRoutes().filter((route) => route.startsWith("/api/")).sort();

    expect(publicApiRoutes).toEqual([
      "/api/billing/checkout(.*)",
      "/api/billing/webhook(.*)",
      "/api/cron/(.*)",
      "/api/health(.*)",
      "/api/mobile/(.*)",
      "/api/sms/incoming(.*)",
      "/api/voice/(.*)",
    ]);
  });

  it("keeps cron endpoints protected by CRON_SECRET inside the route", () => {
    for (const file of routeFilesUnder("src/app/api/cron")) {
      const source = sourceAt(file);
      expect(source, `${file} must require CRON_SECRET`).toContain("CRON_SECRET");
      expect(source, `${file} must check the Authorization header`).toContain("authorization");
      expect(source, `${file} must use the Vercel Cron bearer contract`).toContain("Bearer");
    }
  });

  it("keeps public Twilio endpoints signature-checked and tenant-routed", () => {
    for (const file of routeFilesUnder("src/app/api/sms")) {
      const source = sourceAt(file);
      expect(source, `${file} must validate Twilio signatures`).toContain("validateTwilioSignature");
      expect(source, `${file} must resolve the called-number tenant`).toContain("resolveTwilioTenant");
    }

    for (const file of routeFilesUnder("src/app/api/voice")) {
      const source = sourceAt(file);
      const isRealtimeBridge = source.includes("REALTIME_SHARED_SECRET") && source.includes("NODE_ENV");
      const isTwilioWebhook = source.includes("validateTwilioSignature") && source.includes("resolveTwilioTenant");
      expect(isRealtimeBridge || isTwilioWebhook, `${file} must have a local public-route guard`).toBe(true);
    }
  });

  it("keeps billing public routes guarded by their own controls", () => {
    const webhook = sourceAt("src/app/api/billing/webhook/route.ts");
    expect(webhook).toContain("STRIPE_WEBHOOK_SECRET");
    expect(webhook).toContain("verifyStripeSignature");

    const checkout = sourceAt("src/app/api/billing/checkout/route.ts");
    expect(checkout).toContain("createRateLimiter");
    expect(checkout).toContain("tooManyRequests");
    expect(checkout).toContain("isStripeConfigured");
  });

  it("keeps every mobile API route behind route-level mobile auth", () => {
    for (const file of routeFilesUnder("src/app/api/mobile")) {
      const source = sourceAt(file);
      expect(source, `${file} must require mobile bearer auth`).toContain("requireMobileBearer");
      expect(source, `${file} must return the mobile auth failure before reading data`).toContain("authError");
    }
  });
});
