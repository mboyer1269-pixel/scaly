/** Voice Runtime Lab — banc d'essai du cerveau conversationnel. */
import { PageHeader } from "@/components/ui";
import { VoiceLabClient } from "@/components/VoiceLabClient";

export const dynamic = "force-dynamic";

export default function VoiceLabPage() {
  return (
    <>
      <PageHeader
        title="Voice Lab"
        subtitle="Machine à états, extraction progressive, bilinguisme, interruptions et budget de latence — testés avant toute connexion téléphonique réelle."
      />
      <VoiceLabClient />
    </>
  );
}
