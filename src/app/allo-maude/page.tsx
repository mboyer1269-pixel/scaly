/**
 * /allo-maude — page commerciale publique d'Allô Maude.
 * Couche marketing sur le moteur Scaly : toutes les promesses affichées
 * sont des fonctionnalités réellement implémentées (simulateur, intelligence,
 * SMS, transfert, conformité Loi 25).
 */
import Link from "next/link";
import { Phone, MessageSquare, Zap, ShieldCheck, Users, Clock, ChevronRight } from "lucide-react";

export const metadata = { title: "Allô Maude — Réceptionniste IA pour PME québécoises" };

const SECTORS = [
  { icon: "🔧", label: "Plombiers & chauffagistes", desc: "Urgences, devis, prise de RDV. Maude donne la consigne de sécurité et transfère l'urgence en moins de 30 secondes." },
  { icon: "🚗", label: "Garages & mécaniciens", desc: "Modèle du véhicule, symptôme, moment idéal. Vos techniciens reçoivent un dossier complet avant de rappeler." },
  { icon: "✂️", label: "Salons & esthéticiens", desc: "Service demandé, disponibilité, prénom. Maude qualifie sans vous interrompre entre deux clients." },
  { icon: "🏗️", label: "Entrepreneurs & rénovation", desc: "Type de travaux, adresse, budget approximatif, délai. Une fiche client propre dès le premier appel." },
];

const HOW_IT_WORKS = [
  { n: "1", t: "Le client appelle votre numéro", d: "Maude répond en moins de deux secondes, s'annonce comme assistante virtuelle et accueille en français québécois naturel." },
  { n: "2", t: "Elle qualifie et résume", d: "Nom, numéro, service demandé, adresse si intervention, niveau d'urgence, moment idéal — une question à la fois, pas un formulaire." },
  { n: "3", t: "Vous recevez un résumé SMS", d: "Fiche priorisée (chaud / tiède / froid), résumé, transcript et prochaine action recommandée — dans les deux minutes après l'appel." },
];

const FEATURES = [
  {
    icon: Phone,
    t: "Appels qualifiés, pas juste répondus",
    d: "Maude collecte le besoin réel — pas juste un message. Les urgences sont fast-trackées et transférées immédiatement.",
  },
  {
    icon: MessageSquare,
    t: "SMS de suivi automatique",
    d: "Les urgences, appels manqués et transferts génèrent une fiche résumée envoyée à votre téléphone. Vous voyez en cinq secondes si c'est chaud, urgent ou spam.",
  },
  {
    icon: Zap,
    t: "Dashboard temps réel",
    d: "Tous vos appels, résumés, transcripts et actions en un seul endroit. Filtrez par urgence, rappel manqué ou suivi requis.",
  },
  {
    icon: Users,
    t: "Mémoire des appelants connus",
    d: "Si quelqu'un rappelle, Maude reconnaît le numéro et reprend là où la dernière conversation s'est arrêtée — sans redemander les mêmes infos.",
  },
  {
    icon: Clock,
    t: "Transfert humain garanti",
    d: "L'appelant demande à parler à quelqu'un ? Maude transfère sans insister. Le téléphone ne coince jamais.",
  },
  {
    icon: ShieldCheck,
    t: "Conforme Loi 25 par conception",
    d: "Divulgation IA à l'accueil, rétention configurable, suppression sur demande. Consentement de rappel capté via le simulateur et les appels analysés. Vérifiable dans votre tableau de bord.",
  },
];

