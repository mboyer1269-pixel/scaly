"use client";

import { useState } from "react";
import { Check, Star, X } from "lucide-react";
import type { ReviewRequest, ReviewRequestStatus } from "@/domain/review-request";
import type { Tone } from "@/lib/labels";
import { Badge, Card } from "@/components/ui";

const STATUS_BADGE: Record<ReviewRequestStatus, { label: string; tone: Tone }> = {
  drafted: { label: "Prête à envoyer", tone: "emerald" },
  eligible: { label: "Ajouter le lien d'avis", tone: "amber" },
  sent: { label: "Envoyée", tone: "slate" },
  skipped: { label: "Ignorée", tone: "slate" },
  failed: { label: "Échec d'envoi", tone: "rose" },
};

export function ReviewRequestsCard({ initial }: { initial: ReviewRequest[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "sent" | "skip") {
    setBusy(id);
    try {
      const response = await fetch(`/api/review-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (response.ok) setItems((current) => current.filter((item) => item.id !== id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      title="Avis à demander"
      subtitle="Uniquement des appels résolus et satisfaits — jamais après une urgence, une plainte ou une escalade."
      action={<Badge tone={items.length > 0 ? "emerald" : "slate"}>{items.length} prête{items.length > 1 ? "s" : ""}</Badge>}
    >
      {items.length === 0 && <p className="py-3 text-sm text-ink-500">Aucune demande d'avis prête pour l'instant.</p>}
      <ul className="space-y-2.5">
        {items.map((item) => {
          const s = STATUS_BADGE[item.status];
          return (
            <li key={item.id} className="rounded-lg border border-ink-100 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">
                  <Star size={13} className="mr-1 inline text-amber-500" />
                  {item.customerName ?? item.customerPhone ?? "Client"}
                </p>
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>
              {item.message && <p className="mt-2 text-xs leading-relaxed text-ink-600">« {item.message} »</p>}
              {item.status === "eligible" && (
                <p className="mt-1 text-xs text-amber-700">Ajoutez votre lien Google Avis dans Réglages pour activer l'envoi.</p>
              )}
              {item.status === "failed" && item.failureReason && (
                <p className="mt-1 text-xs text-rose-600">Échec : {item.failureReason}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(item.status === "drafted" || item.status === "eligible") && (
                  <button
                    type="button"
                    onClick={() => act(item.id, "sent")}
                    disabled={busy === item.id}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-scaly-700 px-3 py-2 text-xs font-semibold text-white hover:bg-scaly-800 disabled:opacity-50"
                  >
                    <Check size={13} /> Marquer envoyé
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => act(item.id, "skip")}
                  disabled={busy === item.id}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-50 disabled:opacity-50"
                >
                  <X size={13} /> Ignorer
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
