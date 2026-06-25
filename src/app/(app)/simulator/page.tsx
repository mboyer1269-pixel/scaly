/** Simulateur d'appel — banc d'essai des scripts et des règles avant les appels réels. */
import { PageHeader } from "@/components/ui";
import { SimulatorClient } from "@/components/SimulatorClient";

export const dynamic = "force-dynamic";

export default function SimulatorPage() {
  return (
    <>
      <PageHeader
        title="Démo intégrée"
        subtitle="Ce scénario utilise les mêmes services, le même repository et les mêmes pages que l'application normale."
      />
      <SimulatorClient />
    </>
  );
}
