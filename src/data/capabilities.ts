/**
 * Registre des capabilities produit d'Allô Maude.
 *
 * Ajouter une capability = ajouter UNE définition ici + son moteur dans
 * src/services. Les packs métiers ne font que la RÉFÉRENCER par id.
 */
import type { IndustryPack } from "@/domain/pack";
import { CapabilityUnknownError, type CapabilityDefinition, type CapabilityId } from "@/domain/capability";

/**
 * Remplissage intelligent des annulations : quand une plage se libère, Maude
 * relance les BONNES personnes de la liste d'attente au lieu de laisser le
 * trou coûter de l'argent — consentement d'abord, jamais de promesse de plage.
 */
export const APPOINTMENT_GAP_RECOVERY: CapabilityDefinition = {
  capabilityId: "appointment_gap_recovery",
  displayName: "Remplissage intelligent des annulations",
  description:
    "Capte l'intention « appelez-moi si une place se libère » pendant l'appel, représente la plage libérée, " +
    "matche les candidats consentants du même tenant et prépare une relance prudente — auditée à chaque étape.",
  requiredData: ["companyId", "phone", "humanLabel"],
  optionalData: ["serviceCategory", "serviceLabel", "startsAt", "endsAt", "preferredTimeWindow", "urgency"],
  supportedChannels: ["sms", "call", "action_only"],
  safetyRules: [
    "Jamais de SMS sans consentement actif (coffre ADR-018) — révocation STOP l'emporte sur tout.",
    "Jamais promettre que la plage est réservée tant qu'un humain n'a pas confirmé.",
    "Jamais de matching inter-tenant : companyId obligatoire sur chaque donnée persistée.",
    "Limite basse de candidats par plage — jamais de relance de masse.",
    "Une annulation persistée (entrée, plage ou offre) bloque toute livraison future.",
  ],
  auditEvents: [
    "waitlist.entry_created",
    "waitlist.entry_cancelled",
    "waitlist.notes_purged",
    "appointment_gap.opened",
    "appointment_gap.filled",
    "appointment_gap.cancelled",
    "appointment_gap.expired",
    "recovery_offer.prepared",
    "recovery_offer.sent",
    "recovery_offer.confirmed",
    "recovery_offer.gap_taken_notice",
    "recovery_offer.declined",
    "recovery_offer.cancelled",
    "recovery_offer.expired",
  ],
  runtimeEvents: ["recovery.gap_opened", "recovery.offer_sent", "recovery.offer_confirmed"],
  defaultLimits: {
    maxCandidatesPerGap: 3,
  },
};

/**
 * Pouls texto du propriétaire : les moments qui méritent une interruption
 * (urgence, client chaud, plainte) arrivent par SMS — moteur
 * src/services/owner-notifications + owner-notification-delivery.
 */
export const OWNER_NOTIFICATION: CapabilityDefinition = {
  capabilityId: "owner_notification",
  displayName: "Pouls texto du propriétaire",
  description:
    "Détecte les appels qui méritent d'interrompre le propriétaire (urgence, client chaud, plainte) et envoie " +
    "un SMS court avec le contexte — claim anti-doublon, chaque envoi tracé.",
  requiredData: ["companyId", "ownerPhone"],
  optionalData: ["notificationRules", "quietHours"],
  supportedChannels: ["sms"],
  safetyRules: [
    "Jamais deux SMS pour le même appel (claim de livraison atomique).",
    "Le résumé ne contient jamais le transcript complet — synthèse seulement.",
    "Volume borné : seuls les déclencheurs configurés notifient, jamais chaque appel.",
  ],
  auditEvents: ["owner_notification.created", "owner_notification.sent", "owner_notification.failed"],
  runtimeEvents: ["owner.notification_sent"],
  defaultLimits: {
    maxNotificationsPerDay: 20,
  },
};

/**
 * File de récupération intelligente : chaque dollar qui fuit (appel manqué,
 * annulation, chaud qui refroidit, soumission oubliée) devient une Opportunity
 * priorisée — moteur src/services/opportunities (fonctions pures).
 */
