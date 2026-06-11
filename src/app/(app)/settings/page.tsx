/** Configuration entreprise — le contexte métier qui pilote l'agent vocal. */
import { resolveCompany } from "@/server/tenant";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";
import { BillingCard } from "@/components/BillingCard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const company = (await resolveCompany())!;
  return (
    <>
      <PageHeader title="Configuration de l'entreprise" subtitle="Ces informations alimentent directement les scripts, l'escalade et la conformité de l'agent" />
      <div className="mb-6">
        <BillingCard company={company} />
      </div>
      <SettingsForm company={company} />
    </>
  );
}
