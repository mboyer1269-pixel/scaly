"use client";

import { type FormEvent, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { Company } from "@/domain/company";
import { INDUSTRY_LABELS } from "@/domain/company";
import { Badge, Card, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS, FormNotice, HonestyNote } from "@/components/ui";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function lines(arr: string[]): string {
  return arr.join("\n");
}
function parseLines(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

export function SettingsForm({ company, persistent }: { company: Company; persistent: boolean }) {
  const [form, setForm] = useState({
    name: company.name,
    businessDescription: company.businessDescription ?? "",
    reviewUrl: company.reviewUrl ?? "",
    sectorLabel: company.sectorLabel,
    city: company.city,
    mainPhone: company.mainPhone,
    transferPhone: company.transferPhone,
    tone: company.tone,
    defaultLanguage: company.defaultLanguage,
    open: company.hours.open,
    close: company.hours.close,
    days: company.hours.days,
    services: lines(company.services),
    serviceAreas: lines(company.serviceAreas),
    essentialQuestions: lines(company.essentialQuestions),
    policies: lines(company.policies),
    smsConfirmation: company.followUp.smsConfirmation,
    emailSummary: company.followUp.emailSummary,
    missedCallAutoSms: company.followUp.missedCallAutoSms,
    dailyDigestHour: company.followUp.dailyDigestHour,
    aiDisclosure: company.compliance.aiDisclosure,
    recordingEnabled: company.compliance.recordingEnabled,
    recordingDisclosure: company.compliance.recordingDisclosure,
    retentionDays: company.compliance.retentionDays,
    piiMinimization: company.compliance.piiMinimization,
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          businessDescription: form.businessDescription,
          reviewUrl: form.reviewUrl,
          sectorLabel: form.sectorLabel,
          city: form.city,
          mainPhone: form.mainPhone,
          transferPhone: form.transferPhone,
          tone: form.tone,
          defaultLanguage: form.defaultLanguage,
          hours: { open: form.open, close: form.close, days: form.days },
          services: parseLines(form.services),
          serviceAreas: parseLines(form.serviceAreas),
          essentialQuestions: parseLines(form.essentialQuestions),
          policies: parseLines(form.policies),
          followUp: {
            smsConfirmation: form.smsConfirmation,
            emailSummary: form.emailSummary,
            missedCallAutoSms: form.missedCallAutoSms,
            dailyDigestHour: Number(form.dailyDigestHour),
          },
          compliance: {
            aiDisclosure: form.aiDisclosure,
            recordingEnabled: form.recordingEnabled,
            recordingDisclosure: form.recordingDisclosure,
            retentionDays: Number(form.retentionDays),
            piiMinimization: form.piiMinimization,
          },
        }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setFeedback({
        tone: "success",
        text: persistent
          ? "Configuration sauvegardée dans PostgreSQL. Entrée ajoutée au journal d'audit."
          : "Configuration sauvegardée temporairement en mémoire. Entrée ajoutée au journal d'audit.",
      });
    } catch (e) {
      setFeedback({ tone: "error", text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setSaving(false);
    }
  }

  const input = FIELD_INPUT_CLASS;
  const label = FIELD_LABEL_CLASS;

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Identité">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="settings-name">Nom de l'entreprise</label>
            <input id="settings-name" name="name" className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="settings-sector">Secteur</label>
            <input id="settings-sector" name="sectorLabel" className={input} value={form.sectorLabel} onChange={(e) => set("sectorLabel", e.target.value)} />
            <p className="mt-1 text-[11px] text-ink-600">Industrie du script actif : {INDUSTRY_LABELS[company.industry]}. Pour la modifier, utilisez « Former Maude ».</p>
          </div>
          <div>
            <label className={label} htmlFor="settings-city">Ville</label>
            <input id="settings-city" name="city" className={input} value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="settings-tone">Ton de voix</label>
            <select id="settings-tone" name="tone" className={input} value={form.tone} onChange={(e) => set("tone", e.target.value as Company["tone"])}>
              <option value="professionnel">Professionnel</option>
              <option value="chaleureux">Chaleureux</option>
              <option value="energique">Énergique</option>
              <option value="calme">Calme</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="settings-main-phone">Numéro principal</label>
            <input id="settings-main-phone" name="mainPhone" type="tel" className={input} value={form.mainPhone} onChange={(e) => set("mainPhone", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="settings-transfer-phone">Numéro de transfert (humain)</label>
            <input id="settings-transfer-phone" name="transferPhone" type="tel" className={input} value={form.transferPhone} onChange={(e) => set("transferPhone", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="settings-language">Langue par défaut</label>
            <select id="settings-language" name="defaultLanguage" className={input} value={form.defaultLanguage} onChange={(e) => set("defaultLanguage", e.target.value as Company["defaultLanguage"])}>
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="settings-business-description">Description approuvée de l'entreprise</label>
            <textarea
              id="settings-business-description"
              name="businessDescription"
              rows={4}
              className={input}
              value={form.businessDescription}
              onChange={(e) => set("businessDescription", e.target.value)}
            />
            <p className="mt-1 text-[11px] text-ink-600">Ce contexte est transmis à Maude. Utilisez « Former Maude » pour obtenir des propositions guidées.</p>
          </div>
        </div>
      </Card>

      <Card title="Heures d'ouverture" subtitle="hors de ces heures, les appels répondus comptent comme « sauvés »">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className={label} htmlFor="settings-open">Ouverture</label>
            <input id="settings-open" name="open" type="time" className={input} value={form.open} onChange={(e) => set("open", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="settings-close">Fermeture</label>
            <input id="settings-close" name="close" type="time" className={input} value={form.close} onChange={(e) => set("close", e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {DAY_LABELS.map((d, i) => (
            <button
              key={d}
              type="button"
              aria-pressed={form.days.includes(i)}
              onClick={() => set("days", form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i].sort())}
              className={form.days.includes(i)
                ? "min-h-11 min-w-11 rounded-lg bg-scaly-700 px-3 py-2 text-xs font-semibold text-white"
                : "min-h-11 min-w-11 rounded-lg border border-ink-300 px-3 py-2 text-xs text-ink-700 hover:bg-ink-50"}
            >
              {d}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Offre et territoire">
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="settings-services">Services offerts (un par ligne)</label>
            <textarea id="settings-services" name="services" rows={5} className={input} value={form.services} onChange={(e) => set("services", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="settings-service-areas">Zones desservies (une par ligne)</label>
            <textarea id="settings-service-areas" name="serviceAreas" rows={3} className={input} value={form.serviceAreas} onChange={(e) => set("serviceAreas", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="settings-policies">Politiques internes (une par ligne)</label>
            <textarea id="settings-policies" name="policies" rows={3} className={input} value={form.policies} onChange={(e) => set("policies", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="settings-essential-questions">Questions essentielles à poser (une par ligne)</label>
            <textarea id="settings-essential-questions" name="essentialQuestions" rows={4} className={input} value={form.essentialQuestions} onChange={(e) => set("essentialQuestions", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="settings-review-url">Lien Google Review (optionnel)</label>
            <input
              id="settings-review-url"
              name="reviewUrl"
              type="url"
              inputMode="url"
              placeholder="https://g.page/r/votre-commerce/review"
              className={input}
              value={form.reviewUrl}
              onChange={(e) => set("reviewUrl", e.target.value)}
            />
            <p className="mt-1 text-[11px] text-ink-600">Lien Google Review utilisé seulement après une interaction positive ou résolue. URL https uniquement ; laissez vide pour ne pas demander d'avis.</p>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card title="Préférences de suivi">
          <div className="space-y-2.5 text-sm">
            <label className="flex min-h-11 cursor-pointer items-center gap-2"><input name="smsConfirmation" type="checkbox" checked={form.smsConfirmation} onChange={(e) => set("smsConfirmation", e.target.checked)} /> SMS de confirmation après prise de RDV</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2"><input name="missedCallAutoSms" type="checkbox" checked={form.missedCallAutoSms} onChange={(e) => set("missedCallAutoSms", e.target.checked)} /> SMS automatique de rappel d'appel manqué</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2"><input name="emailSummary" type="checkbox" checked={form.emailSummary} onChange={(e) => set("emailSummary", e.target.checked)} /> Résumé d'appel par courriel</label>
            <label className="flex min-h-11 items-center gap-2">Résumé quotidien à
              <input name="dailyDigestHour" type="number" min={0} max={23} className="min-h-11 w-20 rounded-lg border border-ink-300 px-2 py-1 text-ink-900" value={form.dailyDigestHour} onChange={(e) => set("dailyDigestHour", Number(e.target.value))} /> h
            </label>
          </div>
        </Card>

        <Card title="Conformité" subtitle="Loi 25 (Québec) / PIPEDA — voir docs/COMPLIANCE.md">
          <div className="space-y-2.5 text-sm">
            <label className="flex min-h-11 cursor-pointer items-center gap-2"><input name="aiDisclosure" type="checkbox" checked={form.aiDisclosure} onChange={(e) => set("aiDisclosure", e.target.checked)} /> L'agent s'annonce comme assistant virtuel (recommandé)</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2"><input name="recordingEnabled" type="checkbox" checked={form.recordingEnabled} onChange={(e) => set("recordingEnabled", e.target.checked)} /> Enregistrement des appels (sans effet tant que la téléphonie réelle n'est pas vérifiée)</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2"><input name="recordingDisclosure" type="checkbox" checked={form.recordingDisclosure} onChange={(e) => set("recordingDisclosure", e.target.checked)} /> Mention d'enregistrement en début d'appel</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2"><input name="piiMinimization" type="checkbox" checked={form.piiMinimization} onChange={(e) => set("piiMinimization", e.target.checked)} /> Minimisation des renseignements personnels collectés</label>
            <label className="flex min-h-11 items-center gap-2">Rétention des transcriptions :
              <input name="retentionDays" type="number" min={7} max={730} className="min-h-11 w-24 rounded-lg border border-ink-300 px-2 py-1 text-ink-900" value={form.retentionDays} onChange={(e) => set("retentionDays", Number(e.target.value))} /> jours
            </label>
          </div>
        </Card>

        <Card title="Règles d'escalade" subtitle="lecture seule dans cette version">
          <ul className="space-y-2">
            {company.escalationRules.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-lg border border-ink-100 px-3 py-2 text-xs text-ink-600">
                <Badge tone="violet">{r.action === "transfer_human" ? "Transfert" : r.action === "notify_owner" ? "Notification" : "Tâche urgente"}</Badge>
                {r.description}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="lg:col-span-2">
        {feedback && <div className="mb-3"><FormNotice tone={feedback.tone}>{feedback.text}</FormNotice></div>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-scaly-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-800 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Sauvegarder
          </button>
          <HonestyNote>
            {persistent
              ? "Persistance PostgreSQL active pour cette session."
              : "Mode mémoire : les changements survivent à la navigation mais pas au redémarrage du serveur."}
          </HonestyNote>
        </div>
      </div>
    </form>
  );
}
