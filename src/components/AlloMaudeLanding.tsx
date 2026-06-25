import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Droplets,
  MapPin,
  MessageSquareText,
  PhoneForwarded,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const FLOW = [
  {
    icon: MessageSquareText,
    number: "01",
    title: "Maude comprend",
    text: "La demande, l’urgence et les coordonnées utiles sont structurées dans une fiche d’appel.",
  },
  {
    icon: PhoneForwarded,
    number: "02",
    title: "La bonne suite est créée",
    text: "Transfert humain, rappel, tâche urgente ou suivi : l’appel ne se termine pas dans un transcript oublié.",
  },
  {
    icon: ClipboardCheck,
    number: "03",
    title: "Vous gardez le contrôle",
    text: "Chaque incertitude devient un élément à corriger, avec sa provenance et son statut réel.",
  },
];

const REALITY = [
  ["Simulé", "Le scénario a été exécuté dans le vrai workflow applicatif."],
  ["Configuré, non vérifié", "La fonction est prête dans l’application, sans preuve d’appel externe."],
  ["Vérifié", "Une preuve inspectable confirme l’exécution."],
  ["Indisponible", "La dépendance requise n’est pas branchée ou validée."],
];

export function AlloMaudeLanding() {
  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#17211f]">
      <header className="border-b border-[#17211f]/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/allo-maude" className="flex items-center gap-3" aria-label="Allô Maude">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#0a6159] text-sm font-black text-white">
              AM
            </span>
            <span>
              <span className="block text-lg font-black leading-none tracking-tight">Allô Maude</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#51615d]">
                Réception qui agit
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/pricing" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[#40504c] hover:bg-white/70 sm:inline-flex">
              Tarifs
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[#17211f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#27332f]">
              Ouvrir l’espace de travail <ArrowRight size={15} />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(#0a6159_0.75px,transparent_0.75px)] [background-size:22px_22px]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28 lg:pt-24">
            <div>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0a6159]/20 bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#0a6159]">
                <Sparkles size={14} /> Pour les PME d’ici qui ne peuvent pas laisser sonner
              </p>
              <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.05em] text-[#17211f] sm:text-6xl lg:text-7xl">
                Chaque appel mérite une vraie suite.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#40504c] sm:text-xl">
                Allô Maude transforme une demande téléphonique en dossier clair : urgence détectée,
                coordonnées capturées, transfert demandé, action créée et correction signalée au besoin.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/prepare" className="inline-flex items-center gap-2 rounded-full bg-[#d55a2a] px-6 py-3.5 text-sm font-black text-white shadow-[0_10px_30px_rgba(213,90,42,0.22)] hover:bg-[#bd4b21]">
                  Préparer mon entreprise <ArrowRight size={16} />
                </Link>
                <Link href="/simulator" className="inline-flex items-center gap-2 rounded-full border border-[#17211f]/20 bg-white/70 px-6 py-3.5 text-sm font-bold text-[#17211f] hover:bg-white">
                  Voir la démo intégrée
                </Link>
              </div>
              <p className="mt-4 max-w-xl text-xs leading-5 text-[#66736f]">
                La démo utilise une conversation simulée, mais persiste son appel, ses actions,
                ses révisions et son audit dans les mêmes services que le reste de l’application.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -inset-5 rotate-2 rounded-[2rem] bg-[#0a6159]" />
              <article className="relative overflow-hidden rounded-[1.75rem] border border-[#17211f]/10 bg-[#fffdf8] shadow-2xl shadow-[#17211f]/15">
                <header className="flex items-start justify-between gap-4 border-b border-[#17211f]/10 px-6 py-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#66736f]">Appel démontré</p>
                    <h2 className="mt-1 text-xl font-black">Dégât d’eau critique</h2>
                  </div>
                  <span className="rounded-full bg-[#efe2ff] px-3 py-1 text-xs font-bold text-[#7135a5]">
                    Simulé
                  </span>
                </header>
                <div className="space-y-5 p-6">
                  <div className="flex gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#dcefeb] text-[#0a6159]">
                      <Droplets size={21} />
                    </span>
                    <div>
                      <p className="font-bold">Urgence critique détectée</p>
                      <p className="mt-1 text-sm leading-6 text-[#596762]">
                        Fuite active au sous-sol. L’appelant demande de parler à un humain.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#f0ede5] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#66736f]">Téléphone</p>
                      <p className="mt-1 font-bold">514 555-0198</p>
                    </div>
                    <div className="rounded-2xl bg-[#f0ede5] p-4">
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#66736f]">
                        <MapPin size={11} /> Adresse
                      </p>
                      <p className="mt-1 font-bold">1420, rue Bélanger</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#d55a2a]/20 bg-[#fff2eb] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#a9411a]">Suite créée</p>
                    <ul className="mt-3 space-y-2 text-sm font-semibold">
                      <li className="flex items-center gap-2"><Check size={15} className="text-[#0a6159]" /> Transfert humain demandé</li>
                      <li className="flex items-center gap-2"><Check size={15} className="text-[#0a6159]" /> Action urgente ajoutée à À suivre</li>
                      <li className="flex items-center gap-2"><Check size={15} className="text-[#0a6159]" /> Incertitude ajoutée à À améliorer</li>
                    </ul>
                  </div>
                  <Link href="/simulator" className="flex items-center justify-between rounded-2xl bg-[#17211f] px-5 py-4 text-sm font-bold text-white">
                    Exécuter ce flow dans l’application <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="border-y border-[#17211f]/10 bg-[#17211f] text-white">
          <div className="mx-auto grid max-w-7xl gap-px bg-white/10 sm:grid-cols-3">
            {[
              ["Même repository", "Les modules et la démo relisent les mêmes dossiers."],
              ["Provenance visible", "Chaque résultat indique ce qui est simulé ou vérifié."],
              ["Aucune impasse", "Un appel produit une action ou un chemin de correction."],
            ].map(([title, text]) => (
              <div key={title} className="bg-[#17211f] px-6 py-8 sm:px-8">
                <p className="text-sm font-black text-[#79d7ca]">{title}</p>
                <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d55a2a]">Du téléphone au travail fait</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Pas un joli transcript. Un résultat exploitable.
              </h2>
              <p className="mt-5 text-base leading-7 text-[#596762]">
                Le propriétaire voit ce qui s’est passé, ce qui doit être fait et ce que Maude n’a pas pu confirmer.
              </p>
            </div>
            <div className="grid gap-4">
              {FLOW.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.number} className="grid gap-4 rounded-3xl border border-[#17211f]/10 bg-white/65 p-5 sm:grid-cols-[4rem_3rem_1fr] sm:items-start sm:p-6">
                    <span className="text-3xl font-black text-[#0a6159]/30">{item.number}</span>
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#dcefeb] text-[#0a6159]">
                      <Icon size={20} />
                    </span>
                    <div>
                      <h3 className="text-lg font-black">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#596762]">{item.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#0a6159] text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <ShieldCheck size={32} className="text-[#9de2d8]" />
              <h2 className="mt-5 text-4xl font-black tracking-[-0.04em]">Les statuts disent la vérité.</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/75">
                Allô Maude ne transforme pas une configuration en preuve. La mise en service téléphonique
                conserve son propre contrôle de préparation, séparé de la démo.
              </p>
              <Link href="/readiness/live" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#0a6159]">
                Voir la préparation aux appels réels <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid gap-3">
              {REALITY.map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
                  <p className="font-black">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/70">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="rounded-[2rem] bg-[#e8b948] px-6 py-12 text-center sm:px-12 sm:py-16">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#59400b]">Commencer par le concret</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-[-0.04em] text-[#17211f] sm:text-5xl">
              Préparez Maude, testez un appel, inspectez chaque preuve.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/prepare" className="inline-flex items-center gap-2 rounded-full bg-[#17211f] px-6 py-3.5 text-sm font-black text-white">
                Préparer Maude <ArrowRight size={16} />
              </Link>
              <Link href="/readiness/demo" className="inline-flex items-center gap-2 rounded-full border border-[#17211f]/20 bg-white/60 px-6 py-3.5 text-sm font-black text-[#17211f]">
                Vérifier la préparation démo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#17211f]/10 px-5 py-8 text-center text-xs leading-5 text-[#66736f] sm:px-8">
        Allô Maude — application en préparation de pilote. La démo est simulée; les appels téléphoniques réels restent indisponibles tant que leurs dépendances ne sont pas vérifiées.
      </footer>
    </div>
  );
}
