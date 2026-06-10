/** État honnête de la pile vocale — affiché dans le cockpit admin et /api/health. */
import type { ProviderHealth } from "@/domain/analytics";
import { mockDialogueProvider } from "./mock";
import { twilioProvider } from "./twilio";
import { openAiRealtimeProvider } from "./openai-realtime";
import { elevenLabsProvider } from "./elevenlabs";
import { whisperProvider } from "./whisper";

export function getVoiceStackHealth(): ProviderHealth[] {
  const real = [
    { p: twilioProvider, note: "Téléphonie — branchement prévu en P2" },
    { p: openAiRealtimeProvider, note: "Dialogue temps réel — branchement prévu en P2" },
    { p: elevenLabsProvider, note: "Synthèse vocale — branchement prévu en P2" },
    { p: whisperProvider, note: "Transcription — branchement prévu en P2" },
  ];
  return [
    {
      name: mockDialogueProvider.name,
      status: "operationnel",
      note: "Provider simulé (texte) — alimente le simulateur et les démos",
    },
    ...real.map(({ p, note }) => ({
      name: p.name,
      status: p.isConfigured() ? ("operationnel" as const) : ("non_configure" as const),
      note,
    })),
  ];
}
