/** Configuration entreprise — le contexte métier qui pilote l'agent vocal. */
import { getStore } from "@/server/store";
import { resolveCompany } from "@/server/tenant";
import { computeMonthUsage } from "@/services/usage";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";
import { BillingCard } from "@/components/BillingCard";
import { UsageCard } from "@/components/UsageCard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const store = getStore();
  const company = (await resolveCompany())!;
  const calls = await store.listCalls(company.id);
  const usage = computeMonthUsage(calls, new Date());
  return (
    <>
      <PageHeader title="Configuration de l'entreprise" subtitle="Ces informations alimentent directement les scripts, l'escalade et la conformité de l'agent" />
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BillingCard company={company} />
        <UsageCard planId={company.planId} usage={usage} />
      </div>
      <SettingsForm company={company} persistent={store.info().persistent} />
    </>
  );
}
