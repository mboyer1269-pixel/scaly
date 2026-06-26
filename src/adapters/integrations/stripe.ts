/**
 * Adapter — Stripe (abonnements), sans SDK (API REST + fetch), même contrat
 * d'honnêteté que twilio-sms : non configuré = erreur explicite, jamais de
 * faux succès.
 *
 * Parties PURES (testées) : construction des paramètres de checkout depuis
 * domain/billing (prix inline — aucun produit à créer dans le dashboard),
 * vérification de signature webhook (HMAC SHA-256, comparaison constante),
 * interprétation des événements en patch de Company.
 *
 * Minutes excédentaires : PAS de metered billing en pilote — l'abonnement
 * couvre le mensuel fixe ; le dépassement est facturé manuellement au tarif
 * publié (décision P4, honnêtement documentée ici et dans ROADMAP.md).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { PLANS, type PlanId } from "@/domain/billing";
import type { CompanyBilling, Company } from "@/domain/company";

const STRIPE_API = "https://api.stripe.com/v1";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeConfigHint(): string {
  return isStripeConfigured()
    ? "Stripe configuré."
    : "Stripe non configuré — variable STRIPE_SECRET_KEY manquante (le paiement en ligne reste inactif).";
}

export function resolveCheckoutOrigin(
  requestUrl: string,
  _originHeader: string | null,
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env["SCALY_PUBLIC_URL"]?.trim();
  if (configured) return new URL(configured).origin;
  return new URL(requestUrl).origin;
}

// ---------------------------------------------------------------------------
// Checkout — paramètres construits depuis domain/billing (pur, testé)
// ---------------------------------------------------------------------------

/** Paramètres form-encodés d'une session Checkout d'abonnement pour un plan. */
export function buildCheckoutParams(planId: PlanId, companyId: string, origin: string): URLSearchParams {
  const plan = PLANS[planId];
  const p = new URLSearchParams();
  p.set("mode", "subscription");
  p.set("currency", "cad");
  p.set("client_reference_id", companyId);
  p.set("success_url", `${origin}/settings?billing=success`);
  p.set("cancel_url", `${origin}/pricing?billing=cancelled`);
  p.set("metadata[companyId]", companyId);
  p.set("metadata[planId]", planId);
  p.set("subscription_data[metadata][companyId]", companyId);
  p.set("subscription_data[metadata][planId]", planId);

  // Abonnement mensuel — prix inline, en cents CAD.
  p.set("line_items[0][quantity]", "1");
  p.set("line_items[0][price_data][currency]", "cad");
  p.set("line_items[0][price_data][unit_amount]", String(plan.priceMonthlyCad * 100));
  p.set("line_items[0][price_data][recurring][interval]", "month");
  p.set("line_items[0][price_data][product_data][name]", `Allô Maude ${plan.label} — ${plan.includedMinutes} min/mois`);

  // Frais d'installation — article unique, seulement si le plan en a.
  if (plan.setupFeeCad > 0) {
    p.set("line_items[1][quantity]", "1");
    p.set("line_items[1][price_data][currency]", "cad");
    p.set("line_items[1][price_data][unit_amount]", String(plan.setupFeeCad * 100));
    p.set("line_items[1][price_data][product_data][name]", "Allô Maude — installation et configuration (une fois)");
  }
  return p;
}

async function stripePost<T>(path: string, params: URLSearchParams): Promise<T> {
  if (!isStripeConfigured()) throw new Error(stripeConfigHint());
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Stripe ${res.status} : ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Crée une session Checkout et retourne son URL de paiement. */
export async function createCheckoutSession(planId: PlanId, companyId: string, origin: string): Promise<{ id: string; url: string }> {
  return stripePost("/checkout/sessions", buildCheckoutParams(planId, companyId, origin));
}

/** Crée une session de portail client (gestion/annulation d'abonnement). */
export async function createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
  const p = new URLSearchParams({ customer: customerId, return_url: returnUrl });
  return stripePost("/billing_portal/sessions", p);
}

// ---------------------------------------------------------------------------
// Webhook — signature et interprétation (pur, testé)
// ---------------------------------------------------------------------------

/**
 * Vérifie l'en-tête Stripe-Signature (`t=…,v1=…`) contre le corps brut.
 * `nowSec` injectable pour les tests ; tolérance par défaut 5 minutes.
 */
export function verifyStripeSignature(
  payload: string,
  sigHeader: string | null,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): boolean {
  if (!sigHeader) return false;
  const parts = new Map(sigHeader.split(",").map((kv) => kv.split("=", 2) as [string, string]));
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1 || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(v1, "hex");
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface BillingUpdate {
  /** Tenant ciblé — métadonnées posées au checkout (metadata + subscription_data.metadata). */
  companyId?: string;
  planId?: PlanId;
  billing: Partial<CompanyBilling>;
  auditDetail: string;
}

/** Traduit un événement Stripe en patch de Company. Null = événement ignoré. */
export function interpretStripeEvent(event: StripeEvent): BillingUpdate | null {
  const obj = event.data.object;
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const companyId =
    (typeof meta.companyId === "string" && meta.companyId) ||
    (typeof obj.client_reference_id === "string" && obj.client_reference_id) ||
    undefined;

  if (event.type === "checkout.session.completed") {
    const planId = meta.planId as PlanId | undefined;
    return {
      companyId,
      planId: planId && PLANS[planId] ? planId : undefined,
      billing: {
        stripeCustomerId: typeof obj.customer === "string" ? obj.customer : undefined,
        stripeSubscriptionId: typeof obj.subscription === "string" ? obj.subscription : undefined,
        subscriptionStatus: "active",
      },
      auditDetail: `Checkout complété (${event.id}) — plan ${planId ?? "inconnu"}, client ${obj.customer}`,
    };
  }

  if (event.type === "customer.subscription.updated") {
    const planId = meta.planId as PlanId | undefined;
    const periodEnd = typeof obj.current_period_end === "number" ? new Date(obj.current_period_end * 1000).toISOString() : undefined;
    return {
      companyId,
      planId: planId && PLANS[planId] ? planId : undefined,
      billing: {
        subscriptionStatus: typeof obj.status === "string" ? obj.status : undefined,
        currentPeriodEnd: periodEnd,
      },
      auditDetail: `Abonnement mis à jour (${event.id}) — statut ${obj.status}`,
    };
  }

  if (event.type === "customer.subscription.deleted") {
    return {
      companyId,
      billing: { subscriptionStatus: "canceled" },
      auditDetail: `Abonnement annulé (${event.id})`,
    };
  }

  return null;
}

/** Fusionne un BillingUpdate dans l'état billing existant (pur). */
export function mergeBilling(existing: Company["billing"], update: BillingUpdate): CompanyBilling {
  const merged: CompanyBilling = { ...existing };
  for (const [k, v] of Object.entries(update.billing)) {
    if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}
