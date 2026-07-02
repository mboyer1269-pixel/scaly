"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import { FIELD_INPUT_CLASS, FIELD_LABEL_CLASS, FormNotice } from "@/components/ui";

interface ServiceCategoryOption {
  id: string;
  label: string;
}

/**
 * « Une plage vient de se libérer ? » — le formulaire 5 secondes du propriétaire :
 * un libellé humain, une catégorie optionnelle, un bouton. Le moteur fait le reste
 * (matching consenti, offres préparées, envoi si Twilio est branché).
 */
export function OpenGapForm({ serviceCategories }: { serviceCategories: ServiceCategoryOption[] }) {
  const router = useRouter();
  const [humanLabel, setHumanLabel] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  async function submit() {
    if (!humanLabel.trim()) {
      setNotice({ tone: "error", text: "Décrivez la plage en mots simples — ex. « jeudi 3 juillet, 14 h »." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/gap-recovery/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          humanLabel: humanLabel.trim(),
          serviceCategory: serviceCategory || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ouverture impossible.");
      const prepared = Array.isArray(data.offers) ? data.offers.length : 0;
      setNotice({
        tone: prepared > 0 ? "success" : "info",
        text:
          prepared === 0
            ? "Plage notée — personne sur la liste d'attente ne correspond pour l'instant. Elle sera offerte dès qu'un appelant s'inscrit."
            : data.sent > 0
              ? `${prepared} personne(s) relancée(s) — ${data.sent} texto(s) parti(s). Première réponse OUI remporte la plage.`
              : `${prepared} offre(s) préparée(s) et visibles ci-dessous. Branchez Twilio pour l'envoi automatique.`,
      });
      setHumanLabel("");
      setServiceCategory("");
      router.refresh();
    } catch (cause) {
      setNotice({ tone: "error", text: cause instanceof Error ? cause.message : "Ouverture impossible." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label htmlFor="gap-human-label" className={FIELD_LABEL_CLASS}>
            La plage, en mots simples
          </label>
          <input
            id="gap-human-label"
            value={humanLabel}
            onChange={(event) => setHumanLabel(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submit()}
            placeholder="ex. jeudi 3 juillet, 14 h"
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="gap-service" className={FIELD_LABEL_CLASS}>
            Service (optionnel)
          </label>
          <select
            id="gap-service"
            value={serviceCategory}
            onChange={(event) => setServiceCategory(event.target.value)}
            className={FIELD_INPUT_CLASS}
          >
            <option value="">Tous les services</option>
            {serviceCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-scaly-600 px-4 py-2 text-sm font-semibold text-white hover:bg-scaly-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          Relancer la liste
        </button>
      </div>
      {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
    </div>
  );
}

/** Boutons d'action sur une offre : la personne a dit oui / non, ou on la retire. */
export function OfferActions({ offerId, status }: { offerId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "confirm" | "decline" | "cancel") {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(`/api/gap-recovery/offers/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action impossible.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  }

  if (status !== "prepared" && status !== "sent") return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => act("confirm")}
        disabled={busy !== null}
        title="La personne a dit oui — la plage est comblée"
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy === "confirm" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        A dit oui
      </button>
      <button
        onClick={() => act("decline")}
        disabled={busy !== null}
        title="La personne a dit non — elle reste sur la liste"
        className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
      >
        {busy === "decline" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        A dit non
      </button>
      <button
        onClick={() => act("cancel")}
        disabled={busy !== null}
        title="Retirer cette offre"
        className="inline-flex items-center rounded-lg px-2 py-1 text-xs text-ink-400 hover:text-rose-600 disabled:opacity-50"
      >
        Retirer
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
