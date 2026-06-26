"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MessageCircle, Sparkles } from "lucide-react";
import type { CoachingDraft, OnboardingDraft } from "@/services/onboarding";
import { INDUSTRY_LABELS, type Industry } from "@/domain/company";
import { Badge, Card, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS, FormNotice, HonestyNote } from "@/components/ui";

function lines(arr: string[]): string {
  return arr.join("\n");
}
function parseLines(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

type Step = "saisie" | "coaching" | "edition" | "applique";

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>("saisie");
  const [url, setUrl] = useState("");
  const [blurb, setBlurb] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceChars, setSourceChars] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [coachingDraft, setCoachingDraft] = useState<CoachingDraft | null>(null);
  const [approved, setApproved] = useState(false);

  function setField<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function setCoachingField<K extends keyof CoachingDraft>(key: K, value: CoachingDraft[K]) {
    setCoachingDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function coach(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = (await res.json()) as { draft?: CoachingDraft; error?: string };
      if (!res.ok || !data.draft) throw new Error(data.error ?? "Erreur d'interprétation");
      setCoachingDraft(data.draft);
      setApproved(false);
      setStep("coaching");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function generate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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

  async function apply(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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

  async function applyCoaching(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!coachingDraft || !approved) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/coach/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: coachingDraft, approved: true }),
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

  const input = FIELD_INPUT_CLASS;
  const label = FIELD_LABEL_CLASS;

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

  if (step === "coaching" && coachingDraft) {
    return (
      <form onSubmit={applyCoaching} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <Card
            title="Ce que Maude propose"
            subtitle="La consigne originale est conservée mot pour mot. Vérifiez les champs structurés avant d'appliquer."
          >
            <p className="text-sm leading-relaxed text-ink-700">{coachingDraft.understanding}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {coachingDraft.changedFields.map((field) => <Badge key={field} tone="teal">{field}</Badge>)}
            </div>
          </Card>
        </div>

        <Card title="Votre entreprise" subtitle="Contexte factuel utilisé par Maude.">
          <div className="space-y-4">
            <label className="block">
              <span className={label}>Description de l'entreprise</span>
              <textarea
                id="coaching-business-description"
                name="businessDescription"
                rows={5}
                className={input}
                value={coachingDraft.businessDescription}
                onChange={(e) => setCoachingField("businessDescription", e.target.value)}
              />
            </label>
            <label className="block">
              <span className={label}>Ton</span>
              <select
                id="coaching-tone"
                name="tone"
                className={input}
                value={coachingDraft.tone}
                onChange={(e) => setCoachingField("tone", e.target.value as CoachingDraft["tone"])}
              >
                <option value="chaleureux">Chaleureux</option>
                <option value="professionnel">Professionnel</option>
                <option value="energique">Énergique</option>
                <option value="calme">Calme</option>
              </select>
            </label>
            <label className="block">
              <span className={label}>Services (un par ligne)</span>
              <textarea id="coaching-services" name="services" rows={5} className={input} value={lines(coachingDraft.services)} onChange={(e) => setCoachingField("services", parseLines(e.target.value))} />
            </label>
            <label className="block">
              <span className={label}>Territoires desservis (un par ligne)</span>
              <textarea id="coaching-service-areas" name="serviceAreas" rows={4} className={input} value={lines(coachingDraft.serviceAreas)} onChange={(e) => setCoachingField("serviceAreas", parseLines(e.target.value))} />
            </label>
          </div>
        </Card>

        <Card title="Façon de travailler de Maude" subtitle="Ces valeurs alimentent le vrai prompt vocal et les prochaines simulations.">
          <div className="space-y-4">
            <label className="block">
              <span className={label}>Accueil</span>
              <textarea id="coaching-greeting" name="greetingScript" rows={3} className={input} value={coachingDraft.greetingScript} onChange={(e) => setCoachingField("greetingScript", e.target.value)} />
            </label>
            <label className="block">
              <span className={label}>Style de conversation</span>
              <textarea id="coaching-style" name="style" rows={4} className={input} value={coachingDraft.style} onChange={(e) => setCoachingField("style", e.target.value)} />
            </label>
            <label className="block">
              <span className={label}>Politique de transfert humain</span>
              <textarea id="coaching-transfer-policy" name="transferPolicy" rows={4} className={input} value={coachingDraft.transferPolicy} onChange={(e) => setCoachingField("transferPolicy", e.target.value)} />
            </label>
            <label className="block">
              <span className={label}>Questions essentielles (une par ligne)</span>
              <textarea id="coaching-essential-questions" name="essentialQuestions" rows={4} className={input} value={lines(coachingDraft.essentialQuestions)} onChange={(e) => setCoachingField("essentialQuestions", parseLines(e.target.value))} />
            </label>
            <label className="block">
              <span className={label}>Phrases ou promesses interdites (une par ligne)</span>
              <textarea id="coaching-forbidden-phrases" name="forbiddenPhrases" rows={4} className={input} value={lines(coachingDraft.forbiddenPhrases)} onChange={(e) => setCoachingField("forbiddenPhrases", parseLines(e.target.value))} />
            </label>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Card title="Consignes exactes du propriétaire" subtitle="Elles sont conservées telles quelles dans la configuration approuvée.">
            <textarea
              rows={5}
              id="coaching-owner-instructions"
              name="ownerInstructions"
              className={input}
              value={lines(coachingDraft.ownerInstructions)}
              onChange={(e) => setCoachingField("ownerInstructions", parseLines(e.target.value))}
            />
          </Card>
        </div>

        <div className="space-y-3 lg:col-span-2">
          {error && <FormNotice tone="error">{error}</FormNotice>}
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input type="checkbox" name="approved" className="mt-1" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
            J'ai relu les propositions et j'approuve leur utilisation par Maude.
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!approved || busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-scaly-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-800 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Approuver et appliquer
            </button>
            <button type="button" onClick={() => setStep("saisie")} disabled={busy} className="min-h-11 rounded-lg border border-ink-300 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50">
              Modifier ma demande
            </button>
            <HonestyNote>L'interprétation structurée est locale et déterministe; votre consigne originale reste visible.</HonestyNote>
          </div>
        </div>
      </form>
    );
  }

  if (step === "edition" && draft) {
    return (
      <form onSubmit={apply} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <Card title="Ce que Maude a compris" subtitle={`brouillon généré à partir de ${url}${sourceChars ? ` (${sourceChars} caractères analysés)` : ""} — corrigez tout ce qui cloche avant d'approuver`}>
            <p className="text-sm text-ink-700">{draft.understanding}</p>
          </Card>
        </div>

        <Card title="Identité">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="draft-name">Nom de l'entreprise</label>
              <input id="draft-name" name="name" className={input} value={draft.name} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="draft-industry">Industrie (détermine le script d'appel)</label>
              <select id="draft-industry" name="industry" className={input} value={draft.industry} onChange={(e) => setField("industry", e.target.value as Industry)}>
                {Object.entries(INDUSTRY_LABELS).map(([value, lbl]) => (
                  <option key={value} value={value}>{lbl}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="draft-city">Ville</label>
              <input id="draft-city" name="city" className={input} value={draft.city} onChange={(e) => setField("city", e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="draft-tone">Ton de voix</label>
              <select id="draft-tone" name="tone" className={input} value={draft.tone} onChange={(e) => setField("tone", e.target.value as OnboardingDraft["tone"])}>
                <option value="chaleureux">Chaleureux</option>
                <option value="professionnel">Professionnel</option>
                <option value="energique">Énergique</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <span id="draft-languages-label" className={label}>Langues répondues</span>
              <div className="flex gap-4 text-sm">
                {(["fr", "en"] as const).map((l) => (
                  <label key={l} className="flex items-center gap-2">
                    <input
                      name="languages"
                      aria-labelledby="draft-languages-label"
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
            <div>
              <label className={label} htmlFor="draft-services">Services offerts (un par ligne)</label>
              <textarea id="draft-services" name="services" rows={5} className={input} value={lines(draft.services)} onChange={(e) => setField("services", parseLines(e.target.value))} />
            </div>
            <div>
              <label className={label} htmlFor="draft-service-areas">Zones desservies (une par ligne)</label>
              <textarea id="draft-service-areas" name="serviceAreas" rows={3} className={input} value={lines(draft.serviceAreas)} onChange={(e) => setField("serviceAreas", parseLines(e.target.value))} />
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Card title="Persona de la réceptionniste" subtitle="c'est elle qui parlera au nom de votre entreprise — relisez attentivement">
            <label className="sr-only" htmlFor="draft-persona">Persona de la réceptionniste</label>
            <textarea id="draft-persona" name="persona" rows={3} className={input} value={draft.persona} onChange={(e) => setField("persona", e.target.value)} />
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {error && <FormNotice tone="error">{error}</FormNotice>}
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input type="checkbox" name="approved" className="mt-1" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
            J'ai vérifié chaque champ et j'approuve ce profil : la réceptionniste parlera au nom de mon entreprise sur cette base.
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!approved || busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-scaly-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-800 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Approuver et appliquer
            </button>
            <button type="button" onClick={() => setStep("saisie")} disabled={busy} className="min-h-11 rounded-lg border border-ink-300 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50">
              Recommencer
            </button>
            <HonestyNote>Rien n'est actif tant que vous n'avez pas approuvé — le brouillon reste un brouillon.</HonestyNote>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card title="Parler à Maude" subtitle="Expliquez-lui votre entreprise et la façon dont elle doit travailler. Aucun changement n'est automatique.">
        <form onSubmit={coach} className="space-y-4">
          <label className="block">
            <span className={label}>Votre message à Maude</span>
            <textarea
              id="owner-instruction"
              name="instruction"
              rows={7}
              maxLength={2000}
              className={input}
              placeholder="Ex. Nous sommes une plomberie familiale à Laval. Reste calme avec les clients stressés, demande toujours si l'entrée d'eau est fermée, ne promets jamais une heure d'arrivée et transfère les urgences critiques à Martin."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </label>
          {error && <FormNotice tone="error">{error}</FormNotice>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || instruction.trim().length < 10}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-scaly-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-800 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
              Préparer les changements
            </button>
            <p className="text-xs text-ink-600">
              {instruction.trim().length < 10
                ? "Écrivez au moins 10 caractères pour préparer des changements."
                : "Votre texte exact est conservé et reste modifiable avant approbation."}
            </p>
          </div>
        </form>
      </Card>

      <Card title="Importer depuis un site web" subtitle="Optionnel — utile pour préremplir l'identité, les services et le territoire avec le moteur LLM configuré.">
        <form onSubmit={generate} className="space-y-4">
          <div>
            <label className={label} htmlFor="website-url">Adresse de votre site web</label>
            <input id="website-url" name="url" type="url" className={input} placeholder="https://plomberiebelair.ca" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="website-blurb">Expliquez comment votre entreprise travaille et comment Maude doit accueillir les clients</label>
            <textarea
              id="website-blurb"
              name="blurb"
              rows={3}
              maxLength={600}
              className={input}
              placeholder="ex. Plomberie résidentielle sur la Rive-Sud, urgences 24/7. On veut surtout récupérer les appels manqués le soir."
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || url.trim().length < 4}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-scaly-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-800 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Générer le brouillon
            </button>
            <p className="text-xs text-ink-600">
              Sans site web ? Le <Link href="/settings" className="inline-flex min-h-11 items-center underline">formulaire manuel</Link> reste disponible.
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
