/** Journal des appels — filtrable (statut, urgence, intention, recherche). */
import Link from "next/link";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { callStatusBadge, leadBadge, urgencyBadge } from "@/lib/labels";
import { INTENT_LABELS } from "@/domain/call";
import { formatCad, formatDateTime, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
  urgency?: string;
  intent?: string;
  q?: string;
}

export default async function CallsPage({ searchParams }: { searchParams: SearchParams }) {
  const store = getStore();
  let calls = await store.listCalls(resolveCompanyId());

  const { status, urgency, intent, q } = searchParams;
  if (status) calls = calls.filter((c) => c.status === status);
  if (urgency) calls = calls.filter((c) => c.intelligence?.urgency === urgency);
  if (intent) calls = calls.filter((c) => c.intelligence?.intent === intent);
  if (q) {
    const needle = q.toLowerCase();
    calls = calls.filter(
      (c) => c.callerName?.toLowerCase().includes(needle) || c.fromNumber.includes(needle) || c.intelligence?.summary.toLowerCase().includes(needle),
    );
  }

  return (
    <>
      <PageHeader title="Appels" subtitle={`${calls.length} appel${calls.length > 1 ? "s" : ""} — chaque ligne est cliquable (transcript + intelligence complète)`} />

      <Card className="mb-5">
        <form method="GET" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-500">Statut</span>
            <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-ink-200 px-2.5 py-1.5">
              <option value="">Tous</option>
              <option value="completed">Complété</option>
              <option value="missed">Manqué</option>
              <option value="transferred">Transféré</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-500">Urgence</span>
            <select name="urgency" defaultValue={urgency ?? ""} className="rounded-lg border border-ink-200 px-2.5 py-1.5">
              <option value="">Toutes</option>
              <option value="critique">Critique</option>
              <option value="haute">Haute</option>
              <option value="normale">Normale</option>
              <option value="basse">Basse</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-500">Intention</span>
            <select name="intent" defaultValue={intent ?? ""} className="rounded-lg border border-ink-200 px-2.5 py-1.5">
              <option value="">Toutes</option>
              {Object.entries(INTENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-44 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-ink-500">Recherche</span>
            <input name="q" defaultValue={q ?? ""} placeholder="nom, numéro, résumé…" className="rounded-lg border border-ink-200 px-2.5 py-1.5" />
          </label>
          <button type="submit" className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700">Filtrer</button>
          <Link href="/calls" className="px-2 py-2 text-xs text-ink-500 hover:underline">Réinitialiser</Link>
        </form>
      </Card>

      <Card>
        {calls.length === 0 && <EmptyState text="Aucun appel ne correspond à ces filtres." />}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 pr-3 font-medium">Quand</th>
                <th className="py-2 pr-3 font-medium">Appelant</th>
                <th className="py-2 pr-3 font-medium">Durée</th>
                <th className="py-2 pr-3 font-medium">Langue</th>
                <th className="py-2 pr-3 font-medium">Intention</th>
                <th className="py-2 pr-3 font-medium">Urgence</th>
                <th className="py-2 pr-3 font-medium">Lead</th>
                <th className="py-2 pr-3 font-medium">Valeur</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => {
                const u = urgencyBadge(c.intelligence?.urgency);
                const l = leadBadge(c.intelligence?.leadQuality);
                const s = callStatusBadge(c.status);
                return (
                  <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/60">
                    <td className="py-2.5 pr-3 text-ink-500"><Link href={`/calls/${c.id}`} className="hover:underline">{formatDateTime(c.startedAt)}</Link></td>
                    <td className="py-2.5 pr-3"><Link href={`/calls/${c.id}`} className="font-medium text-ink-900 hover:underline">{c.callerName ?? c.fromNumber}</Link></td>
                    <td className="py-2.5 pr-3 text-ink-500">{formatDuration(c.durationSec)}</td>
                    <td className="py-2.5 pr-3 text-ink-500 uppercase">{c.language}</td>
                    <td className="py-2.5 pr-3 text-ink-600">{c.intelligence ? INTENT_LABELS[c.intelligence.intent] : "—"}</td>
                    <td className="py-2.5 pr-3"><Badge tone={u.tone}>{u.label}</Badge></td>
                    <td className="py-2.5 pr-3"><Badge tone={l.tone}>{l.label}</Badge></td>
                    <td className="py-2.5 pr-3 font-semibold">{c.intelligence?.estimatedValueCad ? formatCad(c.intelligence.estimatedValueCad) : "—"}</td>
                    <td className="py-2.5 pr-3 text-ink-600">{c.intelligence?.commercialScore ?? "—"}</td>
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
