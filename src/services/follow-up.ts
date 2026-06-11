/**
 * Service — Suivi de soumission J+2 (P3.3, ADR-015 palier 2). Fonction PURE.
 *
 * BARRIÈRE DE CONFORMITÉ : un suivi n'est planifié QUE si le consentement de
 * rappel a été capté pendant l'appel entrant (collectedFields, capté par
 * l'agente — question du prompt P2B). Pas de consentement = pas de relance,
 * point. C'est « relance conforme par conception ».
 */
import type { Call } from "@/domain/call";
import type { Company } from "@/domain/company";
import type { ScalyAction } from "@/domain/action";
import { newId } from "@/lib/format";

export const FOLLOW_UP_AFTER_DAYS = 2;

/** Clés de champ acceptées comme consentement (capté verbatim par l'agente). */
const CONSENT_KEYS = ["consentement_rappel", "callback_consent", "consentement"];
const CONSENT_YES = /^(oui|yes|ok|d'accord|daccord|parfait|certainement|bien sûr|bien sur)/i;

export function hasCallbackConsent(call: Call): boolean {
  const fields = call.intelligence?.collectedFields ?? {};
  return CONSENT_KEYS.some((k) => fields[k] && CONSENT_YES.test(fields[k].trim()));
}

/**
 * Planifie les suivis de soumission dus : intention demande_soumission,
 * statut suivi_requis, appel vieux d'au moins FOLLOW_UP_AFTER_DAYS jours,
 * consentement capté, et AUCUN suivi déjà planifié/envoyé pour cet appel.
 */
export function planQuoteFollowUps(company: Company, calls: Call[], existingActions: ScalyAction[], now = new Date()): ScalyAction[] {
  const cutoff = now.getTime() - FOLLOW_UP_AFTER_DAYS * 24 * 3600 * 1000;
  const alreadyFollowed = new Set(
    existingActions.filter((a) => a.callId && a.payload?.kind === "suivi_soumission").map((a) => a.callId as string),
  );

  return calls
    .filter(
      (c) =>
        c.intelligence?.intent === "demande_soumission" &&
        c.intelligence.finalStatus === "suivi_requis" &&
        new Date(c.startedAt).getTime() <= cutoff &&
        !alreadyFollowed.has(c.id) &&
        hasCallbackConsent(c),
    )
    .map((c): ScalyAction => {
      const nowIso = new Date().toISOString();
      const caller = c.callerName ?? "client";
      return {
        id: newId("act"),
        companyId: company.id,
        callId: c.id,
        type: "send_sms",
        title: `Suivi de soumission (J+${FOLLOW_UP_AFTER_DAYS}) — ${caller}`,
        payload: {
          kind: "suivi_soumission",
          to: c.fromNumber,
          respectContactHours: true, // envoi planifié → heures CRTC respectées
          consentEvidence: c.intelligence?.collectedFields?.["consentement_rappel"] ?? "capté en appel",
          body: `Bonjour ${caller}, ici ${company.name}. Vous nous aviez demandé une soumission — avez-vous encore besoin de nous ? Répondez à ce SMS ou rappelez-nous, on s'occupe de vous. (Vous aviez accepté ce suivi lors de votre appel.)`,
        },
        status: "pending",
        attempts: 0,
        executor: "mock",
        createdAt: nowIso,
        audit: [{ at: nowIso, event: "planifiée", detail: `Suivi J+${FOLLOW_UP_AFTER_DAYS} — consentement capté en appel (ADR-015 palier 2)` }],
      };
    });
}
