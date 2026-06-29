import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import type { VoiceSessionRecord } from "@/domain/voice";
import { authRuntimeMode, shouldBlockWithoutAuthConfig } from "@/server/auth-policy";
import { filterVoiceSessionsForTenant } from "@/services/voice-lab-security";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function clearAuthEnv() {
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.SCALY_AUTH_MODE;
}

function configureClerkAuth(claims: unknown) {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_pr2";
  process.env.CLERK_SECRET_KEY = "sk_test_pr2";
  vi.doMock("@clerk/nextjs/server", () => ({
    auth: vi.fn(async () => ({ sessionClaims: claims })),
  }));
}

function setStore(store: unknown) {
  (globalThis as { __scalyStore?: unknown }).__scalyStore = store;
}

function record(id: string, companyId: string, startedAt: string): VoiceSessionRecord {
  return {
    id,
    companyId,
    scenarioId: "scenario_test",
    status: "completed",
    language: "fr",
    startedAt,
    endedAt: startedAt,
    turns: [],
    events: [],
    fields: [],
    telemetry: {
      totalDurationMs: 1000,
      turnCount: 1,
      callerTurnCount: 0,
      agentTurnCount: 1,
      perceivedLatenciesMs: [100],
      perceivedP50Ms: 100,
      perceivedP95Ms: 100,
      latencyBudgetMet: true,
      sttTotalMs: 0,
      brainTotalMs: 100,
      ttsTotalMs: 0,
      fieldsConfirmed: 0,
      fieldsInferred: 0,
      fieldsMissing: 0,
      fieldsConflicted: 0,
      avgFieldConfidence: 0,
      languageSwitches: 0,
      interruptions: 0,
      transferRequested: false,
      finalStatus: "completed",
      latenciesSimulated: true,
    },
  };
}

async function loadMemoryStoreWithVoiceSessions() {
  const { InMemoryStore } = await import("@/server/store");
  const store = new InMemoryStore();
  await store.saveVoiceSession(record("vs_belair", DEFAULT_COMPANY_ID, "2026-06-01T10:00:00.000Z"));
  await store.saveVoiceSession(record("vs_rivnord", "comp_rivnord", "2026-06-02T10:00:00.000Z"));
  setStore(store);
  return store;
}

afterEach(() => {
  restoreEnv();
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("@clerk/nextjs/server");
  delete (globalThis as { __scalyStore?: unknown }).__scalyStore;
});

describe("PR2 auth required", () => {
  it("bloque les surfaces protégées en 503 quand SCALY_AUTH_MODE=required sans clés Clerk", async () => {
    clearAuthEnv();
    process.env.SCALY_AUTH_MODE = "required";

    expect(authRuntimeMode(process.env).mode).toBe("blocked");
    expect(shouldBlockWithoutAuthConfig(process.env, false)).toBe(true);

    vi.resetModules();
    const mod = await import("../src/middleware");
    const exported = mod.default as unknown;
    const middleware =
      typeof exported === "function"
        ? exported
        : (exported as { default: (req: NextRequest) => Promise<Response> | Response }).default;
    const res = await middleware(new NextRequest("http://localhost/dashboard"));

    expect(res.status).toBe(503);
    await expect(res.text()).resolves.toContain("authentification requise");
  });
});

describe("PR2 requireTenant", () => {
  it("préserve le mode no-auth : la démo locale retombe sur DEFAULT_COMPANY_ID sans blocage", async () => {
    clearAuthEnv();

    const { requireTenant, resolveCompanyId } = await import("@/server/tenant");

    await expect(resolveCompanyId()).resolves.toBe(DEFAULT_COMPANY_ID);
    await expect(requireTenant()).resolves.toEqual({ companyId: DEFAULT_COMPANY_ID });
  });

  it("bloque seulement le fallback dangereux : auth active + non-founder sans companyId", async () => {
    clearAuthEnv();
    configureClerkAuth({ metadata: { role: "owner" } });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { requireTenant } = await import("@/server/tenant");

    await expect(requireTenant()).resolves.toEqual({ block: true });
  });

  it("autorise une session avec companyId explicite", async () => {
    clearAuthEnv();
    configureClerkAuth({ metadata: { role: "owner", companyId: "comp_rivnord" } });

    const { requireTenant } = await import("@/server/tenant");

    await expect(requireTenant()).resolves.toEqual({ companyId: "comp_rivnord" });
  });

  it("garde le fallback founder vers la démo sans warn", async () => {
    clearAuthEnv();
    configureClerkAuth({ metadata: { role: "founder" } });

    const { requireTenant } = await import("@/server/tenant");

    await expect(requireTenant()).resolves.toEqual({ companyId: DEFAULT_COMPANY_ID });
  });
});

