/**
 * Domaine — Capability Registry.
 *
 * Une capability est une FONCTIONNALITÉ PRODUIT activable par pack métier :
 * le pack déclare le contexte (taxonomie, prudence, gabarits), le MOTEUR
 * exécute la capability. Aucune logique métier hardcodée dans les packs,
 * aucune donnée runtime dans les définitions : 100 % déclaratif, JSON-sérialisable.
 *
 * Invariants :
 *  - une capability inconnue échoue PROPREMENT (CapabilityUnknownError), jamais un crash silencieux ;
 *  - un pack sans la capability → le moteur n'exécute rien (repli follow-up humain existant) ;
 *  - les limites par défaut sont volontairement basses (jamais de « blast everyone »).
 */

import type { RuntimeEventType } from "./runtime-event";

export type CapabilityId =
  | "appointment_gap_recovery"
  | "owner_notification"
  | "opportunity_detection"
  | "roi_reporting"
  | "consent_capture"
  | "human_handoff"
  | "missed_call_rescue"
  | "quote_follow_up";

export type CapabilityChannel = "sms" | "call" | "action_only";

export interface CapabilityDefinition {
  capabilityId: CapabilityId;
  /** Nom client FR — ce qui apparaît sur la facture et dans la démo. */
  displayName: string;
  description: string;
  /** Données minimales sans lesquelles la capability refuse de s'exécuter. */
  requiredData: string[];
  optionalData: string[];
  supportedChannels: CapabilityChannel[];
  /** Règles de sécurité NON négociables, appliquées par le moteur (pas par le pack). */
  safetyRules: string[];
  /** Événements d'audit que le moteur émet — le fil d'action doit pouvoir tout retracer. */
  auditEvents: string[];
  /**
   * Événements RuntimeEvent RÉELLEMENT émis dans l'outbox (ADR-020) quand la
   * capability s'exécute. Typés contre RUNTIME_EVENT_TYPES : impossible de
   * déclarer un événement qui n'existe pas. Vide = la capability ne franchit
   * pas encore la frontière — honnêteté, pas une promesse.
   */
  runtimeEvents: RuntimeEventType[];
  defaultLimits: Record<string, number>;
}

/** Échec propre : capability demandée mais absente du registre. */
export class CapabilityUnknownError extends Error {
  readonly capabilityId: string;

  constructor(capabilityId: string) {
    super(`Capability inconnue : « ${capabilityId} » — absente du registre.`);
    this.name = "CapabilityUnknownError";
    this.capabilityId = capabilityId;
  }
}
