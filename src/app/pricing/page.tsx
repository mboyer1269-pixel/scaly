/**
 * Page de prix publique (P4) — pricing honnête : prix publiés, factures sans
 * surprise. Chaque irritant de facturation documenté chez les concurrents
 * (docs/MARKET.md, docs/STRATEGY.md) devient un engagement affiché.
 */
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ADD_ONS } from "@/domain/billing";
import { PricingPlans } from "@/components/PricingPlans";

export const metadata = { title: "Prix — Allô Maude" };

const ENGAGEMENTS = [
  {
    t: "Le spam n'est jamais facturé",
    d: "Un appel refusé comme indésirable par l'agente ne compte pas dans vos minutes. Vous payez pour des conversations, pas pour du bruit.",
  },
  {
    t: "Les transferts vers un humain sont inclus",
    d: "Quand l'agente vous passe un appel, ça ne coûte rien de plus. Le transfert est une fonctionnalité, pas un compteur.",
  },
  {
    t: "Arrondi sur le mois, pas par appel",
    d: "Les minutes s'additionnent à la seconde sur tout le mois, arrondies une seule fois au total — pas d'arrondi à la demi-minute appel par appel.",
  },
  {
    t: "Dépassement au tarif publié, jamais surprise",
    d: "Le prix de la minute excédentaire est affiché ici, et le tableau de bord montre votre consommation et la valeur protégée chaque mois.",
  },
  {
    t: "Mensuel fixe, frais d'installation affichés",
    d: "Pas de « contactez-nous pour un prix » : tout est public. Ce qui n'est pas sur cette page n'existe pas.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-ink-950">M</span>
          <span className="text-lg font-bold">Allô Maude</span>
        </Link>
        <Link href="/dashboard" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20">
          Ouvrir le dashboard démo
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-black leading-tight">Des prix publiés. Des factures sans surprise.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-300">
          Mensuel fixe en dollars canadiens, minutes incluses, dépassement au tarif affiché. Si un appel sauvé vaut des centaines de dollars, le calcul se fait tout seul.
        </p>
        <p className="mt-4 text-xs text-ink-500">Tarifs de lancement pilote, hors taxes. Annulable en tout temps depuis le portail client.</p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <PricingPlans />
      </section>

      <section className="border-t border-ink-800 bg-ink-900/50">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="mx-auto mb-8 max-w-xl text-center">
            <ShieldCheck className="mx-auto mb-3 text-scaly-400" size={26} />
            <h2 className="text-2xl font-bold">Nos engagements de facturation</h2>
            <p className="mt-2 text-sm text-ink-400">
              Chaque ligne ci-dessous répond à un irritant documenté chez d'autres services de réception d'appels.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
            {ENGAGEMENTS.map((e) => (
              <div key={e.t} className="rounded-xl border border-ink-800 bg-ink-900 p-5">
                <h3 className="font-semibold text-white">{e.t}</h3>
                <p className="mt-2 text-sm text-ink-400">{e.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-center text-2xl font-bold">Options</h2>
        <div className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {ADD_ONS.map((a) => (
            <div key={a.id} className="rounded-xl border border-ink-800 bg-ink-900 p-5 text-center">
              <h3 className="text-sm font-semibold text-white">{a.label}</h3>
              <p className="mt-1 text-lg font-black text-scaly-400">{a.priceMonthlyCad} $ / mois</p>
              <p className="mt-1 text-xs text-ink-400">{a.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink-800 px-6 py-8 text-center text-xs text-ink-500">
        Allô Maude — prix publics en dollars canadiens. Les intégrations non configurées restent identifiées.
      </footer>
    </div>
  );
}
