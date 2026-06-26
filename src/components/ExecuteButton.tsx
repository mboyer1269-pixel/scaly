"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

export function ExecuteButton({
  actionId,
  executionMode = "mock",
}: {
  actionId: string;
  executionMode?: "mock" | "live";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function execute() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/actions/${actionId}/execute`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "L'action n'a pas pu être exécutée.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur d'exécution");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        onClick={execute}
        disabled={loading}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-scaly-700 px-3 py-2 text-xs font-semibold text-white hover:bg-scaly-800 disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
        {executionMode === "live" ? "Exécuter en réel" : "Simuler l'exécution"}
      </button>
      {error && <span className="mt-1 block max-w-56 text-[11px] text-rose-700">{error}</span>}
    </span>
  );
}
