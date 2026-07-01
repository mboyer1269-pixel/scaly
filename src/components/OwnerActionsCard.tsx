"use client";

import { useState } from "react";
import Link from "next/link";
import { BrainCircuit, Check, PhoneCall, X } from "lucide-react";
import type { OwnerNotification } from "@/domain/owner-notification";
import { Badge, Card } from "@/components/ui";
import { urgencyBadge } from "@/lib/labels";
import { formatCad } from "@/lib/format";

export function OwnerActionsCard({ initial }: { initial: OwnerNotification[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function dismiss(id: string) {
    setBusy(id);
    try {
      const response = await fetch("/api/owner-notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (response.ok) setItems((current) => current.filter((item) => item.id !== id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      title="Actions à traiter"
      subtitle="Ce que Maude ne pouvait pas régler seule — décisions du propriétaire, les plus urgentes en tête."
      action={<Badge tone={items.length > 0 ? "amber" : "emerald"}>{items.length} en attente</Badge>}
    >
      {items.length === 0 && <p className="py-3 text-sm text-emerald-700">Aucune décision en attente. 👍</p>}
      <ul className="space-y-2.5">
        {items.map((item) => {
          const u = urgencyBadge(item.urgency);
          return (
            <li key={item.id} className="rounded-lg border border-ink-100 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{item.summary}</p>
                </div>
                <Badge tone={u.tone}>{u.label}</Badge>
              </div>
              <p className="mt-2 text-xs font-medium text-ink-700">→ {item.recommendedAction}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {item.sourceCallId && (
                  <Link
                    href={`/calls/${item.sourceCallId}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    <PhoneCall size={13} /> Répondre au client
                  </Link>
                )}
                {item.type === "unknown_answer" && (
                  <Link
                    href="/knowledge"
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-scaly-300 px-3 py-2 text-xs font-semibold text-scaly-700 hover:bg-scaly-50"
                  >
                    <BrainCircuit size={13} /> Ajouter au Cerveau d'entreprise
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  disabled={busy === item.id}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-50 disabled:opacity-50"
                >
                  {busy === item.id ? <Check size={13} /> : <X size={13} />} Marquer traité
                </button>
                {typeof item.modelCostEstimateCad === "number" && (
                  <span className="ml-auto text-[11px] text-ink-400">Coût IA estimé : {formatCad(item.modelCostEstimateCad)}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
