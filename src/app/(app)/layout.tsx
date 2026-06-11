import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/Sidebar";
import { getStore } from "@/server/store";
import { isAuthEnabled } from "@/server/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const info = getStore().info();
  const authOn = isAuthEnabled();
  return (
    <div className="flex min-h-screen">
      <Sidebar storeProvider={info.provider} />
      <main className="min-w-0 flex-1">
        <div className="flex items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-center text-xs text-amber-800">
          <span>
            {info.provider === "prisma"
              ? "Données persistées en Postgres. Appels simulés, actions mockées — aucun appel téléphonique réel (P2)."
              : "Environnement de démonstration : appels simulés, actions mockées. Aucun appel téléphonique réel."}
            {!authOn && " · Auth désactivée (clés Clerk absentes)."}
          </span>
          {authOn && <UserButton afterSignOutUrl="/" />}
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
