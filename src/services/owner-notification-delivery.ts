/**
 * Service — Livraison des notifications propriétaire.
 *
 * Fait passer une notification `pending` (créée par le pipeline PR #25) à
 * `sent`/`failed` via un port `OwnerNotificationDelivery` injectable. AUCUN
 * envoi réel ici : le seul adapter fourni est simulé (tests + démo). Un adapter
 * réel (Twilio SMS via `@/adapters/integrations/twilio-sms`, email, push…)
 * implémentera le même port dans une PR ultérieure, sans toucher ce service.
 *
 * Garanties de sécurité :
 *  - `toSafeError` masque tout secret/PII avant persistance (aucun token, SID,
 *    clé ou courriel dans `failureReason`).
 *  - Anti double-envoi : une notification déjà traitée (statut != pending) est
 *    retournée telle quelle, jamais renvoyée.
 */
import type { OwnerNotification } from "@/domain/owner-notification";
import {
  getOwnerNotificationRepository,
  listOwnerNotifications,
  markNotificationFailed,
  markNotificationSent,
  type OwnerNotificationRepository,
} from "./owner-notifications";

export interface OwnerNotificationDeliveryResult {
  status: "sent" | "failed";
  /** Identifiant provider (ex. SID Twilio) si envoyé. */
  providerMessageId?: string;
  /** Code d'erreur stable et non sensible (ex. "no_number", "provider_5xx"). */
  errorCode?: string;
  /** Message d'erreur déjà nettoyé de tout secret. */
  safeError?: string;
}

/** Port de livraison. Une implémentation réelle NE DOIT jamais fuiter de secret. */
export interface OwnerNotificationDelivery {
  sendOwnerNotification(notification: OwnerNotification): Promise<OwnerNotificationDeliveryResult>;
}

/**
 * Adapter simulé (no-op réseau) : permet de tester tout le pipeline sans
 * aucun appel externe. `outcome: "failed"` force un échec déterministe.
 */
export class SimulatedOwnerNotificationDelivery implements OwnerNotificationDelivery {
  readonly outbox: OwnerNotification[] = [];

  constructor(
    private readonly config: { outcome?: "sent" | "failed"; errorCode?: string; safeError?: string } = {},
  ) {}

  async sendOwnerNotification(notification: OwnerNotification): Promise<OwnerNotificationDeliveryResult> {
    if (this.config.outcome === "failed") {
      return {
        status: "failed",
        errorCode: this.config.errorCode ?? "simulated_failure",
        safeError: this.config.safeError ?? "Échec simulé — aucun envoi réel.",
      };
    }
    this.outbox.push(notification);
    return { status: "sent", providerMessageId: `sim_${notification.id}` };
  }
}

// Masque les formes de secrets/PII les plus courantes avant toute persistance.
const REDACTIONS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._-]+/gi, // en-tête complet d'abord (masque aussi le mot « Bearer »)
  /Basic\s+[A-Za-z0-9+/=]+/gi,
  /github_pat_[A-Za-z0-9_]+/gi,
  /ghp_[A-Za-z0-9]+/gi,
  /sk-[A-Za-z0-9-]+/gi,
  /AC[0-9a-fA-F]{10,}/g, // SID Twilio
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // courriel
];

/** Normalise une erreur en message court, sans secret ni PII, borné à 200 car. */
export function toSafeError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error ?? "erreur inconnue");
  for (const pattern of REDACTIONS) message = message.replace(pattern, "[caviardé]");
  return message.trim().slice(0, 200) || "erreur de livraison";
}

export interface DeliverOptions {
  now?: Date;
  repo?: OwnerNotificationRepository;
}

/** Une réservation de livraison plus vieille que ceci est réputée périmée (process mort) et reprise. */
export const DELIVERY_CLAIM_TTL_MS = 15 * 60 * 1000;

/**
 * Livre UNE notification pending. Anti double-envoi : si elle n'est plus
 * pending, elle est retournée sans nouvel envoi. Un port qui jette n'échoue
 * jamais bruyamment : l'erreur est caviardée puis persistée en `failed`.
 */
export async function deliverPendingOwnerNotification(
  companyId: string,
  id: string,
  delivery: OwnerNotificationDelivery,
  options: DeliverOptions = {},
): Promise<OwnerNotification> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getOwnerNotificationRepository();
  const current = await repo.get(id);
  if (!current || current.companyId !== companyId) throw new Error("Notification introuvable.");
  if (current.status !== "pending") return current; // déjà traitée : jamais de double-envoi.

  // Réservation ATOMIQUE avant l'envoi. Le statut reste `pending` (pas de
  // « sent » fantôme si le process meurt avant l'envoi) ; seule la fenêtre
  // `deliveryClaimedAt` protège du double SMS concurrent, et une réservation
  // périmée est reprise au prochain passage.
  const staleBefore = new Date(now.getTime() - DELIVERY_CLAIM_TTL_MS).toISOString();
  const claimed = await repo.claimForDelivery(companyId, id, now.toISOString(), staleBefore);
  if (!claimed) return (await repo.get(id)) ?? current;

  let result: OwnerNotificationDeliveryResult;
  try {
    result = await delivery.sendOwnerNotification(current);
  } catch (error) {
    return markNotificationFailed(companyId, id, toSafeError(error), { now, repo });
  }

  if (result.status === "sent") {
    return markNotificationSent(companyId, id, { now, repo, providerMessageId: result.providerMessageId });
  }
  return markNotificationFailed(companyId, id, result.errorCode ?? result.safeError ?? "delivery_failed", { now, repo });
}

export interface DeliverBatchSummary {
  attempted: number;
  delivered: number;
  failed: number;
  results: OwnerNotification[];
}

/** Livre toutes les notifications pending d'un tenant. Best-effort, séquentiel, déterministe. */
export async function deliverPendingOwnerNotifications(
  companyId: string,
  delivery: OwnerNotificationDelivery,
  options: DeliverOptions = {},
): Promise<DeliverBatchSummary> {
  const repo = options.repo ?? getOwnerNotificationRepository();
  const pending = await listOwnerNotifications(companyId, { status: "pending", repo });
  const results: OwnerNotification[] = [];
  let delivered = 0;
  let failed = 0;
  for (const item of pending) {
    const out = await deliverPendingOwnerNotification(companyId, item.id, delivery, { now: options.now, repo });
    results.push(out);
    if (out.status === "sent") delivered += 1;
    else if (out.status === "failed") failed += 1;
  }
  return { attempted: pending.length, delivered, failed, results };
}
