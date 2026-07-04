/**
 * Voice Gate — /allo-maude/voice-gate.
 * Outil interne d'écoute A/B pour choisir LA voix de Maude. Toutes les candidates
 * disent le MÊME script verrouillé (AutoHorizon / Éric Tremblay / RAV4) : on ne
 * compare que la voix. Ce n'est pas la vitrine de vente — c'est l'atelier.
 *
 * force-dynamic : la disponibilité audio est lue sur disque à chaque requête.
 */
import Link from "next/link";
import { VOICE_GATE_DISCLOSURE, VOICE_GATE_SCRIPT } from "@/data/voice-gate";
import { resolveVoiceGate } from "@/services/voice-gate-audio";
import { VoiceGateClient, type GateCandidateView } from "@/components/VoiceGateClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Voice Gate — sélection de la voix de Maude",
  description: "Écoute A/B des voix candidates sur un même script. Outil interne.",
};

export default function VoiceGatePage() {
  const { resolved } = resolveVoiceGate();
  const candidates: GateCandidateView[] = resolved.map((r) => ({
    id: r.candidate.id,
    label: r.candidate.label,
    providerLabel: r.candidate.providerLabel,
    accent: r.candidate.accent,
    role: r.candidate.role,
    available: r.candidate.available,
    unlockNote: r.candidate.unlockNote,
    verdict: r.candidate.verdict,
    hasAudio: r.hasAudio,
    clips: r.clips,
  }));
  const script = VOICE_GATE_SCRIPT.map((t) => ({ who: t.who, text: t.text }));

  return (
    <div className="min-h-screen bg-[#faf7f1] text-[#1c1a16]">
      <header className="border-b border-[#ece7dd]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/allo-maude" className="flex items-center gap-2.5" aria-label="Allô Maude">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1c1a16] text-xs font-black text-[#ffe56b]">aM</span>
            <span className="text-base font-black">Allô Maude</span>
          </Link>
          <Link href="/allo-maude/demos" className="text-sm font-semibold text-[#7a7266] hover:text-[#1c1a16]">
            Vitrine démo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20">
        <section className="pt-12 sm:pt-14">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b7a75]">Atelier voix</p>
          <h1 className="mt-3 text-3xl font-black leading-[1.1] sm:text-4xl">Choisir la voix de Maude</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#5c554b]">
            Chaque candidate lit exactement le même appel — accueil d'AutoHorizon, un acheteur pour le RAV4 hybride 2024,
            puis la prise du rappel. On ne compare que la voix. Choisis à l'oreille.
          </p>
          <p className="mt-3 text-sm text-[#9a9184]">{VOICE_GATE_DISCLOSURE}</p>
        </section>

        {/* Script comparé, en clair */}
        <section className="mt-8 rounded-2xl border border-[#ece7dd] bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#9a9184]">Script comparé (identique pour toutes)</p>
          <ol className="mt-3 space-y-2">
            {script.map((t, i) => (
              <li key={i} className="text-sm leading-6 text-[#3a352d]">
                <span className="font-bold text-[#1c1a16]">{t.who} : </span>
                {t.text}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <VoiceGateClient candidates={candidates} script={script} />
        </section>
      </main>

      <footer className="border-t border-[#ece7dd] px-5 py-8 text-center text-xs text-[#9a9184]">
        Allô Maude · Atelier interne de sélection de voix
      </footer>
    </div>
  );
}
