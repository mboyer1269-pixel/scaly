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
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { roleFromSessionClaims } from "@/server/auth";
import { authRuntimeMode, shouldBlockWithoutAuthConfig } from "@/server/auth-policy";

const isPublicRoute = createRouteMatcher([
  "/",
  "/allo-maude(.*)",
  "/privacy/delete-account(.*)",
  "/pricing(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
  "/api/cron/(.*)",
  "/api/billing/webhook(.*)",
  "/api/billing/checkout(.*)",
  "/api/mobile/(.*)",
  "/api/sms/incoming(.*)",
  "/api/voice/(.*)",
]);
const isFounderRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)", "/status(.*)"]);

const authMode = authRuntimeMode();

export default authMode.mode === "clerk"
  ? clerkMiddleware(async (auth, req) => {
      if (isPublicRoute(req)) return;
      await auth.protect();
      const { sessionClaims } = await auth();
      if (isFounderRoute(req) && roleFromSessionClaims(sessionClaims) !== "founder") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    })
  : function middleware(req: NextRequest) {
      if (shouldBlockWithoutAuthConfig(process.env, isPublicRoute(req))) {
        return new NextResponse("Allô Maude: authentification requise, mais Clerk n'est pas configuré.", {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3|m4a|wav|ogg|aac)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
