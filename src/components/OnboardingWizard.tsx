"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { OnboardingDraft } from "@/services/onboarding";
import { INDUSTRY_LABELS, type Industry } from "@/domain/company";
import { Card, HonestyNote } from "@/components/ui";

function lines(arr: string[]): string {
  return arr.join("\n");
}
function parseLines(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

type Step = "saisie" | "edition" | "applique";

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>("saisie");
  const [url, setUrl] = useState("");
  const [blurb, setBlurb] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceChars, setSourceChars] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [approved, setApproved] = useState(false);

  function setField<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, blurb }),
      });
      const data = (await res.json()) as { draft?: OnboardingDraft; sourceChars?: number; error?: string };
      if (!res.ok || !data.draft) throw new Error(data.error ?? "Erreur de génération");
      setDraft(data.draft);
      setSourceChars(data.sourceChars ?? 0);
      setApproved(false);
      setStep("edition");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!draft || !approved) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, approved: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur d'application");
      setStep("applique");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-medium text-ink-500";

  if (step === "applique") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="text-lg font-semibold text-ink-900">Profil appliqué — votre réceptionniste est configurée.</p>
          <p className="max-w-md text-sm text-ink-500">
            L'approbation est tracée dans l'audit. Vérifiez le résultat dans{" "}
            <Link href="/agent" className="font-medium text-scaly-700 underline">Agent vocal</Link> et{" "}
            <Link href="/settings" className="font-medium text-scaly-700 underline">Entreprise</Link>, puis testez un appel dans le{" "}
            <Link href="/simulator" className="font-medium text-scaly-700 underline">Simulateur</Link>.
          </p>
        </div>
      </Card>
    );
  }

  if (step === "edition" && draft) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <Card title="Ce que Scaly a compris" subtitle={`brouillon généré à partir de ${url}${sourceChars ? ` (${sourceChars} caractères analysés)` : ""} — corrigez tout ce qui cloche avant d'approuver`}>
            <p className="text-sm text-ink-700">{draft.understanding}</p>
          </Card>
        </div>

        <Card title="Identité">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><span className={label}>Nom de l'entreprise</span><input className={input} value={draft.name} onChange={(e) => setField("name", e.target.value)} /></div>
            <div>
              <span className={label}>Industrie (détermine le script d'appel)</span>
              <select className={input} value={draft.industry} onChange={(e) => setField("industry", e.target.value as Industry)}>
                {Object.entries(INDUSTRY_LABELS).map(([value, lbl]) => (
                  <option key={value} value={value}>{lbl}</option>
                ))}
              </select>
            </div>
            <div><span className={label}>Ville</span><input className={input} value={draft.city} onChange={(e) => setField("city", e.target.value)} /></div>
            <div>
              <span className={label}>Ton de voix</span>
              <select className={input} value={draft.tone} onChange={(e) => setField("tone", e.target.value as OnboardingDraft["tone"])}>
                <option value="chaleureux">Chaleureux</option>
                <option value="professionnel">Professionnel</option>
                <option value="energique">Énergique</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <span className={label}>Langues répondues</span>
              <div className="flex gap-4 text-sm">
                {(["fr", "en"] as const).map((l) => (
                  <label key={l} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.languages.includes(l)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...draft.languages, l] : draft.languages.filter((x) => x !== l);
                        if (next.length) setField("languages", next);
                      }}
                    />
                    {l === "fr" ? "Français" : "Anglais"}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Offre et territoire">
          <div className="space-y-4">
            <div><span className={label}>Services offerts (un par ligne)</span><textarea rows={5} className={input} value={lines(draft.services)} onChange={(e) => setField("services", parseLines(e.target.value))} /></div>
            <div><span className={label}>Zones desservies (une par ligne)</span><textarea rows={3} className={input} value={lines(draft.serviceAreas)} onChange={(e) => setField("serviceAreas", parseLines(e.target.value))} /></div>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Card title="Persona de la réceptionniste" subtitle="c'est elle qui parlera au nom de votre entreprise — relisez attentivement">
            <textarea rows={3} className={input} value={draft.persona} onChange={(e) => setField("persona", e.target.value)} />
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input type="checkbox" className="mt-0.5" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
            J'ai vérifié chaque champ et j'approuve ce profil : la réceptionniste parlera au nom de mon entreprise sur cette base.
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={apply}
              disabled={!approved || busy}
              className="inline-flex items-center gap-2 rounded-lg bg-scaly-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-700 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Approuver et appliquer
            </button>
            <button onClick={() => setStep("saisie")} disabled={busy} className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm text-ink-600 hover:bg-ink-50">
              Recommencer
            </button>
            <HonestyNote>Rien n'est actif tant que vous n'avez pas approuvé — le brouillon reste un brouillon.</HonestyNote>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Card title="Votre site + deux phrases" subtitle="Scaly lit votre site et prépare un brouillon de profil — vous gardez le dernier mot">
        <div className="space-y-4">
          <div>
            <span className={label}>Adresse de votre site web</span>
            <input className={input} placeholder="ex. plomberiebelair.ca" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <span className={label}>Décrivez votre entreprise en deux phrases (optionnel mais recommandé)</span>
            <textarea
              rows={3}
              maxLength={600}
              className={input}
              placeholder="ex. Plomberie résidentielle sur la Rive-Sud, urgences 24/7. On veut surtout récupérer les appels manqués le soir."
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
            />
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={generate}
              disabled={busy || url.trim().length < 4}
              className="inline-flex items-center gap-2 rounded-lg bg-scaly-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-700 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Générer le brouillon
            </button>
            <p className="text-xs text-ink-400">
              Sans site web ? Le <Link href="/settings" className="underline">formulaire manuel</Link> reste disponible.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
