/**
 * Service — Coffre de consentements (ADR-018). Fonctions PURES.
 * Extraction depuis un appel analysé, détection de révocation par SMS,
 * et règle de décision « peut-on relancer cette personne ? ».
 */
import type { Call } from "@/domain/call";
import type { ConsentRecord } from "@/domain/consent";
import { canonicalPhone } from "@/domain/consent";
import { newId } from "@/lib/format";

/** Clés de champ où l'agente note la réponse de consentement (verbatim). */
export const CONSENT_FIELD_KEYS = ["consentement_rappel", "callback_consent", "consentement"];
const YES = /^(oui|yes|ok|d'accord|daccord|parfait|certain|certainement|bien sûr|bien sur|sure|absolument|pas de problème|pas de probleme)/i;
const NO = /^(non|no|pas |jamais|refus|n'|ne )/i;

/**
 * Extrait le consentement d'un appel analysé → enregistrement du coffre,
 * ou null si l'agente n'a rien capté. Un refus EST enregistré (statut
 * `refuse`) : c'est une information de conformité, pas une absence.
 */
export function consentFromCall(call: Call, now = new Date()): ConsentRecord | null {
  const fields = call.intelligence?.collectedFields ?? {};
  const key = CONSENT_FIELD_KEYS.find((k) => fields[k]?.trim());
  if (!key) return null;
  const verbatim = fields[key].trim();
  const status = YES.test(verbatim) ? "actif" : NO.test(verbatim) ? "refuse" : null;
  if (!status) return null; // réponse ambiguë : on n'invente JAMAIS un consentement
  return {
    id: newId("cons"),
    companyId: call.companyId,
    phone: canonicalPhone(call.fromNumber),
    kind: "rappel",
    status,
    verbatim,
    channel: "appel",
    sourceCallId: call.id,
    capturedAt: now.toISOString(),
  };
}

/** Mots de révocation reconnus (FR/EN, standards télécom inclus). */
const REVOCATION = /^\s*(stop|arret|arrêt|arrete|arrête|unsubscribe|cancel|end|quit|desabonne|désabonne|desinscription|désinscription|retire mon consentement)\s*$/i;

export function isRevocationMessage(body: string): boolean {
  return REVOCATION.test(body);
}

/**
 * Peut-on relancer ce numéro ? RÈGLE DURE :
 * - une révocation l'emporte sur TOUT (même un consentement plus récent ne
 *   ressuscite pas une relance automatique — un humain doit re-capter) ;
 * - un refus bloque tant qu'aucun consentement actif plus récent n'existe ;
 * - sinon il faut au moins un consentement actif du bon type.
 */
export function canFollowUp(consents: ConsentRecord[], phone: string, kind: ConsentRecord["kind"] = "rappel"): boolean {
  const canon = canonicalPhone(phone);
  const mine = consents.filter((c) => c.phone === canon);
  if (mine.some((c) => c.status === "revoque")) return false;
  const relevant = mine.filter((c) => c.kind === kind);
  const latest = relevant.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
  return latest?.status === "actif";
}
