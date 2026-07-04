"use client";

/**
 * Lecteur d'écoute — une seule action principale : « Écouter la démo ».
 * Joue les clips dans l'ordre, un tour à la fois, et illumine le moment clé en
 * cours. Volontairement calme : pas de console, pas de mur de texte, pas de
 * métrique technique. Le transcript complet vit ailleurs (accordéon secondaire).
 *
 * Deux états : audio prêt (bouton d'écoute) ou pas encore (état sobre « à venir »).
 * Jamais de bouton brisé. La divulgation reste visible sous le lecteur.
 */
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

export interface AudioCallTurn {
  speaker: "maude" | "caller";
  text: string;
}

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioCallPlayer({
  clips,
  turns,
  agentName,
  moments,
  turnToMoment,
  disclosure,
  durationEstimateSec,
  hasAudio,
}: {
  clips: string[];
  turns: AudioCallTurn[];
  agentName: string;
  moments: string[];
  turnToMoment: number[];
  disclosure: string;
  durationEstimateSec: number;
  hasAudio: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
      }
    };
  }, []);

  const playIndex = (i: number) => {
    const a = audioRef.current;
    if (!a || i >= clips.length) {
      setPlaying(false);
      setIndex(-1);
      return;
    }
    setIndex(i);
    setPlaying(true);
    a.src = clips[i];
    void a.play().catch(() => setPlaying(false));
  };

  const handleEnded = () => {
    clearTimer();
    const next = index + 1;
    if (next >= clips.length) {
      setPlaying(false);
      setIndex(-1);
      return;
    }
    timerRef.current = setTimeout(() => playIndex(next), 300);
  };

  const onToggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      clearTimer();
      setPlaying(false);
    } else if (index < 0) {
      playIndex(0);
    } else {
      void a.play().catch(() => {});
      setPlaying(true);
    }
  };

  const onReplay = () => {
    clearTimer();
    playIndex(0);
  };

  if (!hasAudio) {
    return (
      <div className="rounded-2xl border border-[#e8e2d7] bg-[#faf8f4] px-6 py-8 text-center">
        <p className="text-sm font-semibold text-[#7a7266]">Démo audio à venir</p>
        <p className="mt-1 text-xs text-[#9a9184]">Cet exemple sera disponible sous peu.</p>
      </div>
    );
  }

  const activeMoment = index >= 0 ? turnToMoment[index] ?? -1 : -1;
  const current = index >= 0 ? turns[index] : undefined;

  return (
    <div className="rounded-2xl border border-[#e8e2d7] bg-white p-6 shadow-[0_1px_2px_rgba(28,26,22,0.04)] sm:p-7">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? "Mettre en pause" : "Écouter la démo"}
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#0b7a75] text-white transition hover:bg-[#0a6a66] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0b7a75]/20"
        >
          {playing ? <Pause size={26} /> : <Play size={26} className="ml-0.5" />}
        </button>
        <div className="min-w-0">
          <p className="text-base font-bold text-[#1c1a16]">{playing || index >= 0 ? "Démo en cours…" : "Écouter la démo"}</p>
          <p className="mt-0.5 text-sm text-[#7a7266]">Simulation audio · environ {mmss(durationEstimateSec)}</p>
        </div>
      </div>

      {/* Frise des moments clés — s'illumine pendant l'écoute */}
      <ol className="mt-6 flex flex-wrap gap-2">
        {moments.map((label, i) => {
          const state = i === activeMoment ? "active" : activeMoment > i ? "past" : "todo";
          return (
            <li
              key={label}
              className={
                state === "active"
                  ? "rounded-full bg-[#0b7a75] px-3 py-1 text-xs font-bold text-white"
                  : state === "past"
                    ? "rounded-full bg-[#e8f2f0] px-3 py-1 text-xs font-bold text-[#0b7a75]"
                    : "rounded-full bg-[#f4f1ea] px-3 py-1 text-xs font-semibold text-[#9a9184]"
              }
            >
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>

      {/* Légende sobre du passage en cours */}
      <div className="mt-4 min-h-[3.25rem] rounded-xl bg-[#faf8f4] px-4 py-3">
        {current ? (
          <p className="text-sm leading-6 text-[#3a352d]">
            <span className="font-bold text-[#1c1a16]">{current.speaker === "maude" ? agentName : "Client"} : </span>
            {current.text}
          </p>
        ) : (
          <p className="text-sm leading-6 text-[#9a9184]">Appuyez sur lecture pour entendre l'appel, du début à la fin.</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7a7266] hover:text-[#1c1a16]"
        >
          <RotateCcw size={14} /> Réécouter
        </button>
        <p className="text-right text-xs text-[#9a9184]">{disclosure}</p>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} onEnded={handleEnded} preload="none" hidden />
    </div>
  );
}
