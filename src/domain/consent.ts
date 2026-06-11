/**
 * Domaine — Coffre de consentements (ADR-018).
 *
 * Le consentement devient un objet de PREMIÈRE CLASSE, par PERSONNE (numéro
 * canonique), plus seulement une note dans la fiche d'un appel :
 * - opposable : verbatim exact + source (appel/SMS) + horodatage ;
 * - révocable : « STOP / ARRÊT » par texto révoque tout, immédiatement
 *   (Loi 25 : retrait du consentement ; règles CRTC) ;
 * - le REFUS est aussi enregistré : ne pas re-solliciter quelqu'un qui a dit
 *   non vaut autant que pouvoir rappeler quelqu'un qui a dit oui.
 */

export type ConsentKind = "rappel" | "reactivation";
export type ConsentStatus = "actif" | "refuse" | "revoque";
export type ConsentChannel = "appel" | "sms" | "manuel";

export interface ConsentRecord {
  id: string;
  companyId: string;
  /** Numéro canonique : chiffres seulement, sans le 1 initial (ex. 8195551234). */
  phone: string;
  kind: ConsentKind;
  status: ConsentStatus;
  /** Réponse EXACTE de la personne, telle que captée — c'est la preuve. */
  verbatim: string;
  channel: ConsentChannel;
  sourceCallId?: string;
  capturedAt: string;
  revokedAt?: string;
  revokedVia?: string; // ex. « SMS STOP »
}

/** Normalise un numéro pour comparaison : chiffres seulement, sans le 1 initial. */
export function canonicalPhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^1/, "");
}
