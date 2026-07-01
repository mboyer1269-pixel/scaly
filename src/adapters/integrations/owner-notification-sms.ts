/**
 * Adapter — Livraison SMS des notifications propriétaire (Twilio réel).
 *
 * Implémente le port `OwnerNotificationDelivery` (PR #26) en réutilisant
 * `sendSms` existant (API REST Twilio, sans SDK). Le destinataire est le
 * PROPRIÉTAIRE lui-même (`transferPhone`) : aucun enjeu de consentement client.
 * `send`/`configured` sont injectables pour tester sans aucun appel réseau.
 */
import type { OwnerNotification } from "@/domain/owner-notification";
import type {
  OwnerNotificationDelivery,
  OwnerNotificationDeliveryResult,
} from "@/services/owner-notification-delivery";
import { toSafeError } from "@/services/owner-notification-delivery";
import { isSmsConfigured, sendSms } from "./twilio-sms";

export interface TwilioOwnerDeliveryDeps {
  /** Numéro du propriétaire (company.transferPhone). */
  to: string;
  send?: (to: string, body: string) => Promise<{ sid: string }>;
  configured?: () => boolean;
}

/** SMS sobre, borné, sans donnée sensible superflue. */
export function ownerNotificationSmsBody(notification: OwnerNotification): string {
  return `Allô Maude — ${notification.title}. ${notification.summary} À faire : ${notification.recommendedAction}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 480);
}

export class TwilioOwnerNotificationDelivery implements OwnerNotificationDelivery {
  constructor(private readonly deps: TwilioOwnerDeliveryDeps) {}

  async sendOwnerNotification(notification: OwnerNotification): Promise<OwnerNotificationDeliveryResult> {
    const configured = this.deps.configured ?? isSmsConfigured;
    if (!configured()) {
      return { status: "failed", errorCode: "sms_not_configured", safeError: "Twilio non configuré — aucun SMS envoyé." };
    }
    if (!this.deps.to) {
      return { status: "failed", errorCode: "no_owner_number", safeError: "Aucun numéro propriétaire configuré." };
    }
    const send = this.deps.send ?? sendSms;
    try {
      const result = await send(this.deps.to, ownerNotificationSmsBody(notification));
      return { status: "sent", providerMessageId: result.sid };
    } catch (error) {
      return { status: "failed", errorCode: "provider_error", safeError: toSafeError(error) };
    }
  }
}
