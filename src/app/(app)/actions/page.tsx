/** File d'actions — tout ce que Scaly a déclenché, avec audit trail complet. */
import Link from "next/link";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { Badge, Card, EmptyState, HonestyNote, PageHeader } from "@/components/ui";
import { actionStatusBadge } from "@/lib/labels";
import { ACTION_TYPE_LABELS, type ActionStatus } from "@/domain/action";
import { formatDateTime } from "@/lib/format";
import { ExecuteButton } from "@/components/ExecuteButton";

export const dynamic = "force-dynamic";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Toutes" },
  { value: "pending", label: "En attente" },
  { value: "succeeded", label: "Réussies" },
  { value: "failed", label: "Échouées" },
  { value: "requires_config", label: "Config. requise" },
];

export default function ActionsPage({ searchParams }: { searchParams: { status?: string } }) {
  const store = getStore();
  let actions = store.listActions(DEFAULT_COMPANY_ID);
  const filter = searchParams.status ?? "";
  if (filter) actions = actions.filter((a) => a.status === (filter as ActionStatus));

  const pendingCount = store.listActions(DEFAULT_COMPANY_ID).filter((a) => a.status === "pending").length;

  return (
    <>
      <PageHeader title="Actions" subtitle={`${actions.length} action${actions.length > 1 ? "s" : ""} · ${pendingCount} en attente d'exécution`} />
      <div className="mb-4">
        <HonestyNote>
          Exécution MOCK : chaque action journalise précisément ce qu'elle aurait fait (SMS, courriel, lead CRM…), mais rien ne sort réellement. Les exécuteurs réels (P3) brancheront les mêmes interfaces.
        </HonestyNote>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/actions?status=${f.value}` : "/actions"}
            className={
              filter === f.value
                ? "rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-full border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50"
            }
          >
            {f.label}
          </Link>
        ))}
      </div>
      <Card>
        {actions.length === 0 && <EmptyState text="Aucune action pour ce filtre." />}
        <ul className="divide-y divide-ink-50">
          {actions.map((a) => {
            const st = actionStatusBadge(a.status);
            return (
              <li key={a.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{a.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {ACTION_TYPE_LABELS[a.type]} · créée {formatDateTime(a.createdAt)}
                      {a.callId && (
                        <> · <Link href={`/calls/${a.callId}`} className="text-scaly-600 hover:underline">appel lié</Link></>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {(a.status === "pending" || a.status === "failed") && <ExecuteButton actionId={a.id} />}
                  </div>
                </div>
                {a.lastError && <p className="mt-1.5 rounded bg-violet-50 px-2 py-1 text-xs text-violet-700">{a.lastError}</p>}
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-xs font-medium text-scaly-600">Audit trail ({a.audit.length})</summary>
                  <ul className="mt-1.5 space-y-1 border-l-2 border-ink-100 pl-3">
                    {a.audit.map((e, i) => (
                      <li key={i} className="text-xs text-ink-600">
                        <span className="font-medium text-ink-800">{e.event}</span>
                        {e.detail ? ` — ${e.detail}` : ""}
                        <span className="text-ink-400"> · {formatDateTime(e.at)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
