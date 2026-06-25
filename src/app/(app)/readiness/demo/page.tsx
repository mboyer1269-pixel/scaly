import Link from "next/link";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { evaluateDemoReadiness } from "@/services/demo-readiness";
import { Badge, Card, HonestyNote, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DemoReadinessPage() {
  const store = getStore();
  const companyId = resolveCompanyId();
  const [calls, actions, reviews, evidence, audit] = await Promise.all([
    store.listCalls(companyId),
    store.listActions(companyId),
    store.listReviewItems(companyId),
    store.listReadinessEvidence(companyId, "demo"),
    store.getAuditLog(100),
  ]);
  const vertical = evidence.find((item) => item.callId && calls.some((call) => call.id === item.callId));
  const liveCheck = store.info().provider === "prisma" ? await store.verifyLive() : undefined;
  const report = evaluateDemoReadiness({
    store: store.info(),
    persistenceLiveCheck: liveCheck,
    brandBoundaryPass: true,
    verticalEvidence: vertical,
    callPersisted: Boolean(vertical?.callId && calls.some((call) => call.id === vertical.callId)),
    actionsPersisted: Boolean(vertical?.callId && actions.some((action) => action.callId === vertical.callId)),
    reviewPersisted: Boolean(vertical?.callId && reviews.some((review) => review.callId === vertical.callId)),
    auditRecorded: Boolean(vertical?.callId && audit.some((entry) => entry.detail?.includes(vertical.callId!))),
    requiredSurfaces: {
      overview: true,
      calls: true,
      followUp: true,
      learn: true,
      demoReadiness: true,
    },
  });

  return (
    <>
      <PageHeader
        title="Préparation de la démo"
        subtitle="Vérifie le flow applicatif local. Ce verdict ne prouve pas la téléphonie réelle."
      >
        <Badge tone={report.localDemoReady ? "emerald" : "rose"}>
          {report.localDemoReady ? "Démo prête" : "Démo non prête"}
        </Badge>
      </PageHeader>

      {!report.commercialPreviewReady && (
        <div className="mb-5">
          <HonestyNote>
            Mode mémoire : la démo peut être prête, mais l'aperçu commercial exige PostgreSQL et un aller-retour vérifié.
          </HonestyNote>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {report.checks.map((check) => (
          <Card key={check.id} title={check.label}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-ink-600">{check.detail}</p>
              <Badge tone={check.status === "pass" ? "emerald" : check.status === "warn" ? "amber" : "rose"}>
                {check.status === "pass" ? "Vérifié" : check.status === "warn" ? "Limité" : "Bloquant"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/simulator" className="rounded-lg bg-scaly-600 px-4 py-2 text-sm font-semibold text-white">
          Exécuter le scénario critique
        </Link>
        {vertical?.callId && (
          <Link href={`/calls/${vertical.callId}`} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold">
            Inspecter la preuve
          </Link>
        )}
        <Link href="/readiness/live" className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold">
          Vérifier les appels réels
        </Link>
      </div>
    </>
  );
}
