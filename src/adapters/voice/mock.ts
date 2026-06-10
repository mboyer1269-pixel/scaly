/**
 * Provider vocal MOCK — le seul provider opérationnel aujourd'hui.
 * Il ne produit pas d'audio : il émet des événements de session textuels,
 * utilisés pour valider le contrat d'interface et alimenter les logs de session.
 * Le vrai banc d'essai conversationnel est le service `simulator` (texte).
 */
import type { RealtimeDialogueProvider, VoiceSessionEvent, VoiceSessionHandle } from "./types";
import { newId } from "@/lib/format";

export class MockDialogueProvider implements RealtimeDialogueProvider {
  readonly name = "mock-dialogue";

  isConfigured(): boolean {
    return true;
  }

  async openSession(systemPrompt: string, onEvent: (e: VoiceSessionEvent) => void): Promise<VoiceSessionHandle> {
    const sessionId = newId("voicesess");
    onEvent({ type: "transcript_final", speaker: "agent", text: `[session mock ouverte — prompt système de ${systemPrompt.length} caractères]` });
    return {
      sessionId,
      say: async (text: string) => {
        onEvent({ type: "transcript_final", speaker: "agent", text });
      },
      transferTo: async (phoneNumber: string) => {
        onEvent({ type: "transfer_initiated", to: phoneNumber });
      },
      hangup: async () => {
        onEvent({ type: "session_ended", reason: "raccroché (mock)" });
      },
    };
  }
}

export const mockDialogueProvider = new MockDialogueProvider();
