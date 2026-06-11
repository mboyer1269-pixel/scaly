/**
 * Auth — Clerk derrière un feature flag (P1).
 * L'auth est ACTIVE seulement si les deux clés Clerk sont présentes ; sinon
 * l'app tourne ouverte (dev/démo locale) et /status l'affiche honnêtement.
 *
 * RBAC : le rôle vit dans publicMetadata.role côté Clerk (founder | owner | staff)
 * et doit être exposé dans le session token via la personnalisation Clerk :
 *   Dashboard → Sessions → Customize session token → { "metadata": "{{user.public_metadata}}" }
 * Sans claim explicite, le rôle par défaut est "owner" (jamais founder par défaut).
 */
import { auth } from "@clerk/nextjs/server";

export type ScalyRole = "founder" | "owner" | "staff";

export function isAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

interface RoleClaims {
  metadata?: { role?: string };
  publicMetadata?: { role?: string };
}

export function roleFromSessionClaims(claims: unknown): ScalyRole {
  const c = (claims ?? {}) as RoleClaims;
  const role = c.metadata?.role ?? c.publicMetadata?.role;
  return role === "founder" || role === "staff" ? role : "owner";
}

/** Rôle de la session courante. "owner" par défaut quand l'auth est désactivée (dev local). */
export function getSessionRole(): ScalyRole {
  if (!isAuthEnabled()) return "owner";
  const { sessionClaims } = auth();
  return roleFromSessionClaims(sessionClaims);
}
