/** Business Brain — connaissances approuvees, citees et controlables. */
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { listBusinessKnowledgeItems } from "@/services/business-brain";
import { BusinessBrainClient } from "@/components/BusinessBrainClient";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const companyId = await resolveCompanyId();
  const company = (await getStore().getCompany(companyId))!;
  const items = await listBusinessKnowledgeItems(company);
  return (
    <>
      <PageHeader
        title="Cerveau d'entreprise"
        subtitle="Connaissances approuvees par le proprietaire, citees dans les reponses, avec refus propre si l'information manque."
      />
      <BusinessBrainClient initialItems={items} />
    </>
  );
}
