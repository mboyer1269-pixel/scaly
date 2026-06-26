"use client";

/**
 * Client du simulateur : POST /api/simulate puis révélation progressive du
 * transcript et affichage de l'intelligence + actions. L'appel est persisté
 * dans le store (visible ensuite dans Appels et le Dashboard).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Phone, RotateCcw } from "lucide-react";
import clsx from "clsx";
import { PERSONAS } from "@/data/personas";
import { INTENT_LABELS, NEXT_ACTION_LABELS, type Call } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import type { ReviewItem } from "@/domain/review";
import type { RealityLabel } from "@/domain/readiness";
import { Badge, Card, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS, FormNotice, HonestyNote } from "@/components/ui";
import { RealityBadge } from "@/components/RealityBadge";
import { actionStatusBadge, leadBadge, urgencyBadge } from "@/lib/labels";
import { formatCad } from "@/lib/format";

interface SimResponse {
  call: Call;
  actions: ScalyAction[];
  reviewItems: ReviewItem[];
  reality: RealityLabel;
  auditRecorded: boolean;
  seed: number;
  persisted: boolean;
  error?: string;
}

export function SimulatorClient({ scriptId, scriptName }: { scriptId: string; scriptName: string }) {
  const [personaId, setPersonaId] = useState("persona_urgence");
  const [seedInput, setSeedInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimResponse | null>(null);
  const [revealed, setRevealed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function clearResult() {
    if (timer.current) clearInterval(timer.current);
    setResult(null);
    setRevealed(0);
    setError(null);
  }

  async function run(seed?: number) {
    setLoading(true);
    setError(null);
    setResult(null);
    setRevealed(0);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId, personaId, seed }),
      });
      const data = (await res.json()) as SimResponse;
      if (!res.ok) throw new Error(data.error ?? "Erreur de simulation");
      setResult(data);
      // Révélation progressive du transcript (350 ms / tour).
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(() => {
        setRevealed((r) => {
          if (r >= data.call.transcript.length) {
            if (timer.current) clearInterval(timer.current);
            return r;
          }
          return r + 1;
        });
      }, 350);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const call = result?.call;
  const intel = call?.intelligence;
  const fullyRevealed = call ? revealed >= call.transcript.length : false;
  const u = urgencyBadge(intel?.urgency);
  const l = leadBadge(intel?.leadQuality);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-2">
        <Card title="Paramètres de l'appel">
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
              <p className="text-xs font-medium text-ink-700">Configuration testée</p>
              <p className="mt-0.5 font-semibold text-ink-800">{scriptName}</p>
              <p className="mt-1 text-xs text-ink-600">La démo utilise toujours le script réellement configuré pour cette entreprise.</p>
            </div>
            <label className="block">
              <span className={FIELD_LABEL_CLASS}>Type d'appelant</span>
              <select
                id="simulator-persona"
                name="personaId"
                value={personaId}
                onChange={(e) => {
                  setPersonaId(e.target.value);
                  clearResult();
                }}
                className={FIELD_INPUT_CLASS}
              >
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={FIELD_LABEL_CLASS}>Seed (optionnel — pour rejouer exactement le même appel)</span>
              <input
                id="simulator-seed"
                name="seed"
                inputMode="numeric"
                value={seedInput}
                onChange={(e) => {
                  setSeedInput(e.target.value.replace(/\D/g, ""));
                  clearResult();
                }}
                placeholder="aléatoire"
                className={FIELD_INPUT_CLASS}
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => run(seedInput ? Number(seedInput) : undefined)}
                disabled={loading}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-scaly-700 px-4 py-2.5 font-semibold text-white hover:bg-scaly-800 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
                Lancer l'appel simulé
              </button>
              {result && (
                <button
                  type="button"
                  onClick={() => run(result.seed)}
                  disabled={loading}
                  title="Rejouer le même seed"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-2.5 text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                >
                  <RotateCcw size={14} /> Rejouer
                </button>
              )}
            </div>
            {error && <FormNotice tone="error">{error}</FormNotice>}
            {result && (
              <p className="text-xs text-ink-500">
                Seed utilisé : <span className="font-mono font-medium">{result.seed}</span>
                {result.persisted && <> · appel enregistré dans les journaux — <Link className="text-scaly-600 hover:underline" href={`/calls/${result.call.id}`}>voir la fiche</Link></>}
              </p>
            )}
          </div>
        </Card>

        {intel && fullyRevealed && (
          <Card title="Analyse de l'appel" action={result ? <RealityBadge reality={result.reality} /> : <Badge tone="violet">moteur {intel.engine}</Badge>}>
            <div className="space-y-3 text-sm">
              <p className="rounded-lg bg-ink-50 px-3 py-2 leading-relaxed text-ink-800">{intel.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="sky">{INTENT_LABELS[intel.intent]}</Badge>
                <Badge tone={u.tone}>Urgence : {u.label}</Badge>
                <Badge tone={l.tone}>Lead : {l.label}</Badge>
                <Badge tone="emerald">{formatCad(intel.estimatedValueCad)}</Badge>
                <Badge tone="slate">Score {intel.commercialScore}/100</Badge>
              </div>
              <p className="text-xs text-ink-500">Action recommandée : <span className="font-semibold text-ink-800">{NEXT_ACTION_LABELS[intel.nextAction]}</span></p>
              {result && result.actions.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink-500">Actions déclenchées ({result.actions.length})</p>
                  <ul className="space-y-1.5">
                    {result.actions.map((a) => {
                      const st = actionStatusBadge(a.status);
                      return (
                        <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-1.5 text-xs">
                          <span className="truncate text-ink-700">{a.title}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {result && (
                <div className="rounded-xl border border-ink-200 bg-ink-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Preuves persistées</p>
                  <p className="mt-1 text-sm text-ink-800">
                    1 appel · {result.actions.length} action(s) · {result.reviewItems.length} élément(s) à réviser · audit {result.auditRecorded ? "enregistré" : "absent"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/calls/${result.call.id}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white">
                      Ouvrir l'appel <ArrowRight size={13} />
                    </Link>
                    <Link href="/follow-up" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-semibold text-ink-700">
                      Voir les suivis
                    </Link>
                    <Link href="/learn" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-semibold text-ink-700">
                      Corriger les incertitudes
                    </Link>
                    <Link href="/readiness/demo" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-semibold text-ink-700">
                      Vérifier la démo
                    </Link>
                  </div>
                </div>
              )}
              <HonestyNote>Conversation générée par un moteur de règles déterministe. Elle prouve le workflow applicatif, pas une connexion téléphonique réelle.</HonestyNote>
            </div>
          </Card>
        )}
      </div>

      <Card title="Conversation" subtitle={call ? `${call.callerName ?? call.fromNumber} · ${call.status === "transferred" ? "transféré" : "complété"}` : "Lance un appel pour voir la conversation se dérouler"} className="lg:col-span-3">
        {!call && !loading && (
          <div className="flex h-64 items-center justify-center text-sm text-ink-400">
            ☎️ En attente d'un appel simulé…
          </div>
        )}
        {loading && (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-ink-400">
            <Loader2 size={16} className="animate-spin" /> Génération de la conversation…
          </div>
        )}
        {call && (
          <ul className="space-y-3">
            {call.transcript.slice(0, revealed).map((t, i) => (
              <li key={i} className={clsx("flex", t.speaker === "agent" ? "justify-start" : "justify-end")}>
                <div className={clsx(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  t.speaker === "agent" ? "rounded-tl-sm bg-scaly-50 text-ink-800 ring-1 ring-scaly-100" : "rounded-tr-sm bg-ink-100 text-ink-800",
                )}>
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    {t.speaker === "agent" ? "Maude" : "Appelant"}{t.lang === "en" ? " · EN" : ""}
                  </p>
                  {t.text}
                </div>
              </li>
            ))}
            {!fullyRevealed && revealed > 0 && (
              <li className="flex justify-start">
                <span className="rounded-2xl bg-ink-100 px-4 py-2 text-sm text-ink-400">…</span>
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
