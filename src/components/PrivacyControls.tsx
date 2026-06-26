"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { FormNotice } from "@/components/ui";

export function PrivacyControls() {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/privacy/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const data = (await res.json()) as { error?: string; deleted?: Record<string, number> };
      if (!res.ok) throw new Error(data.error ?? "Suppression impossible.");
      setMessage({ tone: "success", text: "Données de compte supprimées. Une preuve d'audit non tenantée a été conservée." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Erreur de suppression." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <a
        href="/api/privacy/export"
        className="inline-flex min-h-11 items-center rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
      >
        Télécharger mon export JSON
      </a>

      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <h2 className="text-sm font-semibold text-rose-950">Supprimer le compte et les données</h2>
        <p className="mt-1 text-sm leading-relaxed text-rose-900">
          Cette action supprime l'entreprise, les appels, actions, consentements, sessions vocales, preuves et éléments de révision.
          Seule une preuve d'audit minimale, sans rattachement tenant, est conservée.
        </p>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-rose-950">Tapez SUPPRIMER ALLO MAUDE</span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-rose-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy || confirmation !== "SUPPRIMER ALLO MAUDE"}
          onClick={deleteAccount}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          Supprimer définitivement
        </button>
      </div>

      {message && <FormNotice tone={message.tone}>{message.text}</FormNotice>}
    </div>
  );
}
