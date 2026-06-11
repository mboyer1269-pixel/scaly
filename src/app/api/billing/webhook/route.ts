/**
 * POST /api/billing/webhook — webhook Stripe signé.
 * Vérifie Stripe-Signature (HMAC, STRIPE_WEBHOOK_SECRET) sur le corps BRUT,
 * traduit l'événement en patch de Company (plan + état d'abonnement) et trace
 * chaque changement dans l'audit. Seule cette route écrit `company.billing`.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { interpretStripeEvent, mergeBilling, verifyStripeSignature, type StripeEvent } from "@/adapters/integrations/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET non configuré — webhook refusé." }, { status: 503 });
  }
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Signature Stripe invalide" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const update = interpretStripeEvent(event);
  if (!update) return NextResponse.json({ received: true, ignored: event.type });

  const store = getStore();
  const company = await store.getCompany(DEFAULT_COMPANY_ID);
  if (!company) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });

  await store.updateCompany(DEFAULT_COMPANY_ID, {
    ...(update.planId ? { planId: update.planId } : {}),
    billing: mergeBilling(company.billing, update),
  });
  await store.recordAudit({
    companyId: DEFAULT_COMPANY_ID,
    actor: "stripe",
    event: "abonnement_mis_à_jour",
    detail: update.auditDetail,
  });

  return NextResponse.json({ received: true });
}
