/** Agent vocal — personnalité, garde-fous et scripts de l'agent. */
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { PageHeader } from "@/components/ui";
import { AgentForm } from "@/components/AgentForm";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const store = getStore();
  const companyId = await resolveCompanyId();
  const agent = (await store.getAgentByCompany(companyId))!;
  const company = (await store.getCompany(companyId))!;
  return (
    <>
      <PageHeader title="Agent vocal" subtitle="La personnalité et les limites de l'agent qui répond pour votre entreprise" />
      <AgentForm agent={agent} companyName={company.name} />
    </>
  );
}
