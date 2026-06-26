import { Card, PageHeader } from "@/components/ui";
import { PrivacyControls } from "@/components/PrivacyControls";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="Confidentialité et données"
        subtitle="Export portable, suppression de compte et preuve d'audit honnête pour les exigences App Store / Google Play."
      />
      <Card
        title="Mes données Allô Maude"
        subtitle="Ces actions utilisent le même repository que l'application; rien n'est simulé ici."
      >
        <PrivacyControls />
      </Card>
    </>
  );
}
