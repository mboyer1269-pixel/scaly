"use client";

import { type FormEvent, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { VoiceAgentConfig } from "@/domain/agent";
import { Badge, Card, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS, FormNotice, HonestyNote } from "@/components/ui";

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
    ownerInstructions: lines(agent.ownerInstructions ?? []),
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
          ownerInstructions: parseLines(form.ownerInstructions),
        }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setFeedback({ tone: "success", text: "Agent sauvegardé. Les prochains appels simulés utiliseront cette configuration." });
    } catch (e) {
      setFeedback({ tone: "error", text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setSaving(false);
    }
  }

  const input = FIELD_INPUT_CLASS;
  const label = FIELD_LABEL_CLASS;
  const preview = form.greetingScript.replace(/\{company\}/g, companyName).replace(/\{agent\}/g, form.displayName);

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Personnalité">
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="agent-display-name">Prénom de l'agent</label>
            <input id="agent-display-name" name="displayName" className={input} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="agent-persona">Personnalité</label>
            <textarea id="agent-persona" name="persona" rows={3} className={input} value={form.persona} onChange={(e) => set("persona", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="agent-style">Style de conversation</label>
            <textarea id="agent-style" name="style" rows={3} className={input} value={form.style} onChange={(e) => set("style", e.target.value)} />
          </div>
          <div>
            <span className={label}>Voix</span>
            <div className="flex flex-wrap gap-2">
              <Badge tone="teal">Voix simulée (texte) — actif</Badge>
              <Badge tone="slate">ElevenLabs — non configuré</Badge>
              <Badge tone="slate">OpenAI Realtime — non vérifié</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Scripts d'accueil et de fermeture">
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="agent-greeting">Accueil — variables : {"{company}"} {"{agent}"}</label>
            <textarea id="agent-greeting" name="greetingScript" rows={3} className={input} value={form.greetingScript} onChange={(e) => set("greetingScript", e.target.value)} />
            <p className="mt-2 rounded-lg bg-scaly-50 px-3 py-2 text-xs text-ink-700 ring-1 ring-scaly-100">Aperçu : « {preview} »</p>
          </div>
          <div>
            <label className={label} htmlFor="agent-closing">Fermeture d'appel</label>
            <textarea id="agent-closing" name="closingScript" rows={3} className={input} value={form.closingScript} onChange={(e) => set("closingScript", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="agent-transfer-policy">Politique de transfert humain</label>
            <textarea id="agent-transfer-policy" name="transferPolicy" rows={3} className={input} value={form.transferPolicy} onChange={(e) => set("transferPolicy", e.target.value)} />
          </div>
        </div>
      </Card>

      <Card title="Phrases permises / interdites">
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="agent-allowed-phrases">Phrases permises (une par ligne)</label>
            <textarea id="agent-allowed-phrases" name="allowedPhrases" rows={5} className={input} value={form.allowedPhrases} onChange={(e) => set("allowedPhrases", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="agent-forbidden-phrases">Phrases interdites (une par ligne)</label>
            <textarea id="agent-forbidden-phrases" name="forbiddenPhrases" rows={5} className={input} value={form.forbiddenPhrases} onChange={(e) => set("forbiddenPhrases", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="agent-answer-limits">Limites de réponse (une par ligne)</label>
            <textarea id="agent-answer-limits" name="answerLimits" rows={4} className={input} value={form.answerLimits} onChange={(e) => set("answerLimits", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="agent-owner-instructions">Consignes approuvées du propriétaire (une par ligne)</label>
            <textarea id="agent-owner-instructions" name="ownerInstructions" rows={5} className={input} value={form.ownerInstructions} onChange={(e) => set("ownerInstructions", e.target.value)} />
          </div>
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
            Le laboratoire les applique comme consignes. Une mise en service réelle exige aussi des validateurs de sortie et des tests d'escalade.
          </HonestyNote>
        </div>
      </Card>

      <div className="lg:col-span-2">
        {feedback && <div className="mb-3"><FormNotice tone={feedback.tone}>{feedback.text}</FormNotice></div>}
        <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-scaly-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-scaly-800 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Sauvegarder l'agent
        </button>
      </div>
    </form>
  );
}
