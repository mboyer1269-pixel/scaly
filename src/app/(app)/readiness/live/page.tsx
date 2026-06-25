import { getStore } from "@/server/store";
import { evaluatePilotReadiness, type PilotEnv } from "@/services/pilot-readiness";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LiveReadinessPage() {
  const store = getStore();
  const live = store.info().provider === "prisma" ? await store.verifyLive() : undefined;
  const env: PilotEnv = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    STORE_PROVIDER: process.env.STORE_PROVIDER,
    DATABASE_URL: process.env.DATABASE_URL,
    REALTIME_SHARED_SECRET: process.env.REALTIME_SHARED_SECRET,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    SCALY_REALTIME_WS_URL: process.env.SCALY_REALTIME_WS_URL,
    SCALY_PUBLIC_URL: process.env.SCALY_PUBLIC_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  };
  const report = evaluatePilotReadiness(env, {
    packageScripts: { typecheck: "tsc --noEmit", test: "vitest run", build: "next build" },
    testFiles: ["golden-set", "voice-scenarios", "voice-runtime", "caller-memory", "tenant"],
    twilioTenantMapping: false,
    liveCheck: live ? { ok: live.ok, detail: live.detail } : undefined,
  });

  return (
    <>
      <PageHeader
        title="Préparation des appels réels"
        subtitle="Verdict séparé : fournisseurs, sécurité, persistance et téléphonie."
      >
        <Badge tone={report.verdict === "pass" ? "emerald" : report.verdict === "warn" ? "amber" : "rose"}>
          {report.verdict === "pass" ? "Prêt" : report.verdict === "warn" ? "Limité" : "Non prêt"}
        </Badge>
      </PageHeader>

      <Card title="Réponse froide">
        <p className="text-lg font-bold text-ink-900">
          Appel IA réel : {report.canMakeRealCall.mode === "ia" ? "possible" : "non vérifié"}
        </p>
        <p className="mt-1 text-sm text-ink-600">{report.canMakeRealCall.reason}</p>
        {report.singleTenantOnly && <p className="mt-2 text-sm font-semibold text-amber-700">Pilote mono-tenant seulement.</p>}
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {report.checks.map((check) => (
          <Card key={check.id} title={check.label}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-ink-600">{check.detail}</p>
              <Badge tone={check.status === "pass" ? "emerald" : check.status === "warn" ? "amber" : "rose"}>
                {check.status === "pass" ? "Vérifié" : check.status === "warn" ? "Non vérifié" : "Bloquant"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
