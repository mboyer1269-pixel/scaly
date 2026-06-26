/** Simulateur d'appel — banc d'essai des scripts et des règles avant les appels réels. */
import { PageHeader } from "@/components/ui";
import { SimulatorClient } from "@/components/SimulatorClient";
import { getStore } from "@/server/store";
import { resolveCompany } from "@/server/tenant";
import { resolveCompanySimulationScript } from "@/services/simulation-policy";

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const company = await resolveCompany();
  const agent = company ? await getStore().getAgentByCompany(company.id) : undefined;
  if (!company || !agent) {
    throw new Error("Entreprise ou configuration de Maude introuvable.");
  }
  const script = resolveCompanySimulationScript(company, agent);
  return (
    <>
      <PageHeader
        title="Démo intégrée"
        subtitle="Ce scénario utilise les mêmes services, le même repository et les mêmes pages que l'application normale."
      />
      <SimulatorClient scriptId={script.id} scriptName={script.name} />
    </>
  );
}
