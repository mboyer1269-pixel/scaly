/**
 * POST /api/billing/portal — session de portail client Stripe (gérer ou
 * annuler son abonnement). 503 sans Stripe ; 409 si aucun abonnement connu.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { createPortalSession, isStripeConfigured, stripeConfigHint } from "@/adapters/integrations/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: stripeConfigHint() }, { status: 503 });
  }
  const company = await getStore().getCompany(DEFAULT_COMPANY_ID);
  const customerId = company?.billing?.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json({ error: "Aucun abonnement Stripe connu pour cette entreprise — passez d'abord par la page Prix." }, { status: 409 });
  }
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  try {
    const session = await createPortalSession(customerId, `${origin}/settings`);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
