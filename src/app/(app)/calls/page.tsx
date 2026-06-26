/** Journal des appels — filtrable (statut, urgence, intention, recherche). */
import Link from "next/link";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { Badge, Card, EmptyState, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS, PageHeader } from "@/components/ui";
import { callStatusBadge, leadBadge, urgencyBadge } from "@/lib/labels";
import { INTENT_LABELS, NEXT_ACTION_LABELS } from "@/domain/call";
import { formatCad, formatDateTime, formatDuration } from "@/lib/format";
import { deriveCallReality } from "@/services/reality";
import { RealityBadge } from "@/components/RealityBadge";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
  urgency?: string;
  intent?: string;
  q?: string;
}

export default async function CallsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const store = getStore();
  let calls = await store.listCalls(await resolveCompanyId());

  const { status, urgency, intent, q } = await searchParams;
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
            <span className={FIELD_LABEL_CLASS}>Statut</span>
            <select name="status" defaultValue={status ?? ""} className={FIELD_INPUT_CLASS}>
              <option value="">Tous</option>
              <option value="completed">Complété</option>
              <option value="missed">Manqué</option>
              <option value="transferred">Transféré</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLASS}>Urgence</span>
            <select name="urgency" defaultValue={urgency ?? ""} className={FIELD_INPUT_CLASS}>
              <option value="">Toutes</option>
              <option value="critique">Critique</option>
              <option value="haute">Haute</option>
              <option value="normale">Normale</option>
              <option value="basse">Basse</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLASS}>Intention</span>
            <select name="intent" defaultValue={intent ?? ""} className={FIELD_INPUT_CLASS}>
              <option value="">Toutes</option>
              {Object.entries(INTENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-44 flex-1 flex-col gap-1">
            <span className={FIELD_LABEL_CLASS}>Recherche</span>
            <input name="q" defaultValue={q ?? ""} placeholder="nom, numéro, résumé…" className={FIELD_INPUT_CLASS} />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700">Filtrer</button>
          <Link href="/calls" className="inline-flex min-h-11 items-center px-2 py-2 text-xs font-medium text-ink-700 hover:underline">Réinitialiser</Link>
        </form>
      </Card>

      <Card>
        {calls.length === 0 && <EmptyState text="Aucun appel ne correspond à ces filtres." />}
        <div className="space-y-3 md:hidden">
          {calls.map((c) => {
            const u = urgencyBadge(c.intelligence?.urgency);
            const l = leadBadge(c.intelligence?.leadQuality);
            const s = callStatusBadge(c.status);
            const reality = deriveCallReality(c, store.info());
            return (
              <Link
                key={c.id}
                href={`/calls/${c.id}`}
                className="block rounded-xl border border-ink-200 px-3 py-3 hover:border-scaly-300 hover:bg-scaly-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{c.callerName ?? c.fromNumber}</p>
                    <p className="mt-0.5 text-xs text-ink-600">{formatDateTime(c.startedAt)} · {formatDuration(c.durationSec)} · {c.language.toUpperCase()}</p>
                  </div>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={u.tone}>{u.label}</Badge>
                  <Badge tone={l.tone}>{l.label}</Badge>
                  <RealityBadge reality={reality} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-700">
                  {c.intelligence ? `${INTENT_LABELS[c.intelligence.intent]} · ${NEXT_ACTION_LABELS[c.intelligence.nextAction]}` : "Aucune intelligence générée"}
                </p>
              </Link>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
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
                <th className="py-2 pr-3 font-medium">Preuve</th>
                <th className="py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => {
                const u = urgencyBadge(c.intelligence?.urgency);
                const l = leadBadge(c.intelligence?.leadQuality);
                const s = callStatusBadge(c.status);
                const reality = deriveCallReality(c, store.info());
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
                    <td className="py-2.5 pr-3"><RealityBadge reality={reality} /></td>
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
