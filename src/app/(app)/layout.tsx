import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-center text-xs text-amber-800">
          Environnement de démonstration : appels simulés, actions mockées, analyse heuristique (rules-v1). Aucun appel téléphonique réel.
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
