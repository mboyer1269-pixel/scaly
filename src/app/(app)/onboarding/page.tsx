/**
 * Onboarding magique (P3.4) — URL du site + 2 phrases → brouillon de profil
 * et de persona, éditable, jamais actif sans approbation explicite.
 */
import { PageHeader } from "@/components/ui";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        title="Onboarding magique"
        subtitle="De votre site web à une réceptionniste configurée en quelques minutes — rien ne s'active sans votre approbation"
      />
      <OnboardingWizard />
    </>
  );
}
