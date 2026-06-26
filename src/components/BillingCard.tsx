"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Loader2 } from "lucide-react";
import type { Company } from "@/domain/company";
import { PLANS } from "@/domain/billing";
import { Badge, Card, FormNotice } from "@/components/ui";

/** Carte abonnement (settings) — plan courant + portail client Stripe. */
export function BillingCard({ company }: { company: Company }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const plan = PLANS[company.planId];
  const status = company.billing?.subscriptionStatus;

  async function openPortal() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setNotice(data.error ?? "Erreur");
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Abonnement" subtitle="géré par Stripe — le plan ne se change jamais ici à la main">
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2">
          <span className="font-semibold text-ink-900">{plan.label}</span>
          <span className="text-ink-500">{plan.priceMonthlyCad} $/mois · {plan.includedMinutes} min incluses</span>
          {status && (
            <Badge tone={status === "active" ? "emerald" : status === "canceled" ? "rose" : "amber"}>{status}</Badge>
          )}
        </p>
        {company.billing?.currentPeriodEnd && (
          <p className="text-xs text-ink-500">Période courante jusqu'au {new Date(company.billing.currentPeriodEnd).toLocaleDateString("fr-CA")}</p>
        )}
        {notice && <FormNotice tone="info">{notice}</FormNotice>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openPortal}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />} Gérer mon abonnement
          </button>
          <Link href="/pricing" className="inline-flex min-h-11 items-center text-xs font-medium text-scaly-700 underline">Voir les prix publics</Link>
        </div>
      </div>
    </Card>
  );
}
