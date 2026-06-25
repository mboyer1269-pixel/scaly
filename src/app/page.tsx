/** Site public — positionnement, promesse, preuve, CTA. Contenu honnête : démo simulée. */
import Link from "next/link";
import { ArrowRight, CalendarCheck, PhoneCall, Sparkles, TrendingUp } from "lucide-react";
import { INDUSTRY_LABELS } from "@/domain/company";

const STEPS = [
  { n: "1", t: "Maude répond", d: "Chaque appel entrant est pris en charge en français québécois ou en anglais, 24/7, avec la personnalité de votre entreprise." },
  { n: "2", t: "Maude qualifie", d: "Intention, urgence, informations essentielles, valeur potentielle : tout est capté selon le script de votre industrie." },
  { n: "3", t: "Maude prépare la suite", d: "Tâches, demandes de rendez-vous, SMS et alertes sont créés avec une preuve inspectable." },
  { n: "4", t: "Vous décidez", d: "La vue d'ensemble montre les appels sauvés, les opportunités chaudes et la valeur que Maude a protégée." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-ink-950">M</span>
          <span className="text-lg font-bold">Allô Maude</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pricing" className="rounded-lg px-4 py-2 text-sm font-medium text-ink-200 hover:bg-white/10">
            Prix
          </Link>
          <Link href="/dashboard" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20">
            Ouvrir le dashboard démo
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center">
        <p className="mx-auto mb-5 w-fit rounded-full border border-scaly-500/40 bg-scaly-500/10 px-4 py-1 text-xs font-medium text-scaly-300">
          Réceptionniste vocale IA — PME francophones et bilingues
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
          Un appel manqué, c'est un client qui appelle ton concurrent.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-300">
          Allô Maude répond à chaque appel, qualifie la demande, prend les informations, prépare les suivis
          et te montre combien d'argent vient d'être sauvé. En français québécois comme en anglais.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/simulator" className="inline-flex items-center gap-2 rounded-lg bg-scaly-500 px-5 py-3 text-sm font-semibold text-white hover:bg-scaly-600">
            Essayer le simulateur d'appel <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-ink-700 px-5 py-3 text-sm font-semibold text-ink-200 hover:bg-ink-900">
            Voir le cockpit en action
          </Link>
        </div>
        <p className="mt-6 text-xs text-ink-500">
          Démo transparente : conversations simulées, moteur d'analyse heuristique, aucun appel téléphonique réel à ce stade.
        </p>
      </section>

      <section className="border-t border-ink-800 bg-ink-900/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 sm:grid-cols-3">
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
            <PhoneCall className="mb-3 text-scaly-400" size={22} />
            <h3 className="font-semibold">Zéro appel perdu</h3>
            <p className="mt-2 text-sm text-ink-400">Réponse 24/7, rappel SMS automatique des appels manqués, escalade immédiate des urgences vers un humain.</p>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
            <Sparkles className="mb-3 text-scaly-400" size={22} />
            <h3 className="font-semibold">Chaque appel devient une donnée</h3>
            <p className="mt-2 text-sm text-ink-400">Transcript, résumé, intention, urgence, qualité du lead, valeur estimée, prochaine action — automatiquement.</p>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
            <TrendingUp className="mb-3 text-scaly-400" size={22} />
            <h3 className="font-semibold">La valeur, en dollars</h3>
            <p className="mt-2 text-sm text-ink-400">Appels sauvés hors heures, opportunités chaudes, pertes évitées : le cockpit parle le langage du propriétaire.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold">Comment ça marche</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-ink-800 bg-ink-900 p-5">
              <span className="text-2xl font-black text-scaly-500">{s.n}</span>
              <h3 className="mt-2 font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-ink-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-ink-800 bg-ink-900/50">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-center text-2xl font-bold">Des scripts spécialisés par industrie</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-ink-400">
            Niche initiale : les services à domicile et la construction au Québec — là où chaque appel manqué coûte le plus cher.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {Object.values(INDUSTRY_LABELS).map((label) => (
              <span key={label} className="rounded-full border border-ink-700 px-3 py-1.5 text-xs text-ink-300">{label}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <CalendarCheck className="mx-auto mb-4 text-scaly-400" size={28} />
        <h2 className="text-2xl font-bold">Voir Maude traiter un appel de bout en bout ?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-400">
          Lance une simulation avec le script de ton industrie et un type d'appelant réaliste — urgence, magasineur, client frustré — et regarde le pipeline se remplir.
        </p>
        <Link href="/simulator" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-scaly-500 px-6 py-3 text-sm font-semibold hover:bg-scaly-600">
          Demander une démo (simulateur) <ArrowRight size={16} />
        </Link>
      </section>

      <section className="border-t border-ink-800 bg-ink-900/50">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-ink-300">
          <span className="font-semibold text-white">Conforme par conception.</span>{" "}
          Loi 25 : consentements captés verbatim, registre consultable, retrait par simple « STOP », purge automatique des transcriptions.{" "}
          Loi 96 : le français d'abord, l'anglais en option — votre réceptionniste ne vous expose jamais à une plainte linguistique.
        </div>
      </section>

      <footer className="border-t border-ink-800 px-6 py-8 text-center text-xs text-ink-500">
        Allô Maude — démonstration contrôlée. Chaque simulation, dépendance absente et intégration non vérifiée est identifiée.
      </footer>
    </div>
  );
}
