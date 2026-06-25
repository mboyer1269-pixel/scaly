import Link from "next/link";
import { getStore } from "@/server/store";
import { resolveCompany } from "@/server/tenant";
import { computeRescueQueue } from "@/services/rescue";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ExecuteButton } from "@/components/ExecuteButton";
import { actionStatusBadge } from "@/lib/labels";
import { formatCad, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  const store = getStore();
  const company = (await resolveCompany())!;
  const [calls, actions] = await Promise.all([
    store.listCalls(company.id),
    store.listActions(company.id),
  ]);
  const rescue = computeRescueQueue(company, calls, actions).slice(0, 8);
  const work = actions.filter((action) =>
    ["pending", "failed", "requires_config"].includes(action.status),
  );

  return (
    <>
      <PageHeader
        title="À suivre"
        subtitle="Les appels et actions qui demandent une décision humaine."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="À rappeler" subtitle="Priorité calculée selon le délai et la valeur estimée.">
          {rescue.length === 0 && <EmptyState text="Aucun appel manqué à récupérer." />}
          <ul className="space-y-2">
            {rescue.map((entry) => (
              <li key={entry.call.id}>
                <Link
                  href={`/calls/${entry.call.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2 hover:border-rose-300 hover:bg-rose-50/40"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {entry.call.callerName ?? entry.call.fromNumber}
                    </p>
                    <p className="text-xs text-ink-500">{entry.suggested}</p>
                  </div>
                  <span className="font-bold text-rose-600">{formatCad(entry.valueAtRiskCad)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Actions à traiter" subtitle="Exécutez, corrigez la configuration ou inspectez la preuve.">
          {work.length === 0 && <EmptyState text="Aucune action en attente." />}
          <ul className="space-y-3">
            {work.map((action) => {
              const status = actionStatusBadge(action.status);
              return (
                <li key={action.id} className="rounded-lg border border-ink-100 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{action.title}</p>
                      <p className="text-xs text-ink-500">
                        {formatDateTime(action.createdAt)}
                        {action.callId && <> · <Link href={`/calls/${action.callId}`} className="underline">voir l'appel</Link></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {(action.status === "pending" || action.status === "failed") && (
                        <ExecuteButton actionId={action.id} />
                      )}
                    </div>
                  </div>
                  {action.lastError && <p className="mt-2 text-xs text-rose-700">{action.lastError}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
