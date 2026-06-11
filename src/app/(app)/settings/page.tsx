/** Configuration entreprise — le contexte métier qui pilote l'agent vocal. */
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const company = (await getStore().getCompany(DEFAULT_COMPANY_ID))!;
  return (
    <>
      <PageHeader title="Configuration de l'entreprise" subtitle="Ces informations alimentent directement les scripts, l'escalade et la conformité de l'agent" />
      <SettingsForm company={company} />
    </>
  );
}
