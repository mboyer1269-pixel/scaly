/** Voice Runtime Lab — banc d'essai du cerveau conversationnel temps réel (P2A). */
import { PageHeader } from "@/components/ui";
import { VoiceLabClient } from "@/components/VoiceLabClient";

export const dynamic = "force-dynamic";

export default function VoiceLabPage() {
  return (
    <>
      <PageHeader
        title="Voice Lab"
        subtitle="Le cerveau tour par tour de la future voix : machine à états, extraction progressive, bilinguisme, barge-in et budget latence — testé scénario par scénario avant de brancher le téléphone."
      />
      <VoiceLabClient />
    </>
  );
}
