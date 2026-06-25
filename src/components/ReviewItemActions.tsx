"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ReviewItemActions({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(status: "resolved" | "ignored") {
    if (!resolution.trim()) {
      setError("Écrivez ce qui a été corrigé ou pourquoi cet élément est ignoré.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution: resolution.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Mise à jour impossible.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        rows={2}
        value={resolution}
        onChange={(event) => setResolution(event.target.value)}
        placeholder="Ex. Adresse confirmée dans la fiche de l'entreprise."
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => update("resolved")}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-lg bg-scaly-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Marquer corrigé
        </button>
        <button
          onClick={() => update("ignored")}
          disabled={saving}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 disabled:opacity-50"
        >
          Ignorer avec justification
        </button>
      </div>
    </div>
  );
}
