import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Globe2,
  MapPin,
  MessageSquareText,
  PhoneCall,
  PhoneForwarded,
  Radio,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { isAuthEnabled } from "@/server/auth";

const DOMAINS = ["allomaude.ca", "allomaude.com"];

const CALL_SIGNALS = [
  ["Source", "live"],
  ["Tenant", "comp_belair"],
  ["Statut", "transferred"],
  ["Preuve", "verified"],
];

const FLOW = [
  {
    icon: PhoneCall,
    number: "01",
    title: "Répondre",
    text: "Maude capte la demande, l’urgence, les coordonnées et les détails utiles dès le premier échange.",
  },
  {
    icon: PhoneForwarded,
    number: "02",
    title: "Relayer",
    text: "Quand l’humain doit prendre la suite, le repli téléphonique reste direct et tracé.",
  },
  {
    icon: ClipboardCheck,
    number: "03",
    title: "Suivre",
    text: "L’appel devient une fiche, une action ou une correction visible dans l’espace de travail.",
  },
];

const REALITY = [
  ["Neon", "PostgreSQL persistant avec aller-retour live vérifié."],
  ["Clerk", "Authentification requise et tenant session testés."],
  ["Twilio", "Routage par numéro appelé et repli humain vérifié."],
  ["Realtime", "Pont vocal IA préparé, pas encore prouvé en production."],
];

