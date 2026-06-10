"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

export function ExecuteButton({ actionId }: { actionId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function execute() {
    setLoading(true);
    try {
      await fetch(`/api/actions/${actionId}/execute`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={execute}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg bg-scaly-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-scaly-700 disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
      Exécuter (mock)
    </button>
  );
}
