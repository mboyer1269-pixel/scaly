"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  Activity,
  Bot,
  BookOpen,
  Brain,
  CalendarClock,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Phone,
  PlayCircle,
  ShieldCheck,
  Rocket,
  Settings,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/calls", label: "Appels", icon: Phone },
  { href: "/follow-up", label: "À suivre", icon: Zap },
  { href: "/annulations", label: "Annulations", icon: CalendarClock },
  { href: "/prepare", label: "Préparer Maude", icon: Sparkles },
  { href: "/knowledge", label: "Cerveau d'entreprise", icon: Brain },
  { href: "/learn", label: "À améliorer", icon: Lightbulb },
  { href: "/onboarding", label: "Former Maude", icon: BookOpen },
  { href: "/settings", label: "Réglages", icon: Settings },
  { href: "/privacy", label: "Confidentialité", icon: ShieldCheck },
  { href: "/simulator", label: "Démo intégrée", icon: PlayCircle },
  { href: "/readiness/demo", label: "Préparation démo", icon: Rocket },
  { href: "/readiness/live", label: "Appels réels", icon: Phone },
  { href: "/readiness/mobile", label: "Mobile stores", icon: Rocket },
  { href: "/status", label: "Statut technique", icon: Activity },
  { href: "/agent", label: "Voix de Maude", icon: Bot },
];

function NavigationLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return NAV.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
          active ? "bg-scaly-600/20 font-semibold text-scaly-300" : "text-ink-300 hover:bg-ink-800 hover:text-white",
        )}
      >
        <Icon size={16} />
        {label}
      </Link>
    );
  });
}

function StoreLabel({ provider }: { provider: "memory" | "prisma" }) {
  return provider === "prisma" ? (
    <p className="mx-4 mb-3 rounded-md bg-emerald-500/15 px-2 py-1 text-center text-[11px] font-medium text-emerald-300">
      POSTGRES — données persistées
    </p>
  ) : (
    <p className="mx-4 mb-3 rounded-md bg-amber-500/15 px-2 py-1 text-center text-[11px] font-medium text-amber-300">
      DÉMO — données temporaires
    </p>
  );
}

export function Sidebar({ storeProvider = "memory" }: { storeProvider?: "memory" | "prisma" }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      <div className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950 text-ink-100 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex min-h-11 items-center gap-2" onClick={() => setMobileOpen(false)}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-ink-950">M</span>
            <span className="font-bold tracking-tight text-white">Allô Maude</span>
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
            className="min-h-11 min-w-11 rounded-lg border border-ink-700 p-2 text-ink-200"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileOpen && (
          <div id="mobile-navigation" className="border-t border-ink-800 pb-4 pt-3">
            <StoreLabel provider={storeProvider} />
            <nav className="grid gap-1 px-3">
              <NavigationLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </div>
        )}
      </div>

      <aside className="hidden min-h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-950 text-ink-100 md:flex">
        <Link href="/" className="flex min-h-11 items-center gap-2 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-ink-950">M</span>
          <span className="text-lg font-bold tracking-tight text-white">Allô Maude</span>
        </Link>
        <StoreLabel provider={storeProvider} />
        <nav className="flex-1 space-y-0.5 px-3">
          <NavigationLinks pathname={pathname} />
        </nav>
        <div className="border-t border-ink-800 px-5 py-4 text-[11px] leading-relaxed text-ink-400">
          Plomberie Bélair (tenant démo)
        </div>
      </aside>
    </>
  );
}
