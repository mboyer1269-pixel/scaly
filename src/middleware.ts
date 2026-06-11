/**
 * Middleware — protection Clerk (active seulement si les clés sont présentes).
 * - Public : accueil, prix, sign-in/up, /api/health (uptime monitoring), crons
 *   (Bearer CRON_SECRET dans la route), webhooks externes qui s'auto-protègent
 *   par signature (Stripe HMAC, Twilio) — un webhook ne peut PAS porter de
 *   session Clerk, le bloquer ici casserait la téléphonie et la facturation.
 *   /api/billing/checkout est public (rate-limité) : c'est le funnel de /pricing.
 * - Réservé au rôle founder : /admin, /api/admin, /status.
 * - Tout le reste exige une session.
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { roleFromSessionClaims } from "@/server/auth";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
  "/api/cron/(.*)",
  "/api/billing/webhook(.*)",
  "/api/billing/checkout(.*)",
  "/api/sms/incoming(.*)",
  "/api/voice/(.*)",
]);
const isFounderRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)", "/status(.*)"]);

const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default authEnabled
  ? clerkMiddleware((auth, req) => {
      if (isPublicRoute(req)) return;
      auth().protect();
      if (isFounderRoute(req) && roleFromSessionClaims(auth().sessionClaims) !== "founder") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    })
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
