"use client";

import { type FormEvent, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import type { BusinessBrainAnswer, BusinessKnowledgeItem } from "@/domain/business-brain";
import { Badge, Card, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS, FormNotice, HonestyNote } from "@/components/ui";

function statusTone(status: BusinessKnowledgeItem["status"]): "emerald" | "amber" | "slate" {
  if (status === "approved") return "emerald";
  if (status === "draft") return "amber";
  return "slate";
}

function statusLabel(status: BusinessKnowledgeItem["status"]): string {
  if (status === "approved") return "Approuvee";
  if (status === "draft") return "Brouillon";
  return "Archivee";
}

export function BusinessBrainClient({ initialItems }: { initialItems: BusinessKnowledgeItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [question, setQuestion] = useState("Quelles zones desservez-vous?");
  const [answer, setAnswer] = useState<BusinessBrainAnswer | null>(null);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  async function refreshItems() {
    const response = await fetch("/api/knowledge");
    const data = (await response.json()) as { items: BusinessKnowledgeItem[] };
    setItems(data.items);
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, sourceLabel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Creation impossible.");
      setTitle("");
      setContent("");
      setSourceLabel("");
      await refreshItems();
      setFeedback({ tone: "info", text: "Brouillon ajoute. Il n'influence pas Maude tant qu'il n'est pas approuve." });
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Creation impossible." });
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(id: string, action: "approve" | "archive") {
    setFeedback(null);
    const response = await fetch(`/api/knowledge/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) {
      setFeedback({ tone: "error", text: data.error ?? "Mise a jour impossible." });
      return;
    }
    await refreshItems();
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAsking(true);
    setAnswer(null);
    try {
      const response = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Question impossible.");
      setAnswer(data.answer);
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Question impossible." });
    } finally {
      setAsking(false);
    }
  }

  const approvedCount = items.filter((item) => item.status === "approved").length;
  const draftCount = items.filter((item) => item.status === "draft").length;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card
          title="Sources approuvees"
          subtitle="Seules ces connaissances peuvent servir de source a Maude. Chaque reponse doit citer sa source."
          action={<Badge tone="emerald">{approvedCount} active{approvedCount > 1 ? "s" : ""}</Badge>}
        >
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-ink-100 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                    <p className="mt-1 text-xs text-ink-500">{item.sourceLabel}</p>
                  </div>
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{item.content}</p>
                {item.sourceType !== "company_config" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, "approve")}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-scaly-700 px-3 py-2 text-xs font-semibold text-white hover:bg-scaly-800"
                      >
                        <Check size={13} /> Approuver
                      </button>
                    )}
                    {item.status !== "archived" && (
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, "archive")}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-ink-300 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                      >
                        <X size={13} /> Archiver
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Ajouter une connaissance" subtitle="Elle arrive en brouillon et reste inactive jusqu'a approbation.">
          <form onSubmit={createDraft} className="space-y-3">
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="knowledge-title">Titre</label>
              <input id="knowledge-title" className={FIELD_INPUT_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="knowledge-source">Source</label>
              <input id="knowledge-source" className={FIELD_INPUT_CLASS} placeholder="Ex. Proprietaire, site web, menu" value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} />
            </div>
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="knowledge-content">Contenu approuvable</label>
              <textarea id="knowledge-content" rows={5} className={FIELD_INPUT_CLASS} value={content} onChange={(event) => setContent(event.target.value)} />
            </div>
            <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-scaly-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Ajouter le brouillon
            </button>
          </form>
        </Card>

        <Card title="Tester une question" subtitle="Aucun LLM ici : le test prouve les sources et le refus propre.">
          <form onSubmit={ask} className="space-y-3">
            <input className={FIELD_INPUT_CLASS} value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button type="submit" disabled={asking} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50">
              {asking ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Tester
            </button>
          </form>
          {answer && (
            <div className="mt-4 rounded-lg border border-ink-100 bg-ink-50 px-3 py-3">
              <p className={answer.status === "answered" ? "text-sm font-semibold text-ink-900" : "text-sm font-semibold text-amber-800"}>{answer.answer}</p>
              {answer.citations.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-ink-600">
                  {answer.citations.map((citation) => (
                    <li key={citation.itemId}>Source : {citation.title} — {citation.sourceLabel}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="mt-4">
            <HonestyNote>
              {draftCount} brouillon{draftCount > 1 ? "s" : ""} inactif{draftCount > 1 ? "s" : ""}. Maude doit refuser si aucune source approuvee ne repond.
            </HonestyNote>
          </div>
        </Card>

        {feedback && <FormNotice tone={feedback.tone}>{feedback.text}</FormNotice>}
      </div>
    </div>
  );
}
