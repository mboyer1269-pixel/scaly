"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { Company } from "@/domain/company";
import { INDUSTRY_LABELS } from "@/domain/company";
import { Badge, Card, HonestyNote } from "@/components/ui";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function lines(arr: string[]): string {
  return arr.join("\n");
}
function parseLines(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

export function SettingsForm({ company }: { company: Company }) {
  const [form, setForm] = useState({
    name: company.name,
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
  const [message, setMessage] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
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
      setMessage("Configuration sauvegardée (en mémoire — base de données en P1). Entrée ajoutée à l'audit trail.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-medium text-ink-500";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Identité">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>Nom de l'entreprise</span><input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div>
            <span className={label}>Secteur</span>
            <input className={input} value={form.sectorLabel} onChange={(e) => set("sectorLabel", e.target.value)} />
            <p className="mt-1 text-[11px] text-ink-400">Industrie de script : {INDUSTRY_LABELS[company.industry]} (changement de script en P1)</p>
          </div>
          <div><span className={label}>Ville</span><input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div>
            <span className={label}>Ton de voix</span>
            <select className={input} value={form.tone} onChange={(e) => set("tone", e.target.value as Company["tone"])}>
              <option value="professionnel">Professionnel</option>
              <option value="chaleureux">Chaleureux</option>
              <option value="energique">Énergique</option>
              <option value="calme">Calme</option>
            </select>
          </div>
          <div><span className={label}>Numéro principal</span><input className={input} value={form.mainPhone} onChange={(e) => set("mainPhone", e.target.value)} /></div>
          <div><span className={label}>Numéro de transfert (humain)</span><input className={input} value={form.transferPhone} onChange={(e) => set("transferPhone", e.target.value)} /></div>
          <div>
            <span className={label}>Langue par défaut</span>
            <select className={input} value={form.defaultLanguage} onChange={(e) => set("defaultLanguage", e.target.value as Company["defaultLanguage"])}>
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
            </select>
          </div>
        </div>
      </Card>

      <Card title="Heures d'ouverture" subtitle="hors de ces heures, les appels répondus comptent comme « sauvés »">
        <div className="flex flex-wrap items-center gap-4">
          <div><span className={label}>Ouverture</span><input type="time" className={input} value={form.open} onChange={(e) => set("open", e.target.value)} /></div>
          <div><span className={label}>Fermeture</span><input type="time" className={input} value={form.close} onChange={(e) => set("close", e.target.value)} /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {DAY_LABELS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => set("days", form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i].sort())}
              className={form.days.includes(i)
                ? "rounded-lg bg-scaly-600 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-500 hover:bg-ink-50"}
            >
              {d}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Offre et territoire">
        <div className="space-y-4">
          <div><span className={label}>Services offerts (un par ligne)</span><textarea rows={5} className={input} value={form.services} onChange={(e) => set("services", e.target.value)} /></div>
          <div><span className={label}>Zones desservies (une par ligne)</span><textarea rows={3} className={input} value={form.serviceAreas} onChange={(e) => set("serviceAreas", e.target.value)} /></div>
          <div><span className={label}>Politiques internes (une par ligne)</span><textarea rows={3} className={input} value={form.policies} onChange={(e) => set("policies", e.target.value)} /></div>
          <div><span className={label}>Questions essentielles à poser (une par ligne)</span><textarea rows={4} className={input} value={form.essentialQuestions} onChange={(e) => set("essentialQuestions", e.target.value)} /></div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card title="Préférences de suivi">
          <div className="space-y-2.5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.smsConfirmation} onChange={(e) => set("smsConfirmation", e.target.checked)} /> SMS de confirmation après prise de RDV</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.missedCallAutoSms} onChange={(e) => set("missedCallAutoSms", e.target.checked)} /> SMS automatique de rappel d'appel manqué</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.emailSummary} onChange={(e) => set("emailSummary", e.target.checked)} /> Résumé d'appel par courriel</label>
            <label className="flex items-center gap-2">Résumé quotidien à
              <input type="number" min={0} max={23} className="w-20 rounded-lg border border-ink-200 px-2 py-1" value={form.dailyDigestHour} onChange={(e) => set("dailyDigestHour", Number(e.target.value))} /> h
            </label>
          </div>
        </Card>

        <Card title="Conformité" subtitle="Loi 25 (Québec) / PIPEDA — voir docs/COMPLIANCE.md">
          <div className="space-y-2.5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.aiDisclosure} onChange={(e) => set("aiDisclosure", e.target.checked)} /> L'agent s'annonce comme assistant virtuel (recommandé)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.recordingEnabled} onChange={(e) => set("recordingEnabled", e.target.checked)} /> Enregistrement des appels (P2 — désactivé tant que la téléphonie n'est pas branchée)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.recordingDisclosure} onChange={(e) => set("recordingDisclosure", e.target.checked)} /> Mention d'enregistrement en début d'appel</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.piiMinimization} onChange={(e) => set("piiMinimization", e.target.checked)} /> Minimisation des renseignements personnels collectés</label>
            <label className="flex items-center gap-2">Rétention des transcriptions :
              <input type="number" min={7} max={730} className="w-24 rounded-lg border border-ink-200 px-2 py-1" value={form.retentionDays} onChange={(e) => set("retentionDays", Number(e.target.value))} /> jours
            </label>
          </div>
        </Card>

        <Card title="Règles d'escalade" subtitle="lecture seule — éditeur visuel prévu en P1">
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
        {message && <p className="mb-3 rounded-lg bg-scaly-50 px-3 py-2 text-sm text-scaly-800">{message}</p>}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-scaly-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-700 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Sauvegarder
          </button>
          <HonestyNote>Persistance en mémoire : les changements survivent à la navigation mais pas au redémarrage du serveur (Postgres prévu en P1).</HonestyNote>
        </div>
      </div>
    </div>
  );
}
