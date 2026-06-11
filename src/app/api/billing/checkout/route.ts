/**
 * POST /api/billing/checkout — crée une session Stripe Checkout pour un plan.
 * Body : { planId } → { url }. 503 honnête si Stripe n'est pas configuré.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { PLANS, type PlanId } from "@/domain/billing";
import { createCheckoutSession, isStripeConfigured, stripeConfigHint } from "@/adapters/integrations/stripe";
import { clientKey, createRateLimiter, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Anti-abus de création de sessions Stripe : 10 / 10 min / client.
const limiter = createRateLimiter(10, 10 * 60_000);

export async function POST(req: Request) {
  const rl = limiter.check(clientKey(req));
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec);
  let body: { planId?: string };
  try {
    body = (await req.json()) as { planId?: string };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const planId = body.planId as PlanId;
  if (!planId || !PLANS[planId]) {
    return NextResponse.json({ error: "Plan inconnu" }, { status: 400 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: stripeConfigHint() }, { status: 503 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  // Visiteur anonyme de /pricing → tenant démo ; session connectée → son entreprise.
  const companyId = resolveCompanyId();
  try {
    const session = await createCheckoutSession(planId, companyId, origin);
    await getStore().recordAudit({
      companyId,
      actor: "stripe",
      event: "checkout_créé",
      detail: `Plan ${PLANS[planId].label} (${PLANS[planId].priceMonthlyCad} $/mois) — session ${session.id}`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
