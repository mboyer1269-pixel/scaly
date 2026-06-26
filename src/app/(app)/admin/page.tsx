/** Cockpit Admin / Fondateur — clients, minutes, coûts IA, marges, incidents, santé. */
import { getStore } from "@/server/store";
import { computeAdminOverview } from "@/services/analytics";
import { Badge, Card, HonestyNote, PageHeader, Stat } from "@/components/ui";
import { INDUSTRY_LABELS } from "@/domain/company";
import { ADD_ONS, EST_AI_COST_PER_MINUTE_CAD, PLANS } from "@/domain/billing";
import { formatCad, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const store = getStore();
  const companies = await store.listCompanies();
  const rows = await Promise.all(companies.map(async (company) => ({ company, calls: await store.listCalls(company.id) })));
  const o = computeAdminOverview(rows);
  const audit = await store.getAuditLog(15);

  return (
    <>
      <PageHeader title="Cockpit fondateur" subtitle="Vue interne — clients, usage, économie unitaire, incidents, conformité" />
      <div className="mb-5">
        <HonestyNote>
          Chiffres = données de démonstration. Coût IA estimé à {EST_AI_COST_PER_MINUTE_CAD.toFixed(2)} $CA/min (hypothèse interne STT+LLM+TTS documentée dans src/domain/billing.ts, à recalibrer avec les factures réelles).
        </HonestyNote>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="MRR (démo)" value={formatCad(o.mrrCad)} sub={`${o.rows.length} clients actifs`} />
        <Stat label="Minutes (14 j)" value={String(o.totalMinutes)} sub="toutes compagnies" />
        <Stat label="Coût IA estimé (14 j)" value={formatCad(o.totalAiCostCad)} sub="modèle interne" />
        <Stat label="Marge brute estimée" value={formatCad(o.grossMarginCad)} sub="MRR − coût IA" tone="emerald" />
      </div>

      <Card title="Clients" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 pr-3 font-medium">Compagnie</th>
                <th className="py-2 pr-3 font-medium">Industrie</th>
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 font-medium">Appels 14 j</th>
                <th className="py-2 pr-3 font-medium">Minutes</th>
                <th className="py-2 pr-3 font-medium">Facture estimée</th>
                <th className="py-2 pr-3 font-medium">Coût IA</th>
                <th className="py-2 font-medium">Marge</th>
              </tr>
            </thead>
            <tbody>
              {o.rows.map((r) => (
                <tr key={r.company.id} className="border-b border-ink-50 last:border-0">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-ink-900">{r.company.name}</p>
                    <p className="text-xs text-ink-400">{r.company.city}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-ink-600">{INDUSTRY_LABELS[r.company.industry]}</td>
                  <td className="py-2.5 pr-3"><Badge tone="teal">{PLANS[r.company.planId].label}</Badge></td>
                  <td className="py-2.5 pr-3">{r.calls14d}</td>
                  <td className="py-2.5 pr-3">{r.minutes} min{r.invoice.overageMinutes > 0 && <span className="text-xs text-amber-600"> (+{r.invoice.overageMinutes} excéd.)</span>}</td>
                  <td className="py-2.5 pr-3 font-semibold">{formatCad(r.invoice.totalCad)}</td>
                  <td className="py-2.5 pr-3 text-ink-600">{formatCad(r.estAiCostCad)}</td>
                  <td className="py-2.5 font-semibold text-emerald-600">{formatCad(r.estMarginCad)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Santé des providers vocaux" subtitle="état honnête — rien n'est « vert » par complaisance">
          <ul className="space-y-2">
            {o.providerHealth.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-500">{p.note}</p>
                </div>
                <Badge tone={p.status === "operationnel" ? "emerald" : p.status === "degrade" ? "amber" : "slate"}>
                  {p.status === "operationnel" ? "Opérationnel" : p.status === "degrade" ? "Dégradé" : "Non configuré"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Incidents">
          <ul className="space-y-2">
            {o.incidents.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2">
                <div>
                  <p className="text-sm text-ink-800">{i.title}</p>
                  <p className="text-xs text-ink-400">{formatDateTime(i.at)}</p>
                </div>
                <Badge tone={i.status === "ouvert" ? "amber" : "emerald"}>{i.status === "ouvert" ? "Ouvert" : "Résolu"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Object.values(PLANS).map((p) => (
          <Card key={p.id} title={`Plan ${p.label}`} subtitle={`${formatCad(p.priceMonthlyCad)}/mois · ${p.includedMinutes} min incluses · ${p.overagePerMinuteCad.toFixed(2)} $/min excéd. · installation ${formatCad(p.setupFeeCad)}`}>
            <ul className="list-inside list-disc space-y-1 text-xs text-ink-600">
              {p.features.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </Card>
        ))}
      </div>

      <Card title="Add-ons" className="mt-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ADD_ONS.map((a) => (
            <div key={a.id} className="rounded-lg border border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">{a.label}</p>
              <p className="text-xs text-ink-500">{a.description}</p>
              <p className="mt-1 text-sm font-bold text-scaly-700">{formatCad(a.priceMonthlyCad)}/mois</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Audit trail (conformité)" subtitle="qui a changé quoi, quand — base de l'exigence Loi 25" className="mt-6">
        <ul className="space-y-1.5">
          {audit.map((e, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
              <span className="text-ink-400">{formatDateTime(e.at)}</span>
              <Badge tone="slate">{e.actor}</Badge>
              <span className="font-medium text-ink-800">{e.event}</span>
              {e.detail && <span className="text-ink-500">— {e.detail}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
