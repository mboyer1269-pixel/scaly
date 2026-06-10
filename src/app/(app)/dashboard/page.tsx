/** Dashboard PME — la réponse aux questions business en un écran. */
import Link from "next/link";
import { AlertTriangle, ArrowRight, Flame, Lightbulb, MessageSquareWarning, TrendingUp } from "lucide-react";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { computeDashboard, computePhonePerformanceScore } from "@/services/analytics";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { callStatusBadge, leadBadge, urgencyBadge } from "@/lib/labels";
import { INTENT_LABELS, NEXT_ACTION_LABELS } from "@/domain/call";
import { formatCad, formatDateTime, formatDuration } from "@/lib/format";
import { PLANS } from "@/domain/billing";

export const dynamic = "force-dynamic";

const KIND_ICONS = {
  opportunite: Flame,
  risque: AlertTriangle,
  tendance: TrendingUp,
  objection: MessageSquareWarning,
  recommandation: Lightbulb,
} as const;

export default function DashboardPage() {
  const store = getStore();
  const company = store.getCompany(DEFAULT_COMPANY_ID)!;
  const d = computeDashboard(company, store.listCalls(company.id), store.listActions(company.id));
  const perf = computePhonePerformanceScore(d);
  const maxDay = Math.max(1, ...d.byDay.map((b) => b.total));

  return (
    <>
      <PageHeader title={company.name} subtitle={`${company.sectorLabel} · ${company.city} · plan ${PLANS[company.planId].label}`}>
        <div className="flex items-center gap-2">
          <Badge tone={perf >= 70 ? "emerald" : perf >= 40 ? "amber" : "rose"}>Performance téléphonique : {perf}/100</Badge>
          <Badge tone="slate">{d.periodDays} derniers jours</Badge>
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Appels reçus" value={String(d.callsTotal)} sub={`${formatDuration(d.avgDurationSec)} en moyenne`} />
        <Stat label="Répondus par l'IA" value={String(d.answeredByAi)} sub={`${d.transferred} transférés à un humain`} />
        <Stat label="Manqués" value={String(d.missed)} sub={d.missedValueAtRiskCad > 0 ? `${formatCad(d.missedValueAtRiskCad)} à risque` : "tout est récupéré"} tone="rose" />
        <Stat label="Appels sauvés" value={String(d.savedCount)} sub={`${formatCad(d.savedValueCad)} protégés`} tone="emerald" />
        <Stat label="Pipeline ouvert" value={formatCad(d.pipelineValueCad)} sub="leads chauds + tièdes à suivre" />
        <Stat label="Urgences ouvertes" value={String(d.urgentOpen)} sub="à rappeler en priorité" tone={d.urgentOpen > 0 ? "rose" : "emerald"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Volume d'appels" subtitle="par jour — les barres roses sont les appels manqués" className="lg:col-span-2">
          <div className="flex h-28 items-end gap-1">
            {d.byDay.map((b) => (
              <div key={b.date} className="group relative flex-1">
                <div className="flex w-full flex-col justify-end" style={{ height: "104px" }}>
                  <div className="w-full rounded-t bg-scaly-400" style={{ height: `${(b.total / maxDay) * 100}%` }} />
                  {b.missed > 0 && <div className="w-full bg-rose-400" style={{ height: `${(b.missed / maxDay) * 100}%` }} />}
                </div>
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                  {b.date.slice(5)} : {b.total} ({b.missed} manqué{b.missed > 1 ? "s" : ""})
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Opportunités chaudes" subtitle="à rappeler, classées par valeur">
          {d.hotOpportunities.length === 0 && <EmptyState text="Aucune opportunité chaude ouverte." />}
          <ul className="space-y-2.5">
            {d.hotOpportunities.map((c) => (
              <li key={c.id}>
                <Link href={`/calls/${c.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2 hover:border-scaly-300 hover:bg-scaly-50/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{c.callerName ?? c.fromNumber}</p>
                    <p className="truncate text-xs text-ink-500">{c.intelligence ? INTENT_LABELS[c.intelligence.intent] : "—"}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{formatCad(c.intelligence?.estimatedValueCad ?? 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Intelligence stratégique" subtitle="générée par règles sur vos 14 derniers jours">
          {d.insights.length === 0 && <EmptyState text="Pas encore assez de données." />}
          <ul className="space-y-3">
            {d.insights.map((ins) => {
              const Icon = KIND_ICONS[ins.kind];
              return (
                <li key={ins.id} className="flex gap-3 rounded-lg border border-ink-100 px-3 py-2.5">
                  <Icon size={18} className={ins.kind === "risque" ? "mt-0.5 shrink-0 text-rose-500" : ins.kind === "opportunite" ? "mt-0.5 shrink-0 text-emerald-500" : "mt-0.5 shrink-0 text-scaly-500"} />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{ins.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{ins.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Conversations à risque" subtitle="plaintes et sentiment négatif">
            {d.atRiskCalls.length === 0 && <EmptyState text="Aucune conversation à risque. 👍" />}
            <ul className="space-y-2">
              {d.atRiskCalls.map((c) => (
                <li key={c.id}>
                  <Link href={`/calls/${c.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2 hover:border-rose-300">
                    <p className="truncate text-sm text-ink-800">{c.callerName ?? c.fromNumber}</p>
                    <span className="text-xs text-rose-600">{formatDateTime(c.startedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Actions recommandées en attente" action={<Link href="/actions" className="text-xs font-medium text-scaly-600 hover:underline">Tout voir</Link>}>
            {d.pendingActions.length === 0 && <EmptyState text="Aucune action en attente." />}
            <ul className="space-y-2">
              {d.pendingActions.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2">
                  <p className="truncate text-sm text-ink-800">{a.title}</p>
                  <Badge tone="amber">En attente</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Appels récents" className="mt-6" action={<Link href="/calls" className="inline-flex items-center gap-1 text-xs font-medium text-scaly-600 hover:underline">Tous les appels <ArrowRight size={12} /></Link>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 pr-3 font-medium">Quand</th>
                <th className="py-2 pr-3 font-medium">Appelant</th>
                <th className="py-2 pr-3 font-medium">Intention</th>
                <th className="py-2 pr-3 font-medium">Urgence</th>
                <th className="py-2 pr-3 font-medium">Lead</th>
                <th className="py-2 pr-3 font-medium">Valeur</th>
                <th className="py-2 pr-3 font-medium">Action recommandée</th>
                <th className="py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {d.recentCalls.map((c) => {
                const u = urgencyBadge(c.intelligence?.urgency);
                const l = leadBadge(c.intelligence?.leadQuality);
                const s = callStatusBadge(c.status);
                return (
                  <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/60">
                    <td className="py-2.5 pr-3 text-ink-500"><Link href={`/calls/${c.id}`} className="hover:underline">{formatDateTime(c.startedAt)}</Link></td>
                    <td className="py-2.5 pr-3 font-medium text-ink-900">{c.callerName ?? c.fromNumber}</td>
                    <td className="py-2.5 pr-3 text-ink-600">{c.intelligence ? INTENT_LABELS[c.intelligence.intent] : "—"}</td>
                    <td className="py-2.5 pr-3"><Badge tone={u.tone}>{u.label}</Badge></td>
                    <td className="py-2.5 pr-3"><Badge tone={l.tone}>{l.label}</Badge></td>
                    <td className="py-2.5 pr-3 font-semibold text-ink-900">{c.intelligence?.estimatedValueCad ? formatCad(c.intelligence.estimatedValueCad) : "—"}</td>
                    <td className="py-2.5 pr-3 text-ink-600">{c.intelligence ? NEXT_ACTION_LABELS[c.intelligence.nextAction] : "—"}</td>
                    <td className="py-2.5"><Badge tone={s.tone}>{s.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
