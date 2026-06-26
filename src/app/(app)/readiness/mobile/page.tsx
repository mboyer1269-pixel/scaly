import { Badge, Card, HonestyNote, PageHeader } from "@/components/ui";
import { evaluateMobileStoreReadiness } from "@/services/mobile-readiness";
import { collectMobileStoreReadinessFacts } from "@/services/mobile-readiness-facts";

export const dynamic = "force-dynamic";

export default function MobileReadinessPage() {
  const report = evaluateMobileStoreReadiness(collectMobileStoreReadinessFacts());

  return (
    <>
      <PageHeader
        title="Préparation mobile"
        subtitle="Structure Expo, API mobile, confidentialité et prérequis App Store / Google Play."
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone={report.structureReady ? "emerald" : "rose"}>
            {report.structureReady ? "Structure prête" : "Structure incomplète"}
          </Badge>
          <Badge tone={report.readyForStoreSubmission ? "emerald" : "amber"}>
            {report.readyForStoreSubmission ? "Stores prêts" : "Stores à compléter"}
          </Badge>
        </div>
      </PageHeader>

      <div className="mb-5">
        <HonestyNote>
          Le verdict structure prouve que l'app mobile peut servir un pilote contrôlé. Le verdict stores reste séparé :
          un bearer partagé n'est pas une authentification commerciale multi-client.
        </HonestyNote>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {report.checks.map((check) => (
          <Card key={check.id} title={check.label}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-ink-700">{check.detail}</p>
              <Badge tone={check.status === "pass" ? "emerald" : "rose"}>
                {check.status === "pass" ? "Présent" : "Bloquant"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {report.storeChecks.map((check) => (
          <Card key={check.id} title={check.label}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-ink-700">{check.detail}</p>
              <Badge tone={check.status === "pass" ? "emerald" : "amber"}>
                {check.status === "pass" ? "Prêt stores" : "À faire avant stores"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
