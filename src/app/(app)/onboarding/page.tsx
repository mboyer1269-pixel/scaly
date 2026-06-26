/** Formation guidée — brouillon éditable, jamais actif sans approbation explicite. */
import { PageHeader } from "@/components/ui";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        title="Former Maude"
        subtitle="Décrivez votre entreprise, vérifiez ce que Maude a compris, puis approuvez chaque changement avant de le tester."
      />
      <OnboardingWizard />
    </>
  );
}
