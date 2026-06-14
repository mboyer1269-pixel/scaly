/**
 * Protocole scaly-relay — la partie PURE et testée du prototype
 * Twilio ConversationRelay ↔ LLM texte (tests/relay-protocol.test.ts).
 *
 * PROTOTYPE A/B (n'altère JAMAIS le champion realtime/server.ts) : ici Twilio
 * fait l'ASR et la TTS avec une vraie voix fr-CA native (Polly Gabrielle) —
 * notre relais ne voit que du TEXTE. L'hypothèse à vérifier À L'OREILLE :
 * accent québécois authentique > voix OpenAI, sans payer trop cher en latence.
 * Tout ce qui touche au réseau vit dans realtime/relay-server.ts.
 */
import type { VoiceTurnLatency } from "../src/domain/voice";

// ---------------------------------------------------------------------------
// Messages ConversationRelay (WebSocket, TEXTE dans les deux sens)
// ---------------------------------------------------------------------------

export type RelayMessage =
  | {
      type: "setup";
      sessionId?: string;
      callSid: string;
      from?: string;
      to?: string;
      customParameters?: Record<string, string>;
    }
  | { type: "prompt"; voicePrompt: string; lang?: string; last?: boolean }
  | { type: "interrupt"; utteranceUntilInterrupt?: string; durationUntilInterruptMs?: number }
  | { type: "dtmf"; digit: string }
  | { type: "error"; description?: string };

export function parseRelayMessage(raw: string): RelayMessage | null {
  try {
    const msg = JSON.parse(raw) as { type?: string };
    if (!msg || typeof msg.type !== "string") return null;
    if (!["setup", "prompt", "interrupt", "dtmf", "error"].includes(msg.type)) return null;
    return msg as RelayMessage;
  } catch {
    return null;
  }
}

/** Jeton de texte vers Twilio — la TTS commence à parler dès le premier, mais ne joue rien sans un last:true final. */
export function relayTextToken(token: string, last: boolean): string {
  return JSON.stringify({ type: "text", token, last });
}

/** Fin de session côté relais (Twilio raccroche ou enchaîne sur l'action TwiML). */
export function relayEnd(reason?: string): string {
  return JSON.stringify({ type: "end", ...(reason ? { handoffData: JSON.stringify({ reason }) } : {}) });
}

// ---------------------------------------------------------------------------
// Prompt système — MÊME source de vérité que le champion, plus la couche TTS
// ---------------------------------------------------------------------------

/**
 * En mode relais, la sortie du LLM est lue MOT À MOT par la synthèse vocale :
 * la moindre puce, le moindre symbole devient du bruit dans l'oreille de
 * l'appelant. Ces consignes s'ajoutent au prompt champion, sans le modifier.
 */
export const RELAY_TTS_RULES = [
  `# Sortie vocale (synthèse)`,
  `Tes réponses sont lues mot à mot par une synthèse vocale : texte brut SEULEMENT — ` +
    `aucune liste, aucun symbole, aucune mise en forme, aucun émoji. ` +
    `Phrases courtes. Les abréviations s'écrivent au long (« monsieur », jamais « M. »).`,
].join("\n");

export function withRelayTtsRules(championPrompt: string): string {
  return `${championPrompt}\n${RELAY_TTS_RULES}`;
}

// ---------------------------------------------------------------------------
// Flux OpenAI Chat Completions (SSE) → actions du relais
// ---------------------------------------------------------------------------

export type RelayLlmAction =
  | { type: "token"; text: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "done"; finishReason: string | null };

/**
 * Accumulateur du flux SSE Chat Completions : les deltas de contenu sortent
 * en jetons (envoyés à la TTS au fil de l'eau), les deltas d'appel d'outil
 * s'accumulent jusqu'au finish_reason. Une ligne SSE complète par appel —
 * le tampon réseau (lignes coupées) appartient au serveur.
 */
export class ChatStreamAccumulator {
  private toolName = "";
  private toolArgs = "";

  feedLine(line: string): RelayLlmAction[] {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return [];
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") return [];

    let evt: { choices?: { delta?: { content?: string; tool_calls?: { function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[] };
    try {
      evt = JSON.parse(payload) as typeof evt;
    } catch {
      return [];
    }
    const choice = evt.choices?.[0];
    if (!choice) return [];

    const actions: RelayLlmAction[] = [];
    if (choice.delta?.content) actions.push({ type: "token", text: choice.delta.content });
    for (const tc of choice.delta?.tool_calls ?? []) {
      if (tc.function?.name) this.toolName = tc.function.name;
      if (tc.function?.arguments) this.toolArgs += tc.function.arguments;
    }
    if (choice.finish_reason) {
      if (this.toolName) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(this.toolArgs || "{}") as Record<string, unknown>;
        } catch {
          // arguments illisibles : l'outil part avec des args vides, jamais de crash
        }
        actions.push({ type: "tool_call", name: this.toolName, args });
        this.toolName = "";
        this.toolArgs = "";
      }
      actions.push({ type: "done", finishReason: choice.finish_reason });
    }
    return actions;
  }
}

/** Corps de la requête Chat Completions du relais (streaming + outil de transfert). */
export function chatCompletionBody(model: string, messages: { role: string; content: string }[]): object {
  return {
    model,
    messages,
    stream: true,
    // Bref au téléphone : 1-2 phrases par tour (consigne du prompt), le
    // plafond n'est qu'un garde-fou contre un dérapage de longueur.
    max_tokens: 300,
    tools: [
      {
        type: "function",
        function: {
          name: "transfer_to_human",
          description:
            "Transférer l'appel à un humain. À utiliser dès que l'appelant le demande, en cas de frustration, ou pour une urgence critique une fois l'adresse et le téléphone confirmés.",
          parameters: {
            type: "object",
            properties: { reason: { type: "string", description: "Raison du transfert, une phrase." } },
            required: ["reason"],
          },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Latence RÉELLE par tour — même contrat VoiceTurnLatency que le champion
// ---------------------------------------------------------------------------

/**
 * HONNÊTETÉ : ici on mesure transcript reçu → premier jeton de texte envoyé
 * (le « cerveau » seulement). L'ASR final et la synthèse Twilio se passent
 * HORS de notre vue — la latence à l'oreille sera PLUS haute que brainMs.
 * La comparaison champion/prototype se fait donc à l'oreille + sur les logs
 * Twilio, jamais sur brainMs seul.
 */
export class RelayLatencyMeter {
  private promptAt: number | null = null;
  private readonly measures: VoiceTurnLatency[] = [];

  onPromptReceived(nowMs: number): void {
    this.promptAt = nowMs;
  }

  /** Retourne la latence du tour si c'est le PREMIER jeton depuis le transcript. */
  onFirstToken(nowMs: number): VoiceTurnLatency | null {
    if (this.promptAt === null) return null;
    const brain = Math.max(0, nowMs - this.promptAt);
    this.promptAt = null;
    const latency: VoiceTurnLatency = { sttMs: 0, brainMs: brain, ttsMs: 0, perceivedMs: brain, simulated: false };
    this.measures.push(latency);
    return latency;
  }

  all(): VoiceTurnLatency[] {
    return [...this.measures];
  }
}