export const OPPORTUNITY_DETECTION: CapabilityDefinition = {
  capabilityId: "opportunity_detection",
  displayName: "Détection d'opportunités",
  description:
    "Analyse chaque appel terminé et les boucles en cours pour produire UNE file priorisée : raison, valeur " +
    "estimée, urgence et prochaine action — la réponse à « où est l'argent qui fuit ? ».",
  requiredData: ["companyId", "calls"],
  optionalData: ["actions", "notifications", "gaps", "waitlist"],
  supportedChannels: ["action_only"],
  safetyRules: [
    "Les valeurs sont des estimations (montant mentionné ou barème ADR-010) — affichées comme telles, jamais promises.",
    "Aucune opportunité inter-tenant : chaque file est bornée au companyId.",
  ],
  auditEvents: ["opportunity.surfaced"],
  runtimeEvents: ["opportunity.detected"],
  defaultLimits: {
    maxQueueSize: 50,
  },
};

/**
 * Preuve de valeur chiffrée : « Maude vous coûte X $, elle a protégé Y $ » —
 * moteurs src/services/rescue (RoiSnapshot) + revenue (compteur marge).
 */
export const ROI_REPORTING: CapabilityDefinition = {
  capabilityId: "roi_reporting",
  displayName: "Rapport de ROI",
  description:
    "Calcule en continu la valeur protégée (appels sauvés, plages comblées) contre le coût du service, " +
    "à partir des appels réels et du barème d'industrie — le tableau de bord 60 secondes.",
  requiredData: ["companyId", "calls", "valueBaseline"],
  optionalData: ["declaredValues", "aiCosts"],
  supportedChannels: ["action_only"],
  safetyRules: [
    "Chaque montant porte sa méthode de calcul : mesuré ou barème d'industrie (ADR-010), jamais un chiffre magique.",
    "Le barème est une hypothèse interne affichée comme telle, recalibrée par client réel.",
  ],
  auditEvents: ["roi.snapshot_computed"],
  runtimeEvents: [],
  defaultLimits: {
    reportingWindowDays: 30,
  },
};

/**
 * Coffre de consentements ADR-018 : capté verbatim en appel, opposable,
 * révocable par STOP — moteur src/services/consent.
 */
export const CONSENT_CAPTURE: CapabilityDefinition = {
  capabilityId: "consent_capture",
  displayName: "Captation de consentement",
  description:
    "Capte le consentement de rappel VERBATIM pendant l'appel, le range par personne dans le coffre " +
    "(ADR-018), et honore la révocation SMS STOP immédiatement — conforme par conception (Loi 25, CRTC).",
  requiredData: ["companyId", "callerPhone", "verbatim"],
  optionalData: ["consentKind", "sourceCallId"],
  supportedChannels: ["call", "sms"],
  safetyRules: [
    "Une révocation l'emporte sur TOUT — même un consentement plus récent ne ressuscite pas la relance automatique.",
    "Le refus est enregistré au même titre que le oui.",
    "STOP de n'importe quel expéditeur révoque tout, avant même le filtre propriétaire.",
  ],
  auditEvents: ["consent.captured", "consent.revoked", "consent.refused"],
  runtimeEvents: ["consent.captured", "sms.opt_out_received"],
  defaultLimits: {},
};

/**
 * Transfert humain : dès que l'appelant le demande ou qu'une règle d'escalade
 * se déclenche, l'appel part vers transferPhone — runtime voix + repli <Dial>.
 */
export const HUMAN_HANDOFF: CapabilityDefinition = {
  capabilityId: "human_handoff",
  displayName: "Transfert vers un humain",
  description:
    "Transfère l'appel vers le numéro humain de l'entreprise dès que l'appelant le demande, qu'une urgence " +
    "critique survient ou que l'agente atteint sa limite — et sert de repli si le pont temps réel tombe.",
  requiredData: ["companyId", "transferPhone"],
  optionalData: ["escalationRules"],
  supportedChannels: ["call"],
  safetyRules: [
    "Transférer à un humain dès que l'appelant le demande explicitement — non négociable.",
    "Panne du pont temps réel → repli <Dial> automatique : le téléphone ne casse jamais.",
  ],
  auditEvents: ["call.transfer_requested", "call.transfer_completed"],
  runtimeEvents: ["call.transferred"],
  defaultLimits: {},
};

