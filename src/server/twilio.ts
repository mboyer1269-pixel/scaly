/**
 * Twilio — helpers TwiML + validation de signature, SANS SDK (zéro dépendance).
 * Règle produit : le téléphone ne casse JAMAIS. Si le service temps réel est
 * indisponible, le TwiML de repli transfère l'appel au numéro humain.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { LanguageCode } from "@/domain/company";

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

/** TwiML : ouvre le Media Stream bidirectionnel vers scaly-realtime. */
export function twimlConnectStream(wsUrl: string, parameters: Record<string, string> = {}): string {
  const params = Object.entries(parameters)
    .map(([name, value]) => `<Parameter name="${xmlEscape(name)}" value="${xmlEscape(value)}" />`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${xmlEscape(wsUrl)}">${params}</Stream></Connect></Response>`;
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
