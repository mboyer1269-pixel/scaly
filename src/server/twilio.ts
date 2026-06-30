/**
 * Twilio — helpers TwiML + validation de signature, SANS SDK (zéro dépendance).
 * Règle produit : le téléphone ne casse JAMAIS. Si le service temps réel est
 * indisponible, le TwiML de repli transfère l'appel au numéro humain.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { LanguageCode } from "@/domain/company";

export interface RelaySessionIdentity {
  companyId: string;
  callSid: string;
  from: string;
}

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Validation de la signature X-Twilio-Signature : HMAC-SHA1 (auth token) de
 * l'URL complète + paramètres POST triés par clé, concaténés clé+valeur.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string): boolean {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function relaySessionToken(secret: string, identity: RelaySessionIdentity): string {
  const data = `${identity.companyId}|${identity.callSid}|${identity.from}`;
  return createHmac("sha256", secret).update(Buffer.from(data, "utf-8")).digest("base64url");
}

export function verifyRelaySessionToken(secret: string, identity: RelaySessionIdentity, token: string): boolean {
  const expected = relaySessionToken(secret, identity);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** TwiML : ouvre le Media Stream bidirectionnel vers scaly-realtime. */
export function twimlConnectStream(wsUrl: string, parameters: Record<string, string> = {}): string {
  const params = Object.entries(parameters)
    .map(([name, value]) => `<Parameter name="${xmlEscape(name)}" value="${xmlEscape(value)}" />`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${xmlEscape(wsUrl)}">${params}</Stream></Connect></Response>`;
}

/** Options voix du prototype ConversationRelay — Twilio porte l'ASR et la TTS. */
export interface RelayTwimlOptions {
  /** Accueil parlé par Twilio dès le décroché. */
  welcomeGreeting: string;
  /** fr-CA par défaut : langue ASR + TTS de la session. */
  language: string;
  /** "Amazon" (Polly), "Google", "ElevenLabs", selon le compte Twilio. */
  ttsProvider: string;
  /** Exemple : "Gabrielle-Neural" pour tester une voix fr-CA native. */
  voice: string;
  /** "Google" ou "Deepgram", selon le compte Twilio. */
  transcriptionProvider: string;
  /** Modèle ASR optionnel. */
  speechModel?: string;
}

/** TwiML : ouvre une session ConversationRelay vers le prototype A/B. */
export function twimlConnectRelay(wsUrl: string, opts: RelayTwimlOptions, parameters: Record<string, string> = {}): string {
  const attrs =
    `url="${xmlEscape(wsUrl)}" welcomeGreeting="${xmlEscape(opts.welcomeGreeting)}" ` +
    `language="${xmlEscape(opts.language)}" ttsProvider="${xmlEscape(opts.ttsProvider)}" voice="${xmlEscape(opts.voice)}" ` +
    `transcriptionProvider="${xmlEscape(opts.transcriptionProvider)}"` +
    (opts.speechModel ? ` speechModel="${xmlEscape(opts.speechModel)}"` : "");
  const params = Object.entries(parameters)
    .map(([name, value]) => `<Parameter name="${xmlEscape(name)}" value="${xmlEscape(value)}" />`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><ConversationRelay ${attrs}>${params}</ConversationRelay></Connect></Response>`;
}

/**
 * TwiML de repli : message court dans la langue de l'entreprise puis transfert
 * direct au numéro humain. Utilisé quand le realtime n'est pas configuré ou
 * injoignable — l'appelant parle TOUJOURS à quelqu'un.
 */
export function twimlFallbackTransfer(opts: { to: string; lang: LanguageCode; companyName: string }): string {
  const say =
    opts.lang === "en"
      ? `Thank you for calling ${opts.companyName}. One moment, we're connecting you.`
      : `Merci d'appeler ${opts.companyName}. Un instant, nous vous mettons en relation.`;
  const voice = opts.lang === "en" ? "Polly.Joanna" : "Polly.Chantal";
  const language = opts.lang === "en" ? "en-CA" : "fr-CA";
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Say voice="${voice}" language="${language}">${xmlEscape(say)}</Say>` +
    `<Dial>${xmlEscape(opts.to)}</Dial>` +
    `</Response>`
  );
}

/** TwiML : transfert immédiat (escalade en cours d'appel). */
export function twimlDial(to: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${xmlEscape(to)}</Dial></Response>`;
}
