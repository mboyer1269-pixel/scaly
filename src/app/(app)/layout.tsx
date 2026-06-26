import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/Sidebar";
import { getStore } from "@/server/store";
import { isAuthEnabled } from "@/server/auth";
import { canExecuteLiveActions } from "@/services/action-execution-policy";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const info = getStore().info();
  const authOn = isAuthEnabled();
  const liveActions = canExecuteLiveActions(info, process.env.ALLOW_LIVE_ACTIONS);
  return (
    <div className="min-h-screen md:flex">
      <Sidebar storeProvider={info.provider} />
      <main className="min-w-0 flex-1">
        <div className="flex items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-center text-xs text-amber-800">
          <span>
            {info.provider === "prisma"
              ? liveActions
                ? "Données persistées en Postgres. Exécution externe activée explicitement; appels du simulateur identifiés comme simulés."
                : "Données persistées en Postgres. Appels simulés et actions simulées; exécution externe désactivée."
              : "Environnement de démonstration : appels simulés, actions simulées et données temporaires. Aucun appel téléphonique réel."}
            {!authOn && " · Auth désactivée (clés Clerk absentes)."}
          </span>
          {authOn && <UserButton afterSignOutUrl="/" />}
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
