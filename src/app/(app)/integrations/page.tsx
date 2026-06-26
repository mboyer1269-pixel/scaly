/** Integrations Hub — statut honnête de chaque intégration. */
import { Badge, Card, HonestyNote, PageHeader } from "@/components/ui";
import { INTEGRATIONS } from "@/adapters/integrations/registry";
import { CATEGORY_LABELS, type IntegrationCategory } from "@/domain/integration";

const ORDER: IntegrationCategory[] = ["sms", "calendrier", "crm", "courriel", "automatisation", "communication", "paiement"];

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader title="Intégrations" subtitle="Architecture extensible : chaque intégration implémente la même interface d'exécution" />
      <div className="mb-5">
        <HonestyNote>
          « Mock fonctionnel » = l'Action Engine produit et journalise le payload exact, sans appel réseau réel.
          « Planifié » = aucune ligne de code encore. Aucune intégration ne prétend fonctionner si elle n'est pas branchée.
        </HonestyNote>
      </div>
      <div className="space-y-6">
        {ORDER.map((cat) => {
          const items = INTEGRATIONS.filter((i) => i.category === cat);
          if (items.length === 0) return null;
          return (
            <Card key={cat} title={CATEGORY_LABELS[cat]}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((i) => (
                  <div key={i.id} className="rounded-lg border border-ink-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">{i.label}</p>
                      <Badge tone={i.status === "mock_fonctionnel" ? "teal" : "slate"}>
                        {i.status === "mock_fonctionnel" ? "Mock fonctionnel" : "Planifié"}
                      </Badge>
                    </div>
                    <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-ink-500">
                      {i.capabilities.map((c, idx) => <li key={idx}>{c}</li>)}
                    </ul>
                    <p className="mt-2 text-[11px] font-medium text-ink-400">Branchement réel : phase {i.phase}</p>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
