"use client";

/**
 * Écoute A/B du Voice Gate — outil interne de sélection de voix.
 * Chaque candidate a un bouton « Écouter » qui joue ses 3 clips dans l'ordre
 * (Maude → Éric → Maude). Une seule candidate joue à la fois. Volontairement
 * simple : pas de vitrine, pas de jargon — juste comparer des voix vite.
 */
import { useEffect, useRef, useState } from "react";
import { Lock, Pause, Play } from "lucide-react";

export interface GateCandidateView {
  id: string;
  label: string;
  providerLabel: string;
  accent: string;
  role: "vitrine" | "live" | "baseline";
  available: boolean;
  unlockNote?: string;
  verdict: string;
  hasAudio: boolean;
  clips: string[];
}

const ROLE_LABEL: Record<GateCandidateView["role"], string> = {
  vitrine: "Vitrine (qualité)",
  live: "Live (faible latence)",
  baseline: "Baseline",
};

export function VoiceGateClient({ candidates, script }: { candidates: GateCandidateView[]; script: { who: string; text: string }[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clipIndex, setClipIndex] = useState(-1);

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
      }
    };
  }, []);

  const stop = () => {
    const a = audioRef.current;
    if (a) a.pause();
    setActiveId(null);
    setClipIndex(-1);
  };

  const playCandidate = (c: GateCandidateView) => {
    const a = audioRef.current;
    if (!a || !c.hasAudio || c.clips.length === 0) return;
    setActiveId(c.id);
    setClipIndex(0);
    a.src = c.clips[0];
    void a.play().catch(() => stop());
  };

  const onEnded = () => {
    const c = candidates.find((x) => x.id === activeId);
    const a = audioRef.current;
    if (!c || !a) return stop();
    const next = clipIndex + 1;
    if (next >= c.clips.length) return stop();
    setClipIndex(next);
    a.src = c.clips[next];
    void a.play().catch(() => stop());
  };

  const ready = candidates.filter((c) => c.available);
  const locked = candidates.filter((c) => !c.available);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b7a75]">Disponibles maintenant</h2>
        <div className="mt-3 space-y-3">
          {ready.map((c) => {
            const isActive = activeId === c.id;
            const spoken = isActive && clipIndex >= 0 ? script[clipIndex] : undefined;
            return (
              <div key={c.id} className="rounded-2xl border border-[#e8e2d7] bg-white p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => (isActive ? stop() : playCandidate(c))}
                    disabled={!c.hasAudio}
                    aria-label={isActive ? "Arrêter" : `Écouter ${c.label}`}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#0b7a75] text-white transition hover:bg-[#0a6a66] disabled:cursor-not-allowed disabled:bg-[#cbc4b6]"
                  >
                    {isActive ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-base font-bold text-[#1c1a16]">{c.label}</p>
                      <span className="text-xs font-semibold text-[#9a9184]">{ROLE_LABEL[c.role]}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-[#7a7266]">{c.providerLabel}</p>
                    <p className="text-xs text-[#9a9184]">Accent : {c.accent}</p>
                  </div>
                </div>
                {spoken && (
                  <p className="mt-3 rounded-lg bg-[#faf8f4] px-3 py-2 text-sm leading-6 text-[#3a352d]">
                    <span className="font-bold text-[#1c1a16]">{spoken.who} : </span>
                    {spoken.text}
                  </p>
                )}
                <p className="mt-3 border-t border-[#f0ece3] pt-3 text-sm leading-6 text-[#5c554b]">{c.verdict}</p>
                {!c.hasAudio && <p className="mt-1 text-xs font-semibold text-[#b4593a]">Audio non généré — lance « npm run voice:gate ».</p>}
              </div>
            );
          })}
        </div>
      </section>

      {locked.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a9184]">Voix québécoises — à débloquer</h2>
          <div className="mt-3 space-y-3">
            {locked.map((c) => (
              <div key={c.id} className="rounded-2xl border border-dashed border-[#e0d9cc] bg-[#faf8f4] p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#efe9dd] text-[#9a9184]">
                    <Lock size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-base font-bold text-[#1c1a16]">{c.label}</p>
                      <span className="rounded-full bg-[#0b7a75]/10 px-2 py-0.5 text-xs font-bold text-[#0b7a75]">Québécois réel</span>
                    </div>
                    <p className="mt-0.5 text-sm text-[#7a7266]">{c.providerLabel}</p>
                  </div>
                </div>
                <p className="mt-3 border-t border-[#efe9dd] pt-3 text-sm leading-6 text-[#5c554b]">{c.verdict}</p>
                {c.unlockNote && <p className="mt-1 text-xs font-semibold text-[#7a7266]">{c.unlockNote}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} onEnded={onEnded} preload="none" hidden />
    </div>
  );
}
