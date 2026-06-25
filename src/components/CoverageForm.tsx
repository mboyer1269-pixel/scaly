"use client";

import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import type { CoverageMode, CoveragePolicy } from "@/domain/company";
import { DEFAULT_COVERAGE_POLICY } from "@/services/coverage";

const MODES: Array<{
  id: CoverageMode;
  title: string;
  description: string;
}> = [
  {
    id: "after_hours",
    title: "En dehors des heures",
    description: "Maude répond lorsque votre équipe est fermée.",
  },
  {
    id: "overflow",
    title: "Quand personne ne répond",
    description: "Maude prend le relais après le délai choisi.",
  },
  {
    id: "primary",
    title: "Réception principale",
    description: "Maude répond dès le début de chaque appel.",
  },
];

export function CoverageForm({ coverage }: { coverage?: CoveragePolicy }) {
  const initial = coverage ?? DEFAULT_COVERAGE_POLICY;
  const [modes, setModes] = useState<CoverageMode[]>(initial.modes);
  const [overflowDelaySec, setOverflowDelaySec] = useState(initial.overflowDelaySec);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(mode: CoverageMode) {
    setModes((current) => current.includes(mode)
      ? current.filter((item) => item !== mode)
      : [...current, mode]);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverage: { modes, overflowDelaySec } }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "La couverture n'a pas été sauvegardée.");
      setMessage("Couverture sauvegardée. Le routage téléphonique devra encore être configuré et vérifié.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {MODES.map((mode) => {
          const selected = modes.includes(mode.id);
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => toggle(mode.id)}
              aria-pressed={selected}
              className={`min-h-32 rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-scaly-500 bg-scaly-50 ring-2 ring-scaly-100"
                  : "border-ink-200 bg-white hover:border-ink-300"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink-900">{mode.title}</span>
                <span className={`grid h-6 w-6 place-items-center rounded-full ${
                  selected ? "bg-scaly-600 text-white" : "bg-ink-100 text-ink-400"
                }`}>
                  {selected && <Check size={14} />}
                </span>
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-ink-500">
                {mode.description}
              </span>
            </button>
          );
        })}
      </div>

      {modes.includes("overflow") && (
        <label className="block max-w-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            Délai avant prise en charge
          </span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={overflowDelaySec}
              onChange={(event) => setOverflowDelaySec(Number(event.target.value))}
              className="w-full accent-scaly-600"
            />
            <span className="w-20 rounded-lg bg-ink-100 px-3 py-2 text-center text-sm font-semibold text-ink-800">
              {overflowDelaySec} s
            </span>
          </div>
        </label>
      )}

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${
          message.startsWith("Couverture") ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
        }`}>
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || modes.length === 0}
        className="inline-flex items-center gap-2 rounded-lg bg-scaly-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-scaly-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Sauvegarder la couverture
      </button>
      {modes.length === 0 && (
        <p className="text-xs font-medium text-rose-700">Choisissez au moins un mode de couverture.</p>
      )}
    </div>
  );
}
