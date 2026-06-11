/**
 * Carte « Consommation du mois » — le compteur de minutes FACTURABLES.
 * Rend les engagements de /pricing visibles : spam offert affiché, arrondi
 * une seule fois sur le total, facture estimée au tarif publié.
 */
import { PLANS } from "@/domain/billing";
import type { PlanId } from "@/domain/billing";
import type { MonthUsage } from "@/services/usage";
import { estimateMonthInvoice } from "@/services/usage";
import { formatCad } from "@/lib/format";
import { Card } from "@/components/ui";

export function UsageCard({ planId, usage }: { planId: PlanId; usage: MonthUsage }) {
  const plan = PLANS[planId];
  const invoice = estimateMonthInvoice(planId, usage);
  const pct = Math.min(100, Math.round((usage.billableMinutes / plan.includedMinutes) * 100));
  const over = invoice.overageMinutes > 0;

  return (
    <Card
      title={`Consommation du mois (${usage.periodLabel})`}
      subtitle="minutes facturables seulement — le spam refusé est offert, comme promis sur la page Prix"
    >
      <div className="space-y-3 text-sm">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-semibold text-ink-900">
              {invoice.minutesUsed} / {plan.includedMinutes} min incluses
            </span>
            <span className={over ? "text-xs font-medium text-rose-600" : "text-xs text-ink-500"}>
              {over
                ? `${invoice.overageMinutes} min au-delà · ${formatCad(invoice.overageCad)} au tarif publié`
                : `${pct} %`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-100">
            <div
              className={over ? "h-full bg-rose-500" : pct >= 80 ? "h-full bg-amber-500" : "h-full bg-scaly-500"}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
          <span>{usage.billableCalls} appel(s) facturable(s)</span>
          <span className="text-emerald-700">
            {usage.spamCalls > 0
              ? `${usage.spamCalls} spam refusé(s) — ${Math.ceil(usage.spamMinutes)} min NON facturées`
              : "Aucun spam ce mois-ci"}
          </span>
          <span>
            Facture estimée : <strong className="text-ink-900">{formatCad(invoice.totalCad)}</strong> (hors taxes)
          </span>
        </div>
      </div>
    </Card>
  );
}
