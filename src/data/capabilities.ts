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
    "appointment_gap.opened",
    "appointment_gap.filled",
    "appointment_gap.cancelled",
    "appointment_gap.expired",
    "recovery_offer.prepared",
    "recovery_offer.sent",
    "recovery_offer.confirmed",
    "recovery_offer.declined",
    "recovery_offer.cancelled",
    "recovery_offer.expired",
  ],
  defaultLimits: {
    maxCandidatesPerGap: 3,
  },
};

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityDefinition> = {
  appointment_gap_recovery: APPOINTMENT_GAP_RECOVERY,
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
