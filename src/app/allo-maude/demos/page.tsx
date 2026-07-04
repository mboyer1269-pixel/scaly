/**
 * Démo audio publique — /allo-maude/demos.
 * Page de VENTE, pas une console : une seule démo héro (concessionnaire), une
 * seule action (« Écouter la démo »), le résultat en clair, et une divulgation
 * honnête. Les autres verticales restent secondaires (« à venir »).
 *
 * force-dynamic : la disponibilité audio est lue sur disque à chaque requête,
 * pour que l'audio généré hors ligne apparaisse sans rebuild.
 */
import Link from "next/link";
import { buildPackDemoReport, type PackDemoReport } from "@/services/pack-demo";
import { resolveAudioDemo } from "@/services/pack-demo-audio";
import { PACK_DEMO_SCENARIOS, getPackDemoScenarioById, PUBLIC_DISCLOSURE } from "@/data/pack-demo-scenarios";
import { AudioCallPlayer } from "@/components/AudioCallPlayer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Écoutez Allô Maude répondre à un appel",
  description:
    "Une démo audio simple : entendez comment Allô Maude répond à un appel entrant, comprend le besoin et prépare la bonne action. Simulation représentative.",
};

const HERO_ID = "demo_concessionnaire";
const HERO_MOMENTS = ["Accueil", "Besoin", "Qualification", "Décision", "Transfert"];
const HERO_TURN_TO_MOMENT = [0, 1, 2, 2, 2, 3, 4];

const money = (cad: number) => `${cad.toLocaleString("fr-CA")} $`;

function priorityLabel(urgency: string): string {
  if (urgency === "Critique") return "Urgente";
  if (urgency === "Haute") return "Élevée";
  return "Normale";
}

function heroSummary(report: PackDemoReport) {
  const besoin = report.capturedFields.find((f) => f.label === "Service demandé")?.value ?? "Demande captée";
  const action = report.outcome.transferred
    ? "Transfère l'appel à un conseiller aux ventes"
    : report.outcome.finalActionLabel;
  return [
    { label: "Besoin capté", value: besoin },
    { label: "Priorité détectée", value: priorityLabel(report.urgencyLabel) },
    { label: "Ce qu'Allô Maude fait", value: action },
    { label: "Valeur illustrative d'un tel lead", value: `~ ${money(report.revenue.leadValueCad)}` },
  ];
}

function SecondaryCard({ packLabel }: { packLabel: string }) {
  return (
    <div className="rounded-2xl border border-[#e8e2d7] bg-[#faf8f4] px-5 py-5">
      <p className="text-sm font-bold text-[#1c1a16]">{packLabel}</p>
      <p className="mt-1 text-xs font-semibold text-[#9a9184]">Démo audio à venir</p>
    </div>
  );
}

