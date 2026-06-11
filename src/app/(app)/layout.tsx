import { Sidebar } from "@/components/Sidebar";
import { getStore } from "@/server/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const info = getStore().info();
  return (
    <div className="flex min-h-screen">
      <Sidebar storeProvider={info.provider} />
      <main className="min-w-0 flex-1">
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-center text-xs text-amber-800">
          {info.provider === "prisma"
            ? "Données persistées en Postgres. Appels simulés, actions mockées, analyse heuristique (rules-v1) — aucun appel téléphonique réel (P2)."
            : "Environnement de démonstration : appels simulés, actions mockées, analyse heuristique (rules-v1). Aucun appel téléphonique réel."}
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
