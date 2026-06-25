"use client";

/**
 * Client du Voice Runtime Lab (P2A) — le cockpit du cerveau conversationnel.
 * Rejoue les scénarios golden tour par tour (ou en autoplay), permet le mode
 * libre (taper ses propres tours, couper l'agente), montre la machine à états,
 * la fiche à extraction progressive, le flight recorder et la télémétrie de
 * latence. Une session terminée se sauvegarde en appel de première classe.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { FastForward, Loader2, Mic, Pause, RotateCcw, Save, Send, StepForward } from "lucide-react";
import { VOICE_SCENARIOS } from "@/data/voice-scenarios";
import {
  LATENCY_TARGET_P50_MS,
  LATENCY_TARGET_P95_MS,
  VOICE_STATE_LABELS,
  type VoiceFieldStatus,
  type VoiceRuntimeEvent,
  type VoiceSession,
} from "@/domain/voice";
import type { Tone } from "@/lib/labels";
import { Badge, Card, HonestyNote, Stat } from "@/components/ui";

const FIELD_STATUS_BADGE: Record<VoiceFieldStatus, { label: string; tone: Tone }> = {
  missing: { label: "manquant", tone: "slate" },
  inferred: { label: "déduit", tone: "amber" },
  confirmed: { label: "confirmé", tone: "emerald" },
  conflicted: { label: "conflit", tone: "rose" },
};

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function eventLine(e: VoiceRuntimeEvent): { at: number; label: string; tone: Tone } {
  switch (e.type) {
    case "session_started": return { at: e.at, label: "Session démarrée", tone: "slate" };
    case "state_transition": return { at: e.at, label: `${VOICE_STATE_LABELS[e.from]} → ${VOICE_STATE_LABELS[e.to]} — ${e.reason}`, tone: "sky" };
    case "language_detected": return { at: e.at, label: `Langue détectée : ${e.lang.toUpperCase()}`, tone: "violet" };
    case "language_switch": return { at: e.at, label: `Switch de langue ${e.from.toUpperCase()} → ${e.to.toUpperCase()}`, tone: "violet" };
    case "field_update": return { at: e.at, label: `Champ ${e.key} ${FIELD_STATUS_BADGE[e.status].label} : « ${e.value ?? "—"} » (${Math.round(e.confidence * 100)} %)`, tone: e.status === "confirmed" ? "emerald" : "amber" };
    case "field_conflict": return { at: e.at, label: `CONFLIT sur ${e.key} : « ${e.previous} » vs « ${e.incoming} »`, tone: "rose" };
    case "decision": return { at: e.at, label: `Décision ${e.decision.action} — ${e.decision.reason}`, tone: "teal" };
    case "urgency_detected": return { at: e.at, label: `Urgence ${e.level} détectée (« ${e.matched} »)`, tone: "rose" };
    case "interruption": return { at: e.at, label: "Barge-in : l'appelant coupe l'agente", tone: "amber" };
    case "transfer_requested": return { at: e.at, label: `Transfert humain vers ${e.to} — ${e.reason}`, tone: "rose" };
    case "session_ended": return { at: e.at, label: `Session terminée (${VOICE_STATE_LABELS[e.status]}) — ${e.reason}`, tone: "slate" };
  }
}

export function VoiceLabClient() {
  const [scenarioId, setScenarioId] = useState<string>(VOICE_SCENARIOS[0].id);
  const [freeMode, setFreeMode] = useState(false);
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [interrupt, setInterrupt] = useState(false);
  const [saved, setSaved] = useState<{ callId: string; actionsPlanned: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const transcriptEnd = useRef<HTMLDivElement | null>(null);

  const scenario = VOICE_SCENARIOS.find((s) => s.id === scenarioId);
  const terminal = session ? ["completed", "failed"].includes(session.state) : false;
  const scenarioDone = !freeMode && scenario ? turnIndex >= scenario.callerTurns.length : false;

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session?.turns.length]);

  async function api<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
    return data;
  }

  async function start(free: boolean) {
    setBusy(true);
    setError(null);
    setSaved(null);
    setAutoplay(false);
    try {
      const data = await api<{ session: VoiceSession }>("/api/voice-lab", {
        op: "start",
        scenarioId: free ? undefined : scenarioId,
      });
      setFreeMode(free);
      setSession(data.session);
      setTurnIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  async function step(input: { text: string; lang?: "fr" | "en"; interrupt?: boolean }) {
    if (!session || terminal) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ session: VoiceSession }>("/api/voice-lab", { op: "step", session, input });
      setSession(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setAutoplay(false);
    } finally {
      setBusy(false);
    }
  }

  function nextScenarioTurn() {
    if (!scenario || scenarioDone || terminal) return;
    const t = scenario.callerTurns[turnIndex];
    setTurnIndex((i) => i + 1);
    void step({ text: t.text, lang: t.lang, interrupt: t.interrupt });
  }

  // Autoplay : un tour de scénario toutes les 900 ms tant qu'il en reste.
  useEffect(() => {
    if (!autoplay || busy) return;
    if (!session || terminal || scenarioDone) {
      setAutoplay(false);
      return;
    }
    const t = setTimeout(nextScenarioTurn, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, busy, session, terminal, scenarioDone]);

  async function sendFree() {
    const text = freeText.trim();
    if (!text) return;
    setFreeText("");
    setInterrupt(false);
    await step({ text, interrupt: interrupt || undefined });
  }

  async function save() {
    if (!session || !terminal || saved) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api<{ callId: string; actionsPlanned: number }>("/api/voice-lab/save", { session });
      setSaved({ callId: data.callId, actionsPlanned: data.actionsPlanned });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  const t = session?.telemetry;
  const p50Tone: Tone = t && t.perceivedP50Ms < LATENCY_TARGET_P50_MS ? "emerald" : "rose";
  const p95Tone: Tone = t && t.perceivedP95Ms < LATENCY_TARGET_P95_MS ? "emerald" : "rose";

  return (
    <div className="space-y-6">
      {session && t && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="État de la session" value={VOICE_STATE_LABELS[session.state]} sub={session.scenarioId ?? "mode libre"} />
          <Stat label="Latence perçue p50" value={`${t.perceivedP50Ms} ms`} sub={`cible < ${LATENCY_TARGET_P50_MS} ms (simulée)`} tone={p50Tone} />
          <Stat label="Latence perçue p95" value={`${t.perceivedP95Ms} ms`} sub={`cible < ${LATENCY_TARGET_P95_MS} ms (simulée)`} tone={p95Tone} />
          <Stat
            label="Conversation"
            value={`${t.turnCount} tours · ${clock(t.totalDurationMs)}`}
            sub={`${t.languageSwitches} switch langue · ${t.interruptions} interruption(s)${t.transferRequested ? " · transfert" : ""}`}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Scénario" subtitle="Chaque scénario est une golden conversation verrouillée en CI.">
            <div className="space-y-3 text-sm">
              <select
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
                disabled={busy || autoplay}
                className="w-full rounded-lg border border-ink-200 px-3 py-2"
              >
                {VOICE_SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              {scenario && (
                <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600">
                  <p>{scenario.description}</p>
                  <p className="mt-1.5 font-medium text-ink-800">Ce scénario prouve : {scenario.proves}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => start(false)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-scaly-600 px-4 py-2 font-semibold text-white hover:bg-scaly-700 disabled:opacity-50"
                >
                  {busy && !session ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
                  Démarrer le scénario
                </button>
                <button
                  onClick={() => start(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                >
                  Mode libre
                </button>
              </div>
              {session && !freeMode && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={nextScenarioTurn}
                    disabled={busy || autoplay || terminal || scenarioDone}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-ink-700 hover:bg-ink-50 disabled:opacity-40"
                  >
                    <StepForward size={14} /> Tour suivant ({Math.min(turnIndex, scenario?.callerTurns.length ?? 0)}/{scenario?.callerTurns.length})
                  </button>
                  <button
                    onClick={() => setAutoplay((a) => !a)}
                    disabled={busy || terminal || scenarioDone}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-ink-700 hover:bg-ink-50 disabled:opacity-40"
                  >
                    {autoplay ? <Pause size={14} /> : <FastForward size={14} />}
                    {autoplay ? "Pause" : "Autoplay"}
                  </button>
                  <button
                    onClick={() => start(false)}
                    disabled={busy}
                    title="Recommencer le scénario"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-ink-600 hover:bg-ink-50 disabled:opacity-40"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              )}
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
              {terminal && (
                <div className="space-y-2 border-t border-ink-100 pt-3">
                  {!saved ? (
                    <button
                      onClick={save}
                      disabled={saving}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      Sauvegarder comme appel
                    </button>
                  ) : (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      Session sauvegardée : appel analysé + {saved.actionsPlanned} action(s) planifiée(s) —{" "}
                      <Link href={`/calls/${saved.callId}`} className="font-semibold underline">voir la fiche d'appel</Link>
                    </p>
                  )}
                  <p className="text-[11px] leading-relaxed text-ink-400">
                    La session passe par le même IntelligenceEngine et le même ActionEngine que tous les appels du produit.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {session && (
            <Card title="Fiche de qualification" subtitle="Extraction progressive — statut, confiance et extrait justificatif par champ.">
              <ul className="space-y-2">
                {session.fields.map((f) => {
                  const b = FIELD_STATUS_BADGE[f.status];
                  return (
                    <li key={f.key} className="rounded-lg border border-ink-100 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink-700">{f.label}</span>
                        <span className="flex items-center gap-1.5">
                          {f.value && <span className="text-ink-400">{Math.round(f.confidence * 100)} %</span>}
                          <Badge tone={b.tone}>{b.label}</Badge>
                        </span>
                      </div>
                      {f.value && <p className="mt-1 font-medium text-ink-900">{f.value}</p>}
                      {f.status === "conflicted" && f.conflictingValue && (
                        <p className="mt-0.5 text-rose-600">vs « {f.conflictingValue} »</p>
                      )}
                      {f.evidence && f.evidence !== f.value && (
                        <p className="mt-0.5 italic text-ink-400">« {f.evidence} »</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-3">
          <Card
            title="Conversation"
            subtitle={session ? `Langue active : ${session.activeLanguage.toUpperCase()} · dominante : ${session.dominantLanguage.toUpperCase()}` : "Démarre un scénario ou le mode libre."}
            action={session?.lastDecision ? <Badge tone="teal">{session.lastDecision.action}</Badge> : undefined}
          >
            {!session && (
              <div className="flex h-64 items-center justify-center text-sm text-ink-400">
                🎙️ Le cerveau conversationnel attend son premier tour…
              </div>
            )}
            {session && (
              <>
                {session.lastDecision && (
                  <p className="mb-3 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600">
                    <span className="font-semibold text-ink-800">Décision :</span> {session.lastDecision.reason}{" "}
                    <span className="text-ink-400">(confiance {Math.round(session.lastDecision.confidence * 100)} %)</span>
                  </p>
                )}
                <ul className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                  {session.turns.map((turn) => (
                    <li key={turn.id} className={clsx("flex", turn.speaker === "agent" ? "justify-start" : "justify-end")}>
                      <div
                        className={clsx(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                          turn.speaker === "agent"
                            ? clsx("rounded-tl-sm bg-scaly-50 text-ink-800 ring-1 ring-scaly-100", turn.interrupted && "opacity-60 ring-amber-300")
                            : "rounded-tr-sm bg-ink-100 text-ink-800",
                        )}
                      >
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                          {turn.speaker === "agent" ? "Maude" : "Appelant"} · {clock(turn.atMs)}
                          {turn.lang === "en" ? " · EN" : ""}
                          {turn.interrupted ? " · COUPÉE" : ""}
                        </p>
                        {turn.text}
                        {turn.latency && (
                          <p className="mt-1 text-[10px] text-ink-400">
                            ~{turn.latency.perceivedMs} ms perçues (STT {turn.latency.sttMs} · cerveau {turn.latency.brainMs} · TTS {turn.latency.ttsMs}){turn.latency.simulated ? " · simulé" : ""}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                  <div ref={transcriptEnd} />
                </ul>
                {!terminal && (
                  <div className="mt-4 space-y-2 border-t border-ink-100 pt-3">
                    <div className="flex gap-2">
                      <input
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !busy) void sendFree(); }}
                        placeholder={freeMode ? "Parle à l'agente (FR ou EN — détection automatique)…" : "Ou improvise un tour hors scénario…"}
                        disabled={busy || autoplay}
                        className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => void sendFree()}
                        disabled={busy || autoplay || !freeText.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-scaly-600 px-3 py-2 text-sm font-semibold text-white hover:bg-scaly-700 disabled:opacity-40"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-ink-500">
                      <input type="checkbox" checked={interrupt} onChange={(e) => setInterrupt(e.target.checked)} />
                      Couper l'agente (barge-in) sur ce tour
                    </label>
                  </div>
                )}
              </>
            )}
          </Card>

          {session && (
            <Card title="Flight recorder" subtitle="Chaque décision, transition, extraction et conflit — l'enregistreur de vol de la session.">
              <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1 text-xs">
                {session.events.map((e, i) => {
                  const line = eventLine(e);
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 w-10 shrink-0 font-mono text-[10px] text-ink-400">{clock(line.at)}</span>
                      <Badge tone={line.tone}>{e.type}</Badge>
                      <span className="leading-relaxed text-ink-600">{line.label}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <HonestyNote>
            P2A — cerveau conversationnel déterministe (NLU à règles, latences simulées et marquées comme telles). Le transport
            audio réel (Twilio / OpenAI Realtime) arrive en P2B : mêmes contrats, vraies latences à la place des simulées.
          </HonestyNote>
        </div>
      </div>
    </div>
  );
}