export default function PackDemosPage() {
  // On ne construit QUE le rapport héro (le seul rendu/serialisé). Les autres
  // verticales n'exposent que leur libellé — aucun transcript secondaire ne fuit
  // dans le payload de la page.
  const heroScenario = getPackDemoScenarioById(HERO_ID) ?? PACK_DEMO_SCENARIOS[0];
  const hero = buildPackDemoReport(heroScenario);
  const others = PACK_DEMO_SCENARIOS.filter((s) => s.id !== hero.scenarioId).map((s) => ({ scenarioId: s.id, packLabel: s.packLabel }));
  const audio = resolveAudioDemo(hero);
  const summary = heroSummary(hero);

  return (
    <div className="min-h-screen bg-[#faf7f1] text-[#1c1a16]">
      <header className="border-b border-[#ece7dd]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/allo-maude" className="flex items-center gap-2.5" aria-label="Allô Maude">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1c1a16] text-xs font-black text-[#ffe56b]">aM</span>
            <span className="text-base font-black">Allô Maude</span>
          </Link>
          <Link href="/pricing" className="text-sm font-semibold text-[#7a7266] hover:text-[#1c1a16]">
            Tarifs
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20">
        {/* Hero minimal */}
        <section className="pt-14 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b7a75]">Démo audio</p>
          <h1 className="mt-3 text-4xl font-black leading-[1.05] sm:text-5xl">Écoutez Allô Maude répondre à un appel</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[#5c554b]">
            Un exemple d'appel entrant, du début à la fin : Allô Maude répond, comprend le besoin du client
            et prépare la bonne action — pendant que vous, vous continuez à travailler.
          </p>
          <p className="mt-4 text-sm text-[#9a9184]">{PUBLIC_DISCLOSURE}</p>
        </section>

        {/* Démo héro centrale */}
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#7a7266]">
            <span className="font-bold text-[#1c1a16]">Concessionnaire automobile</span>
            <span className="text-[#cbc4b6]">·</span>
            <span>Simulation audio</span>
            <span className="text-[#cbc4b6]">·</span>
            <span>Résultat : lead qualifié, transfert recommandé</span>
          </div>

          <AudioCallPlayer
            clips={audio.clips}
            turns={hero.callScript.map((t) => ({ speaker: t.speaker, text: t.text }))}
            agentName={hero.agentName}
            moments={HERO_MOMENTS}
            turnToMoment={HERO_TURN_TO_MOMENT}
            disclosure={hero.disclosureLabel}
            durationEstimateSec={audio.durationEstimateSec}
            hasAudio={audio.status === "available"}
          />

          {/* Résultat business, en clair */}
          <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {summary.map((item) => (
              <div key={item.label} className="border-t border-[#ece7dd] pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9a9184]">{item.label}</p>
                <p className="mt-1 text-base font-bold leading-6 text-[#1c1a16]">{item.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#9a9184]">Valeur illustrative, à ajuster selon votre entreprise.</p>

          {/* Ce qu'Allô Maude prépare pour l'équipe — la fiche tangible du handoff */}
          <div className="mt-8 rounded-2xl border border-[#e8e2d7] bg-white p-5 sm:p-6">
            <p className="text-sm font-black text-[#1c1a16]">Ce qu'Allô Maude prépare pour l'équipe</p>
            <p className="mt-1 text-xs text-[#9a9184]">Fiche remise après l'appel — prête pour le rappel.</p>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {hero.capturedFields.map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-3 border-b border-[#f0ece3] pb-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#9a9184]">{f.label}</dt>
                  <dd className="text-right text-sm font-bold text-[#1c1a16]">{f.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#e8f2f0] px-4 py-3">
              <span className="mt-0.5 text-[#0b7a75]">→</span>
              <p className="text-sm font-semibold leading-6 text-[#0b5f5b]">
                {hero.outcome.transferred
                  ? "Action recommandée : aviser un conseiller aux ventes tout de suite — lead chaud, à ne pas laisser refroidir."
                  : `Action recommandée : ${hero.outcome.finalActionLabel}.`}
              </p>
            </div>
          </div>

          {/* Transcript complet : secondaire, replié */}
          <details className="mt-6 rounded-xl border border-[#ece7dd] bg-white px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[#7a7266] hover:text-[#1c1a16]">
              Voir le script complet
            </summary>
            <ol className="mt-3 space-y-2 border-t border-[#f0ece3] pt-3">
              {hero.callScript.map((turn, i) => (
                <li key={i} className="text-sm leading-6 text-[#3a352d]">
                  <span className="font-bold text-[#1c1a16]">{turn.speaker === "maude" ? hero.agentName : "Client"} : </span>
                  {turn.text}
                </li>
              ))}
            </ol>
          </details>
        </section>

        {/* Autres verticales — secondaires */}
        {others.length > 0 && (
          <section className="mt-14">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a9184]">Autres secteurs</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {others.map((r) => (
                <SecondaryCard key={r.scenarioId} packLabel={r.packLabel} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[#ece7dd] px-5 py-8 text-center text-xs text-[#9a9184]">
        Allô Maude · Québec + Ontario · français et anglais
      </footer>
    </div>
  );
}
