/**
 * Le Pilot Readiness Gate est un GARDE-FOU de mise en production, pas un tableau
 * de bord cosmétique : chaque verdict (PASS/WARN/FAIL) et chaque bloquant doit
 * tomber pour la bonne raison, dans le bon environnement.
 */
import { describe, expect, it } from "vitest";
import { evaluatePilotReadiness, type PilotEnv, type PilotFacts } from "@/services/pilot-readiness";

/** Faits « dépôt sain » : tous les scripts CI et tests garde-fous présents. */
const HEALTHY_FACTS: PilotFacts = {
  packageScripts: { typecheck: "tsc", test: "vitest", build: "next build" },
  testFiles: ["golden-set.test.ts", "voice-scenarios.test.ts", "voice-runtime.test.ts", "caller-memory.test.ts", "tenant.test.ts"],
  twilioTenantMapping: false,
};

function check(report: ReturnType<typeof evaluatePilotReadiness>, id: string) {
  const c = report.checks.find((x) => x.id === id);
  if (!c) throw new Error(`check ${id} absent`);
  return c;
}

describe("evaluatePilotReadiness — environnement de dev local (démo)", () => {
  const env: PilotEnv = { STORE_PROVIDER: "memory" };
  const report = evaluatePilotReadiness(env, HEALTHY_FACTS);

  it("verdict WARN (jamais FAIL) — la démo locale ne casse pas la CI", () => {
    expect(report.verdict).toBe("warn");
  });

  it("un premier appel réel est possible via le repli humain seulement", () => {
    expect(report.canMakeRealCall.possible).toBe(true);
    expect(report.canMakeRealCall.mode).toBe("repli_humain");
  });

  it("toujours mono-tenant tant que le mapping Twilio→companyId n'existe pas", () => {
    expect(report.singleTenantOnly).toBe(true);
    expect(check(report, "tenant_mapping").status).toBe("warn");
  });

  it("auth désactivée = WARN assumé, pas FAIL", () => {
    expect(check(report, "auth").status).toBe("warn");
  });

  it("repli <Dial> ACTIF quand SCALY_REALTIME_WS_URL est absente", () => {
    expect(check(report, "realtime_transport").status).toBe("warn");
    expect(check(report, "realtime_transport").detail).toContain("repli <Dial>");
  });
});

describe("evaluatePilotReadiness — production durcie complète", () => {
  const env: PilotEnv = {
    NODE_ENV: "production",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
    CLERK_SECRET_KEY: "sk_live_x",
    STORE_PROVIDER: "prisma",
    DATABASE_URL: "postgresql://x",
    REALTIME_SHARED_SECRET: "s3cr3t",
    TWILIO_AUTH_TOKEN: "tok",
    SCALY_REALTIME_WS_URL: "wss://bridge/twilio",
    SCALY_PUBLIC_URL: "https://app",
    OPENAI_API_KEY: "sk-openai",
    CRON_SECRET: "cron",
  };
  const facts: PilotFacts = { ...HEALTHY_FACTS, liveCheck: { ok: true, detail: "aller-retour OK (12 ms)" } };
  const report = evaluatePilotReadiness(env, facts);

  it("verdict WARN : tout est vert SAUF la posture mono-tenant (honnête)", () => {
    // Le seul WARN restant est le mapping Twilio→companyId.
    const nonPass = report.checks.filter((c) => c.status !== "pass");
    expect(nonPass).toHaveLength(1);
    expect(nonPass[0].id).toBe("tenant_mapping");
    expect(report.verdict).toBe("warn");
  });

  it("appel réel IA complet possible", () => {
    expect(report.canMakeRealCall.possible).toBe(true);
    expect(report.canMakeRealCall.mode).toBe("ia");
  });

  it("la vérification vivante de la base passe quand l'aller-retour est OK", () => {
    expect(check(report, "store_live").status).toBe("pass");
  });
});

