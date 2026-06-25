"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Activity,
  Bot,
  LayoutDashboard,
  Lightbulb,
  Phone,
  PlayCircle,
  Rocket,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/calls", label: "Appels", icon: Phone },
  { href: "/follow-up", label: "À suivre", icon: Zap },
  { href: "/prepare", label: "Préparer Maude", icon: Sparkles },
  { href: "/learn", label: "À améliorer", icon: Lightbulb },
  { href: "/settings", label: "Réglages", icon: Settings },
  { href: "/simulator", label: "Démo intégrée", icon: PlayCircle },
  { href: "/readiness/demo", label: "Préparation démo", icon: Rocket },
  { href: "/readiness/live", label: "Appels réels", icon: Phone },
  { href: "/status", label: "Statut technique", icon: Activity },
  { href: "/agent", label: "Voix de Maude", icon: Bot },
];

export function Sidebar({ storeProvider = "memory" }: { storeProvider?: "memory" | "prisma" }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-950 text-ink-100">
      <Link href="/" className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-ink-950">M</span>
        <span className="text-lg font-bold tracking-tight text-white">Allô Maude</span>
      </Link>
      {storeProvider === "prisma" ? (
        <p className="mx-4 mb-3 rounded-md bg-emerald-500/15 px-2 py-1 text-center text-[11px] font-medium text-emerald-300">
          POSTGRES — données persistées
        </p>
      ) : (
        <p className="mx-4 mb-3 rounded-md bg-amber-500/15 px-2 py-1 text-center text-[11px] font-medium text-amber-300">
          DÉMO — données simulées
        </p>
      )}
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-scaly-600/20 font-semibold text-scaly-300" : "text-ink-300 hover:bg-ink-800 hover:text-white",
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-ink-800 px-5 py-4 text-[11px] leading-relaxed text-ink-400">
        Plomberie Bélair (tenant démo)
        <br />
        Moteur technique : Scaly · rules-v1
      </div>
    </aside>
  );
}
