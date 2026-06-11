import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildCheckoutParams,
  interpretStripeEvent,
  mergeBilling,
  verifyStripeSignature,
  type StripeEvent,
} from "@/adapters/integrations/stripe";
import { PLANS } from "@/domain/billing";

const SECRET = "whsec_test_123";

function sign(payload: string, t: number, secret = SECRET): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("verifyStripeSignature", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "x" });
  const NOW = 1_750_000_000;

  it("accepte une signature valide dans la fenêtre de tolérance", () => {
    expect(verifyStripeSignature(payload, sign(payload, NOW - 60), SECRET, NOW)).toBe(true);
  });

  it("refuse un corps altéré, un mauvais secret et une signature absente", () => {
    expect(verifyStripeSignature(payload + " ", sign(payload, NOW), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(payload, sign(payload, NOW, "whsec_autre"), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(payload, null, SECRET, NOW)).toBe(false);
  });

  it("refuse un horodatage trop vieux (rejeu)", () => {
    expect(verifyStripeSignature(payload, sign(payload, NOW - 3600), SECRET, NOW)).toBe(false);
  });
});

describe("buildCheckoutParams", () => {
  it("construit l'abonnement mensuel en cents CAD avec frais d'installation", () => {
    const p = buildCheckoutParams("starter", "comp_belair", "https://scaly.ca");
    expect(p.get("mode")).toBe("subscription");
    expect(p.get("line_items[0][price_data][unit_amount]")).toBe(String(PLANS.starter.priceMonthlyCad * 100));
    expect(p.get("line_items[0][price_data][recurring][interval]")).toBe("month");
    expect(p.get("line_items[1][price_data][unit_amount]")).toBe(String(PLANS.starter.setupFeeCad * 100));
    expect(p.get("line_items[1][price_data][recurring][interval]")).toBeNull(); // frais une fois, pas récurrents
    expect(p.get("metadata[planId]")).toBe("starter");
    expect(p.get("success_url")).toBe("https://scaly.ca/settings?billing=success");
  });

  it("omet les frais d'installation quand le plan n'en a pas (premium)", () => {
    const p = buildCheckoutParams("premium", "comp_belair", "https://scaly.ca");
    expect(PLANS.premium.setupFeeCad).toBe(0);
    expect(p.get("line_items[1][quantity]")).toBeNull();
  });
});

describe("interpretStripeEvent", () => {
  function evt(type: string, object: Record<string, unknown>): StripeEvent {
    return { id: "evt_test", type, data: { object } };
  }

  it("checkout.session.completed → plan + ids client/abonnement, statut actif, tenant des métadonnées", () => {
    const u = interpretStripeEvent(
      evt("checkout.session.completed", { customer: "cus_1", subscription: "sub_1", metadata: { planId: "pro", companyId: "comp_belair" } }),
    );
    expect(u?.planId).toBe("pro");
    expect(u?.companyId).toBe("comp_belair");
    expect(u?.billing).toMatchObject({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" });
  });

  it("résout le tenant via client_reference_id quand metadata est vide, undefined sinon", () => {
    const u = interpretStripeEvent(evt("checkout.session.completed", { customer: "cus_1", client_reference_id: "comp_rivnord", metadata: {} }));
    expect(u?.companyId).toBe("comp_rivnord");
    const v = interpretStripeEvent(evt("customer.subscription.updated", { status: "active", metadata: {} }));
    expect(v?.companyId).toBeUndefined(); // le webhook retombe alors sur le tenant démo
  });

  it("ignore un planId inconnu plutôt que de corrompre le plan", () => {
    const u = interpretStripeEvent(evt("checkout.session.completed", { customer: "cus_1", metadata: { planId: "diamant" } }));
    expect(u?.planId).toBeUndefined();
  });

  it("subscription.updated → statut + fin de période ISO", () => {
    const u = interpretStripeEvent(evt("customer.subscription.updated", { status: "past_due", current_period_end: 1_760_000_000, metadata: {} }));
    expect(u?.billing.subscriptionStatus).toBe("past_due");
    expect(u?.billing.currentPeriodEnd).toBe(new Date(1_760_000_000 * 1000).toISOString());
  });

  it("subscription.deleted → statut canceled ; événement inconnu → null", () => {
    expect(interpretStripeEvent(evt("customer.subscription.deleted", {}))?.billing.subscriptionStatus).toBe("canceled");
    expect(interpretStripeEvent(evt("invoice.paid", {}))).toBeNull();
  });
});

describe("mergeBilling", () => {
  it("fusionne sans écraser les champs existants par des undefined", () => {
    const merged = mergeBilling(
      { stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" },
      { billing: { subscriptionStatus: "past_due", currentPeriodEnd: "2026-07-01T00:00:00.000Z" }, auditDetail: "x" },
    );
    expect(merged).toEqual({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      subscriptionStatus: "past_due",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
    });
  });
});
