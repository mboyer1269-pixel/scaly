"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { PLANS, type PlanId } from "@/domain/billing";

/**
 * Cartes de plans publiques. Le bouton tente le checkout Stripe ; si le
 * paiement en ligne n'est pas actif (503), on le dit tel quel et on route
 * vers la démo — jamais de faux « abonnement réussi ».
 */
export function PricingPlans() {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function subscribe(planId: PlanId) {
    setBusy(planId);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.status === 503) {
        setNotice("Le paiement en ligne arrive — on onboarde les premiers clients à la main. Essayez le simulateur, on vous contacte.");
        return;
      }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur de paiement");
      window.location.href = data.url;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Object.values(PLANS).map((plan) => (
          <div
            key={plan.id}
            className={
              plan.id === "pro"
                ? "relative rounded-2xl border-2 border-scaly-500 bg-ink-900 p-7"
                : "rounded-2xl border border-ink-800 bg-ink-900 p-7"
            }
          >
            {plan.id === "pro" && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-scaly-500 px-3 py-0.5 text-xs font-semibold text-white">
                Le plus choisi
              </span>
            )}
            <h3 className="text-lg font-bold text-white">{plan.label}</h3>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">{plan.priceMonthlyCad} $</span>
              <span className="text-sm text-ink-400">CA / mois</span>
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {plan.includedMinutes} minutes d'appel incluses · {plan.overagePerMinuteCad.toFixed(2).replace(".", ",")} $/min au-delà
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {plan.setupFeeCad > 0 ? `Installation : ${plan.setupFeeCad} $ (une fois)` : "Installation incluse"}
            </p>
            <ul className="mt-5 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-300">
                  <Check size={15} className="mt-0.5 shrink-0 text-scaly-400" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => subscribe(plan.id)}
              disabled={busy !== null}
              className={
                plan.id === "pro"
                  ? "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-scaly-500 px-5 py-3 text-sm font-semibold text-white hover:bg-scaly-600 disabled:opacity-50"
                  : "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700 px-5 py-3 text-sm font-semibold text-ink-200 hover:bg-ink-800 disabled:opacity-50"
              }
            >
              {busy === plan.id ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} Choisir {plan.label}
            </button>
          </div>
        ))}
      </div>
      {notice && (
        <p className="mx-auto mt-6 max-w-xl rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
          {notice}{" "}
          <Link href="/simulator" className="font-semibold underline">
            Ouvrir le simulateur
          </Link>
        </p>
      )}
    </div>
  );
}
