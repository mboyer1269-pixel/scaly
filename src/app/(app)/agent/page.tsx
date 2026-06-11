/** Agent vocal — personnalité, garde-fous et scripts de l'agent. */
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { PageHeader } from "@/components/ui";
import { AgentForm } from "@/components/AgentForm";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const store = getStore();
  const agent = (await store.getAgentByCompany(DEFAULT_COMPANY_ID))!;
  const company = (await store.getCompany(DEFAULT_COMPANY_ID))!;
  return (
    <>
      <PageHeader title="Agent vocal" subtitle="La personnalité et les limites de l'agent qui répond pour votre entreprise" />
      <AgentForm agent={agent} companyName={company.name} />
    </>
  );
}
