"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { VoiceAgentConfig } from "@/domain/agent";
import { Badge, Card, HonestyNote } from "@/components/ui";

function lines(arr: string[]): string {
  return arr.join("\n");
}
function parseLines(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

export function AgentForm({ agent, companyName }: { agent: VoiceAgentConfig; companyName: string }) {
  const [form, setForm] = useState({
    displayName: agent.displayName,
    persona: agent.persona,
    style: agent.style,
    greetingScript: agent.greetingScript,
    closingScript: agent.closingScript,
    allowedPhrases: lines(agent.allowedPhrases),
    forbiddenPhrases: lines(agent.forbiddenPhrases),
    answerLimits: lines(agent.answerLimits),
    transferPolicy: agent.transferPolicy,
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
      const res = await fetch("/api/agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          persona: form.persona,
          style: form.style,
          greetingScript: form.greetingScript,
          closingScript: form.closingScript,
          allowedPhrases: parseLines(form.allowedPhrases),
          forbiddenPhrases: parseLines(form.forbiddenPhrases),
          answerLimits: parseLines(form.answerLimits),
          transferPolicy: form.transferPolicy,
        }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setMessage("Agent sauvegardé. Les prochains appels simulés utiliseront cette configuration.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-medium text-ink-500";
  const preview = form.greetingScript.replace(/\{company\}/g, companyName).replace(/\{agent\}/g, form.displayName);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Personnalité">
        <div className="space-y-4">
          <div><span className={label}>Prénom de l'agent</span><input className={input} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} /></div>
          <div><span className={label}>Personnalité</span><textarea rows={3} className={input} value={form.persona} onChange={(e) => set("persona", e.target.value)} /></div>
          <div><span className={label}>Style de conversation</span><textarea rows={3} className={input} value={form.style} onChange={(e) => set("style", e.target.value)} /></div>
          <div>
            <span className={label}>Voix</span>
            <div className="flex flex-wrap gap-2">
              <Badge tone="teal">Voix simulée (texte) — actif</Badge>
              <Badge tone="slate">ElevenLabs — P2</Badge>
              <Badge tone="slate">OpenAI Realtime — P2</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Scripts d'accueil et de fermeture">
        <div className="space-y-4">
          <div>
            <span className={label}>Accueil — variables : {"{company}"} {"{agent}"}</span>
            <textarea rows={3} className={input} value={form.greetingScript} onChange={(e) => set("greetingScript", e.target.value)} />
            <p className="mt-2 rounded-lg bg-scaly-50 px-3 py-2 text-xs text-ink-700 ring-1 ring-scaly-100">Aperçu : « {preview} »</p>
          </div>
          <div><span className={label}>Fermeture d'appel</span><textarea rows={3} className={input} value={form.closingScript} onChange={(e) => set("closingScript", e.target.value)} /></div>
          <div><span className={label}>Politique de transfert humain</span><textarea rows={3} className={input} value={form.transferPolicy} onChange={(e) => set("transferPolicy", e.target.value)} /></div>
        </div>
      </Card>

      <Card title="Phrases permises / interdites">
        <div className="space-y-4">
          <div><span className={label}>Phrases permises (une par ligne)</span><textarea rows={5} className={input} value={form.allowedPhrases} onChange={(e) => set("allowedPhrases", e.target.value)} /></div>
          <div><span className={label}>Phrases interdites (une par ligne)</span><textarea rows={5} className={input} value={form.forbiddenPhrases} onChange={(e) => set("forbiddenPhrases", e.target.value)} /></div>
          <div><span className={label}>Limites de réponse (une par ligne)</span><textarea rows={4} className={input} value={form.answerLimits} onChange={(e) => set("answerLimits", e.target.value)} /></div>
        </div>
      </Card>

      <Card title="Règles de sécurité" subtitle="non modifiables — appliquées à Maude pendant tous les appels">
        <ul className="space-y-2">
          {agent.safetyRules.map((r, i) => (
            <li key={i} className="rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2 text-xs text-ink-700">{r}</li>
          ))}
        </ul>
        <div className="mt-4">
          <HonestyNote>
            En P2, ces règles deviendront des contraintes dures du prompt système temps réel + des validateurs de sortie (pas seulement des consignes).
          </HonestyNote>
        </div>
      </Card>

      <div className="lg:col-span-2">
        {message && <p className="mb-3 rounded-lg bg-scaly-50 px-3 py-2 text-sm text-scaly-800">{message}</p>}
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-scaly-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-700 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Sauvegarder l'agent
        </button>
      </div>
    </div>
  );
}
