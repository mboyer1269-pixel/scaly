import Link from "next/link";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ReviewItemActions } from "@/components/ReviewItemActions";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const REASONS = {
  low_confidence: "Confiance faible",
  missing_required_field: "Information manquante",
  field_conflict: "Information contradictoire",
  unanswered_question: "Question sans réponse",
  abandoned_call: "Appel abandonné",
  uncertain_transfer: "Transfert incertain",
  owner_correction: "Correction du propriétaire",
} as const;

export default async function LearnPage() {
  const store = getStore();
  const companyId = await resolveCompanyId();
  const [open, resolved] = await Promise.all([
    store.listReviewItems(companyId, "open"),
    store.listReviewItems(companyId, "resolved"),
  ]);

  return (
    <>
      <PageHeader
        title="À améliorer"
        subtitle="Chaque élément vient d'un appel inspectable et mène à une correction."
      >
        <Badge tone={open.length > 0 ? "amber" : "emerald"}>{open.length} ouvert{open.length > 1 ? "s" : ""}</Badge>
      </PageHeader>

      <Card title="Corrections ouvertes">
        {open.length === 0 && <EmptyState text="Aucune correction ouverte." />}
        <ul className="space-y-3">
          {open.map((item) => (
            <li key={item.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{REASONS[item.reason]}</p>
                  <p className="mt-1 text-sm text-ink-700">{item.evidence}</p>
                  <p className="mt-1 text-xs text-ink-500">{formatDateTime(item.createdAt)} · <Link href={`/calls/${item.callId}`} className="underline">ouvrir l'appel</Link></p>
                </div>
                <Badge tone="amber">À corriger</Badge>
              </div>
              <ReviewItemActions reviewId={item.id} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Corrections récentes" className="mt-6">
        {resolved.length === 0 && <EmptyState text="Aucune correction résolue." />}
        <ul className="space-y-2">
          {resolved.slice(0, 10).map((item) => (
            <li key={item.id} className="rounded-lg border border-ink-100 px-3 py-2">
              <p className="text-sm font-semibold text-ink-900">{REASONS[item.reason]}</p>
              <p className="text-xs text-ink-600">{item.resolution}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