describe("evaluatePilotReadiness — bloquants de production", () => {
  it("FAIL si auth désactivée en production", () => {
    const r = evaluatePilotReadiness({ NODE_ENV: "production", STORE_PROVIDER: "prisma", DATABASE_URL: "x" }, HEALTHY_FACTS);
    expect(check(r, "auth").status).toBe("fail");
    expect(r.verdict).toBe("fail");
    expect(r.canMakeRealCall.possible).toBe(false);
  });

  it("FAIL si STORE_PROVIDER=prisma sans DATABASE_URL", () => {
    const r = evaluatePilotReadiness({ STORE_PROVIDER: "prisma" }, HEALTHY_FACTS);
    expect(check(r, "store").status).toBe("fail");
    expect(check(r, "store").blocking).toBe(true);
  });

  it("FAIL si STORE_PROVIDER=memory en production (appels perdus au redémarrage)", () => {
    const r = evaluatePilotReadiness({ NODE_ENV: "production", STORE_PROVIDER: "memory" }, HEALTHY_FACTS);
    expect(check(r, "store").status).toBe("fail");
  });

  it("FAIL si REALTIME_SHARED_SECRET absent en production", () => {
    const r = evaluatePilotReadiness({ NODE_ENV: "production", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "x", CLERK_SECRET_KEY: "x", STORE_PROVIDER: "prisma", DATABASE_URL: "x", TWILIO_AUTH_TOKEN: "x", OPENAI_API_KEY: "x", SCALY_REALTIME_WS_URL: "wss://x" }, HEALTHY_FACTS);
    expect(check(r, "realtime_secret").status).toBe("fail");
  });

  it("FAIL si webhook public sans TWILIO_AUTH_TOKEN (appels forgeables)", () => {
    const r = evaluatePilotReadiness({ SCALY_PUBLIC_URL: "https://app", STORE_PROVIDER: "memory" }, HEALTHY_FACTS);
    expect(check(r, "twilio_signature").status).toBe("fail");
  });

  it("FAIL — piège : WS posé mais OPENAI_API_KEY absent → l'appel tombe sans repli", () => {
    const r = evaluatePilotReadiness({ STORE_PROVIDER: "memory", SCALY_REALTIME_WS_URL: "wss://bridge" }, HEALTHY_FACTS);
    expect(check(r, "realtime_transport").status).toBe("fail");
    expect(check(r, "realtime_transport").detail).toContain("SANS repli");
  });

  it("vérification vivante FAIL si l'aller-retour échoue", () => {
    const r = evaluatePilotReadiness({ STORE_PROVIDER: "prisma", DATABASE_URL: "x" }, { ...HEALTHY_FACTS, liveCheck: { ok: false, detail: "connexion refusée" } });
    expect(check(r, "store_live").status).toBe("fail");
  });
});

describe("evaluatePilotReadiness — intégrité du dépôt", () => {
  it("FAIL si une commande CI manque", () => {
    const r = evaluatePilotReadiness({ STORE_PROVIDER: "memory" }, { ...HEALTHY_FACTS, packageScripts: { test: "vitest" } });
    expect(check(r, "ci_commands").status).toBe("fail");
    expect(check(r, "ci_commands").detail).toContain("typecheck");
  });

  it("FAIL si un test garde-fou manque (ex. mémoire appelant)", () => {
    const r = evaluatePilotReadiness({ STORE_PROVIDER: "memory" }, { ...HEALTHY_FACTS, testFiles: ["golden-set.test.ts"] });
    expect(check(r, "guardrails").status).toBe("fail");
    expect(check(r, "guardrails").detail).toContain("mémoire appelant");
  });

  it("PASS multi-tenant le jour où le mapping Twilio→companyId existe", () => {
    const r = evaluatePilotReadiness({ STORE_PROVIDER: "memory" }, { ...HEALTHY_FACTS, twilioTenantMapping: true });
    expect(r.singleTenantOnly).toBe(false);
    expect(check(r, "tenant_mapping").status).toBe("pass");
  });
});