/**
 * Sauvetage d'appels manqués : SMS de rappel < 2 min après un appel perdu —
 * réponse à la demande du client, pas de la sollicitation (ADR-015 palier 1).
 * Moteur src/services/rescue.
 */
export const MISSED_CALL_RESCUE: CapabilityDefinition = {
  capabilityId: "missed_call_rescue",
  displayName: "Sauvetage d'appels manqués",
  description:
    "Chaque appel manqué/abandonné entre dans la file de sauvetage avec le chrono qui tourne " +
    "(fenêtre critique < 15 min) et reçoit un SMS de rappel — la majorité des clients achètent du premier répondant.",
  requiredData: ["companyId", "callerPhone", "twilioPhoneNumber"],
  optionalData: ["missedCallAutoSms"],
  supportedChannels: ["sms"],
  safetyRules: [
    "Rappel d'appel manqué = réponse à la demande du client, jamais de contenu promotionnel (périmètre ADR-015).",
    "STOP arrête tout, immédiatement.",
    "Un seul SMS de sauvetage par appel manqué.",
  ],
  auditEvents: ["rescue.sms_planned", "rescue.sms_sent"],
  runtimeEvents: [],
  defaultLimits: {
    maxRescueSmsPerCall: 1,
  },
};

/**
 * Suivi de soumission J+2 : relance UNIQUEMENT si le consentement a été capté
 * pendant l'appel entrant (ADR-015 palier 2) — moteur src/services/follow-up.
 */
export const QUOTE_FOLLOW_UP: CapabilityDefinition = {
  capabilityId: "quote_follow_up",
  displayName: "Suivi de soumission J+2",
  description:
    "Deux jours après une demande de soumission, relance par SMS la personne qui a EXPLICITEMENT consenti " +
    "au rappel pendant l'appel — le consentement verbatim est la barrière, pas une option.",
  requiredData: ["companyId", "callerPhone", "callbackConsent"],
  optionalData: ["quoteAmount", "serviceLabel"],
  supportedChannels: ["sms"],
  safetyRules: [
    "Pas de consentement capté en appel = pas de relance, point (ADR-015 palier 2).",
    "Les numéros révoqués (coffre ADR-018) sont exclus sans exception.",
    "Heures CRTC respectées : 9 h-21 h 30 semaine, 10 h-18 h fin de semaine.",
  ],
  auditEvents: ["follow_up.planned", "follow_up.sent"],
  runtimeEvents: [],
  defaultLimits: {
    maxFollowUpsPerQuote: 1,
  },
};

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityDefinition> = {
  appointment_gap_recovery: APPOINTMENT_GAP_RECOVERY,
  owner_notification: OWNER_NOTIFICATION,
  opportunity_detection: OPPORTUNITY_DETECTION,
  roi_reporting: ROI_REPORTING,
  consent_capture: CONSENT_CAPTURE,
  human_handoff: HUMAN_HANDOFF,
  missed_call_rescue: MISSED_CALL_RESCUE,
  quote_follow_up: QUOTE_FOLLOW_UP,
};

/** Définition stricte : undefined si la capability n'existe pas. */
export function findCapability(id: string): CapabilityDefinition | undefined {
  return (CAPABILITY_REGISTRY as Record<string, CapabilityDefinition>)[id];
}

/** Définition obligatoire : échec PROPRE (CapabilityUnknownError) si absente. */
export function requireCapability(id: string): CapabilityDefinition {
  const def = findCapability(id);
  if (!def) throw new CapabilityUnknownError(id);
  return def;
}

/** Un pack (ou son absence) supporte-t-il cette capability ? Jamais de crash. */
export function packSupportsCapability(pack: IndustryPack | undefined, id: CapabilityId): boolean {
  return Boolean(pack?.capabilities.includes(id) && findCapability(id));
}