export function AlloMaudeLanding() {
  const authOn = isAuthEnabled();

  return (
    <div className="min-h-screen bg-[#fffaf0] text-[#171410]">
      <header className="border-b border-[#171410]/10 bg-[#fffaf0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/allo-maude" className="flex min-w-0 items-center gap-3" aria-label="Allô Maude">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#171410] text-sm font-black text-[#ffe56b]">
              aM
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-black leading-none">Allô Maude</span>
              <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b5f52]">
                Standard bilingue pour PME
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="hidden rounded-full px-4 py-2 text-sm font-bold text-[#51473d] hover:bg-white/70 sm:inline-flex"
            >
              Tarifs
            </Link>
            {authOn && (
              <>
                <SignedOut>
                  <SignInButton>
                    <button className="hidden rounded-full px-4 py-2 text-sm font-bold text-[#51473d] hover:bg-white/70 sm:inline-flex">
                      Connexion
                    </button>
                  </SignInButton>
                  <SignUpButton>
                    <button className="hidden rounded-full border border-[#171410]/15 bg-white/80 px-4 py-2 text-sm font-black text-[#171410] hover:bg-white sm:inline-flex">
                      Créer un compte
                    </button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </>
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-[#171410] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a241f]"
            >
              Espace de travail <ArrowRight size={15} />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[#171410]/10">
          <div className="absolute inset-x-0 top-0 h-3 bg-[linear-gradient(90deg,#0b7a75_0_26%,#ffe56b_26%_44%,#e85f3b_44%_69%,#7057c8_69%_100%)]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-24 lg:pt-20">
            <div>
              <div className="flex flex-wrap gap-2">
                {DOMAINS.map((domain) => (
                  <span
                    key={domain}
                    className="inline-flex items-center gap-2 rounded-full border border-[#171410]/12 bg-white/70 px-3 py-1.5 text-xs font-black text-[#171410]"
                  >
                    <Globe2 size={13} /> {domain}
                  </span>
                ))}
              </div>

              <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0b7a75] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white">
                <Radio size={14} /> Québec + Ontario · FR/EN · appel réel vérifié
              </p>

              <h1 className="mt-6 max-w-3xl text-6xl font-black leading-[0.9] text-[#171410] sm:text-7xl lg:text-8xl">
                Allô Maude répond en français et en anglais. Vous gardez la main.
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#51473d] sm:text-xl">
                Une réception vocale bilingue pour les PME de services au Québec et en Ontario :
                répondre, qualifier, transférer au besoin et transformer chaque appel en suivi exploitable.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/prepare"
                  className="inline-flex items-center gap-2 rounded-full bg-[#e85f3b] px-6 py-3.5 text-sm font-black text-white shadow-[0_16px_40px_rgba(232,95,59,0.24)] hover:bg-[#cc4e30]"
                >
                  Préparer Maude <ArrowRight size={16} />
                </Link>
                <Link
                  href="/readiness/live"
                  className="inline-flex items-center gap-2 rounded-full border border-[#171410]/15 bg-white/80 px-6 py-3.5 text-sm font-black text-[#171410] hover:bg-white"
                >
                  Voir les preuves live
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-5 top-8 h-[86%] w-3 rounded-full bg-[#ffe56b]" />
              <article className="overflow-hidden rounded-[1.75rem] border border-[#171410]/10 bg-[#171410] text-white shadow-2xl shadow-[#171410]/20">
                <div className="grid gap-px bg-white/10 sm:grid-cols-[1.1fr_0.9fr]">
                  <div className="bg-[#171410] p-6 sm:p-8">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffe56b]">Table d’appel</p>
                    <h2 className="mt-3 text-4xl font-black leading-none">Dégât d’eau critique</h2>
                    <p className="mt-4 text-sm leading-6 text-white/68">
                      L’appelant demande une intervention urgente. Le système route le tenant,
                      trace la source live et déclenche le repli humain.
                    </p>

                    <div className="mt-7 flex h-24 items-end gap-1.5" aria-hidden="true">
                      {[38, 74, 52, 91, 44, 68, 86, 57, 97, 61, 73, 49, 82, 64, 92, 55].map((height, index) => (
                        <span
                          key={index}
                          className="w-full rounded-t-full bg-[#79ded2]"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid bg-[#251f1a]">
                    {CALL_SIGNALS.map(([label, value]) => (
                      <div key={label} className="border-b border-white/10 p-5 last:border-b-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">{label}</p>
                        <p className="mt-1 break-words text-base font-black text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-px bg-white/10 sm:grid-cols-3">
                  <div className="bg-[#fffaf0] p-5 text-[#171410]">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#6b5f52]">
                      <Timer size={12} /> Suite
                    </p>
                    <p className="mt-2 font-black">Transfert humain</p>
                  </div>
                  <div className="bg-[#fffaf0] p-5 text-[#171410]">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#6b5f52]">
                      <MapPin size={12} /> Tenant
                    </p>
                    <p className="mt-2 font-black">Par numéro appelé</p>
                  </div>
                  <div className="bg-[#fffaf0] p-5 text-[#171410]">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#6b5f52]">
                      <Check size={12} /> Readiness
                    </p>
                    <p className="mt-2 font-black">Preuve inscrite</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="border-b border-[#171410]/10 bg-white">
          <div className="mx-auto grid max-w-7xl gap-px bg-[#171410]/10 sm:grid-cols-3">
            {FLOW.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.number} className="bg-white px-6 py-9 sm:px-8">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-4xl font-black text-[#e85f3b]/28">{item.number}</span>
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#0b7a75] text-white">
                      <Icon size={21} />
                    </span>
                  </div>
                  <h2 className="mt-8 text-2xl font-black">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[#5f554b]">{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#7057c8] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white">
              <Sparkles size={14} /> Marque pilote
            </p>
              <h2 className="mt-5 text-4xl font-black leading-[0.98] sm:text-5xl">
              La marque parle Québec et Ontario. Le moteur reste Scaly.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#5f554b]">
              Allô Maude garde un français québécois net, mais l’expérience doit passer à l’anglais
              canadien sans rupture. Les domaines de marque sont attachés au projet Vercel. Tant que les DNS ne sont
              pas configurés chez le registrar, l’URL de production vérifiée reste l’alias Vercel.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              ["allomaude.ca", "Domaine principal Canada", "Attaché à Vercel, DNS requis"],
              ["allomaude.com", "Domaine international", "Attaché à Vercel, DNS requis"],
              ["scaly-sigma.vercel.app", "Production vérifiée", "Disponible maintenant"],
            ].map(([domain, label, status]) => (
              <div key={domain} className="grid gap-4 border border-[#171410]/10 bg-[#fffaf0] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-xl font-black">{domain}</p>
                  <p className="mt-1 text-sm font-semibold text-[#6b5f52]">{label}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#0b7a75]">
                  {status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#0b7a75] text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1fr] lg:items-center lg:py-24">
            <div>
              <ShieldCheck size={34} className="text-[#ffe56b]" />
              <h2 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
                On ne vend pas un statut. On montre une preuve.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/76">
                La page readiness garde séparés la démo, le repli humain vérifié,
                la persistance Neon, Clerk, le bilinguisme FR/EN et le pont IA temps réel encore à valider.
              </p>
              <Link
                href="/readiness/live"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#0b7a75]"
              >
                Lire le readiness live <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid gap-px bg-white/15">
              {REALITY.map(([title, text]) => (
                <div key={title} className="bg-[#0b7a75] px-5 py-5">
                  <p className="font-black text-[#ffe56b]">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/72">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-8 bg-[#ffe56b] p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#665a00]">
                Premier geste utile
              </p>
              <h2 className="mt-3 text-4xl font-black leading-tight text-[#171410]">
                Former Maude avec votre vraie entreprise.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4a4205]">
                Services, zones, promesses interdites, questions essentielles et politique de transfert.
              </p>
            </div>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#171410] px-6 py-3.5 text-sm font-black text-white"
            >
              Former Maude <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#171410]/10 px-5 py-8 text-center text-xs leading-5 text-[#6b5f52] sm:px-8">
        Allô Maude · Québec + Ontario · FR/EN · allomaude.ca · allomaude.com · repli humain live vérifié.
      </footer>
    </div>
  );
}
