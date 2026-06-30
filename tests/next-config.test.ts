import { describe, expect, it } from "vitest";

type HostRule = { value: string };
type RedirectRule = { has?: HostRule[]; destination: string };
type HeaderRule = { key: string; value: string };
type HeaderEntry = { headers: HeaderRule[] };

describe("next config", () => {
  it("keeps brand-domain redirects scoped to brand hosts only", async () => {
    const mod = await import("../next.config.mjs");
    if (!mod.default.redirects) throw new Error("redirects config missing");
    const redirects = (await mod.default.redirects()) as RedirectRule[];
    expect(redirects).toHaveLength(3);
    expect(redirects.map((r) => r.has?.[0].value).sort()).toEqual([
      "allomaude.com",
      "www.allomaude.ca",
      "www.allomaude.com",
    ]);
    expect(redirects.every((r) => r.destination === "https://allomaude.ca/:path*")).toBe(true);
    expect(redirects.some((r) => r.has?.[0].value.includes("scaly"))).toBe(false);
  });

  it("adds baseline security headers", async () => {
    const mod = await import("../next.config.mjs");
    if (!mod.default.headers) throw new Error("headers config missing");
    const entries = (await mod.default.headers()) as HeaderEntry[];
    const headers = Object.fromEntries(entries[0].headers.map((h) => [h.key, h.value]));
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });
});
