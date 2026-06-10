/** Simulateur d'appel — banc d'essai des scripts et des règles avant les appels réels. */
import { PageHeader } from "@/components/ui";
import { SimulatorClient } from "@/components/SimulatorClient";

export const dynamic = "force-dynamic";

export default function SimulatorPage() {
  return (
    <>
      <PageHeader
        title="Simulateur d'appel"
        subtitle="Choisis une industrie et un type d'appelant, lance l'appel, observe la qualification, l'analyse et les actions. Même seed = même conversation (déterministe)."
      />
      <SimulatorClient />
    </>
  );
}