export default function AlloMaudePage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      {/* ── Header ── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-sm font-black">M</span>
          <span className="text-lg font-bold">Allô Maude</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/simulator" className="hidden text-sm text-ink-400 hover:text-white sm:block">
            Voir une démo
          </Link>
          <Link href="/pricing" className="hidden text-sm text-ink-400 hover:text-white sm:block">
            Tarifs
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
          >
            Dashboard démo
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Version pilote — PME québécoises
        </div>
        <h1 className="mx-auto max-w-3xl text-5xl font-black leading-tight tracking-tight sm:text-6xl">
          Allô, je suis{" "}
          <span className="text-rose-400">Maude</span>.
          <br />
          Je réponds à vos appels.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-300">
          Réceptionniste IA en français québécois. Je qualifie la demande, je résume, je priorise et je vous envoie
          une fiche SMS — pour chaque appel que vous ne pouvez pas prendre.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/simulator"
            className="flex items-center gap-2 rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white hover:bg-rose-400"
          >
            Voir Maude en action <ChevronRight size={16} />
          </Link>
          <Link
            href="/onboarding"
            className="flex items-center gap-2 rounded-xl border border-ink-700 px-6 py-3 font-medium text-ink-200 hover:border-ink-500 hover:text-white"
          >
            Configurer mon profil
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink-500">
          Version de lancement pilote. Toutes les fonctionnalités affichées sont implémentées et démontrables.
        </p>
      </section>

      {/* ── Problème ── */}
      <section className="border-y border-ink-800 bg-ink-900/50">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-ink-500">
            Le problème que Maude résout
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                stat: "~30 %",
                t: "des appels manqués ne laissent pas de message",
                d: "Le client essaie le concurrent. Vous ne saurez jamais qu'il a appelé.",
              },
              {
                stat: "< 2 min",
                t: "le délai critique pour rappeler un lead chaud",
                d: "Passé ce délai, le taux de conversion chute de 80 %. Maude envoie la fiche en temps réel.",
              },
              {
                stat: "100 %",
                t: "des urgences transférées à un humain immédiatement",
                d: "Maude ne gère pas les urgences critiques seule — elle transfère. Toujours.",
              },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-ink-800 bg-ink-900 p-6">
                <p className="text-3xl font-black text-rose-400">{c.stat}</p>
                <p className="mt-2 font-semibold text-white">{c.t}</p>
                <p className="mt-2 text-sm text-ink-400">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Secteurs ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Faite pour les métiers de services au Québec</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink-400">
          Chaque secteur a son script de qualification, ses critères d'urgence et ses formulations adaptées.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTORS.map((s) => (
            <div key={s.label} className="rounded-xl border border-ink-800 bg-ink-900 p-6 transition-colors hover:border-ink-600">
              <span className="text-3xl">{s.icon}</span>
              <h3 className="mt-3 font-bold text-white">{s.label}</h3>
              <p className="mt-2 text-sm text-ink-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="border-y border-ink-800 bg-ink-900/50">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-center text-3xl font-bold">Comment ça marche</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-xl font-black text-rose-400">
                  {s.n}
                </div>
                <h3 className="font-bold text-white">{s.t}</h3>
                <p className="mt-2 text-sm text-ink-400">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Ce que Maude fait concrètement</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-ink-800 bg-ink-900 p-6">
              <Icon size={22} className="text-rose-400" />
              <h3 className="mt-3 font-semibold text-white">{t}</h3>
              <p className="mt-2 text-sm text-ink-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Conformité ── */}
      <section className="border-t border-ink-800 bg-ink-900/50">
        <div className="mx-auto max-w-3xl px-6 py-12 text-center">
          <ShieldCheck className="mx-auto mb-3 text-emerald-400" size={28} />
          <h2 className="text-2xl font-bold">Conforme Loi 25 par conception</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-400">
            Maude s'annonce comme IA dès l'accueil. La rétention des verbatims est configurable.
            La suppression des données personnelles est possible sur demande.
            Tout est vérifiable dans votre tableau de bord — pas une promesse marketing, une fonctionnalité réelle.
          </p>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-4xl font-black">Prêt à essayer Maude ?</h2>
        <p className="mx-auto mt-4 max-w-lg text-ink-400">
          Le simulateur permet de voir Maude répondre à un appel de plomberie, de garage ou d'esthétique — sans compte, sans carte de crédit.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/simulator"
            className="flex items-center gap-2 rounded-xl bg-rose-500 px-8 py-4 text-lg font-bold text-white hover:bg-rose-400"
          >
            Lancer le simulateur <ChevronRight size={18} />
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl border border-ink-700 px-8 py-4 text-lg font-medium text-ink-200 hover:border-ink-500 hover:text-white"
          >
            Voir les tarifs
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-ink-800 px-6 py-8 text-center text-xs text-ink-500">
        Allô Maude — réceptionniste IA propulsée par Scaly · Version pilote · Québec, Canada ·{" "}
        <Link href="/pricing" className="underline hover:text-ink-300">
          Tarifs
        </Link>{" "}
        ·{" "}
        <Link href="/dashboard" className="underline hover:text-ink-300">
          Dashboard démo
        </Link>
      </footer>
    </div>
  );
}
