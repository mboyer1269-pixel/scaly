"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

/** Ré-analyse un appel avec le moteur LLM (transcript brut). */
export function AnalyzeButton({ callId }: { callId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/analyze`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Erreur ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={analyze}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        title="Ré-analyser ce transcript avec le moteur LLM"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        Analyser avec le LLM
      </button>
      {error && <span className="max-w-64 text-right text-[11px] text-rose-600">{error}</span>}
    </span>
  );
}
