import { describe, expect, it } from "vitest";
import type { OwnerNotification } from "@/domain/owner-notification";
import {
  TwilioOwnerNotificationDelivery,
  ownerNotificationSmsBody,
} from "@/adapters/integrations/owner-notification-sms";

const NOW = "2026-07-01T12:00:00.000Z";

function notification(over: Partial<OwnerNotification> = {}): OwnerNotification {
  return {
    id: "ownernote_1",
    companyId: "comp_test",
    type: "post_call_summary",
    status: "pending",
    title: "Récapitulatif d'appel",
    summary: "Client veut une soumission de toiture.",
    recommendedAction: "Rappeler pour confirmer la disponibilité.",
    urgency: "haute",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe("ownerNotificationSmsBody", () => {
  it("compose un SMS sobre et borné", () => {
    const body = ownerNotificationSmsBody(notification());
    expect(body).toContain("Allô Maude");
    expect(body).toContain("Récapitulatif d'appel");
    expect(body).toContain("À faire :");
    expect(body.length).toBeLessThanOrEqual(480);
  });
});

describe("TwilioOwnerNotificationDelivery", () => {
  it("envoie via le port injecté et retourne le SID provider", async () => {
    let captured: { to: string; body: string } | null = null;
    const delivery = new TwilioOwnerNotificationDelivery({
      to: "514-555-0001",
      configured: () => true,
      send: async (to, body) => {
        captured = { to, body };
        return { sid: "SM_test_123" };
      },
    });

    const result = await delivery.sendOwnerNotification(notification());

    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBe("SM_test_123");
    expect(captured).not.toBeNull();
    expect(captured!.to).toBe("514-555-0001");
  });

  it("échoue proprement quand Twilio n'est pas configuré (aucun envoi)", async () => {
    let called = false;
    const delivery = new TwilioOwnerNotificationDelivery({
      to: "514-555-0001",
      configured: () => false,
      send: async () => {
        called = true;
        return { sid: "x" };
      },
    });

    const result = await delivery.sendOwnerNotification(notification());

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("sms_not_configured");
    expect(called).toBe(false);
  });

  it("échoue avec no_owner_number si le destinataire est vide", async () => {
    const delivery = new TwilioOwnerNotificationDelivery({ to: "", configured: () => true, send: async () => ({ sid: "x" }) });
    const result = await delivery.sendOwnerNotification(notification());
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("no_owner_number");
  });

  it("caviarde l'erreur provider (aucun secret propagé)", async () => {
    const token = ["sk", "leak987"].join("-");
    const email = ["owner", "example.com"].join("@");
    const delivery = new TwilioOwnerNotificationDelivery({
      to: "514-555-0001",
      configured: () => true,
      send: async () => {
        throw new Error(`Twilio 401: Bearer ${token} ${email}`);
      },
    });

    const result = await delivery.sendOwnerNotification(notification());

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("provider_error");
    expect(result.safeError).not.toContain(token);
    expect(result.safeError).not.toContain(email);
  });
});