describe("PR2 isolation routes", () => {
  it("empêche un tenant A de lire les appels du tenant B même avec companyId demandé", async () => {
    clearAuthEnv();
    configureClerkAuth({ metadata: { role: "owner", companyId: "comp_rivnord" } });
    await loadMemoryStoreWithVoiceSessions();

    const { GET } = await import("@/app/api/calls/route");
    const res = await GET(new Request(`http://localhost/api/calls?companyId=${DEFAULT_COMPANY_ID}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.calls.length).toBeGreaterThan(0);
    expect(body.calls.every((call: { companyId: string }) => call.companyId === "comp_rivnord")).toBe(true);
  });

  it("export/calls continue de filtrer le CSV sur le tenant résolu", async () => {
    clearAuthEnv();
    configureClerkAuth({ metadata: { role: "owner", companyId: "comp_rivnord" } });
    const store = await loadMemoryStoreWithVoiceSessions();
    const expectedTenantCalls = await store.listCalls("comp_rivnord");
    const allCalls = await store.listCalls();

    const { GET } = await import("@/app/api/export/calls/route");
    const res = await GET(new Request("http://localhost/api/export/calls"));
    const csv = await res.text();
    const dataRows = csv.trim().split(/\r?\n/).slice(1);

    expect(res.status).toBe(200);
    expect(expectedTenantCalls.length).toBeGreaterThan(0);
    expect(allCalls.length).toBeGreaterThan(expectedTenantCalls.length);
    expect(dataRows).toHaveLength(expectedTenantCalls.length);
  });

  it("filtre l'historique Voice Lab au tenant courant pour un non-founder", async () => {
    clearAuthEnv();
    configureClerkAuth({ metadata: { role: "owner", companyId: "comp_rivnord" } });
    await loadMemoryStoreWithVoiceSessions();

    const { GET } = await import("@/app/api/voice-lab/sessions/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessions.map((s: { id: string }) => s.id)).toEqual(["vs_rivnord"]);
  });

  it("bloque l'historique Voice Lab pour un non-founder sans companyId", async () => {
    clearAuthEnv();
    configureClerkAuth({ metadata: { role: "owner" } });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await loadMemoryStoreWithVoiceSessions();

    const { GET } = await import("@/app/api/voice-lab/sessions/route");
    const res = await GET();

    expect(res.status).toBe(404);
  });

  it("laisse le founder voir toutes les sessions Voice Lab", async () => {
    clearAuthEnv();
    configureClerkAuth({ metadata: { role: "founder" } });
    await loadMemoryStoreWithVoiceSessions();

    const { GET } = await import("@/app/api/voice-lab/sessions/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessions.map((s: { id: string }) => s.id).sort()).toEqual(["vs_belair", "vs_rivnord"]);
  });

  it("préserve la démo no-auth sur Voice Lab sans exposer les autres tenants", async () => {
    clearAuthEnv();
    await loadMemoryStoreWithVoiceSessions();

    const { GET } = await import("@/app/api/voice-lab/sessions/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessions.map((s: { id: string }) => s.id)).toEqual(["vs_belair"]);
  });
});

describe("filterVoiceSessionsForTenant", () => {
  const records = [
    record("vs_a", "comp_a", "2026-06-01T10:00:00.000Z"),
    record("vs_b", "comp_b", "2026-06-02T10:00:00.000Z"),
  ];

  it("filtre pour owner/staff et conserve tout pour founder", () => {
    expect(filterVoiceSessionsForTenant(records, "comp_a", "owner").map((r) => r.id)).toEqual(["vs_a"]);
    expect(filterVoiceSessionsForTenant(records, "comp_a", "staff").map((r) => r.id)).toEqual(["vs_a"]);
    expect(filterVoiceSessionsForTenant(records, "comp_a", "founder").map((r) => r.id)).toEqual(["vs_a", "vs_b"]);
  });
});
