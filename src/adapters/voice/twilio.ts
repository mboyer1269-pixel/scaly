/**
 * Stub Twilio (téléphonie) — P2. NON CONFIGURÉ : échoue explicitement.
 * Implémentation prévue : numéros entrants, Media Streams (WebSocket) vers le
 * service temps réel, transfert vers humain, statut d'appel. Voir docs/VOICE.md.
 */
import { NotConfiguredError, type TelephonyProvider, type VoiceSessionEvent, type VoiceSessionHandle } from "./types";

const ENV_VARS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"];

export class TwilioTelephonyProvider implements TelephonyProvider {
  readonly name = "twilio";

  isConfigured(): boolean {
    return ENV_VARS.every((v) => Boolean(process.env[v]));
  }

  async answerInbound(_callSid: string, _onEvent: (e: VoiceSessionEvent) => void): Promise<VoiceSessionHandle> {
    if (!this.isConfigured()) throw new NotConfiguredError("Twilio", ENV_VARS);
    // P2 : ouvrir le Media Stream et le brancher au service temps réel.
    throw new Error("TwilioTelephonyProvider.answerInbound : implémentation prévue en P2 (docs/VOICE.md).");
  }
}

export const twilioProvider = new TwilioTelephonyProvider();
