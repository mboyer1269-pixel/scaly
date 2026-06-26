/**
 * Tenant — résolution de l'entreprise de la session courante (ADR-017).
 *
 * Mapping : Clerk `publicMetadata.companyId`, exposé dans le session token via
 * le même claim `metadata` que le rôle (ADR-013). Sans auth active, sans
 * session ou sans claim → tenant démo (DEFAULT_COMPANY_ID), honnêtement.
 *
 * RÈGLE : toute route/page DE SESSION passe par ici — plus jamais
 * DEFAULT_COMPANY_ID en dur côté session. Les webhooks et crons n'ont PAS de
 * session et ne passent JAMAIS par ici : ils résolvent leur tenant par leur
 * propre canal (métadonnées d'événement Stripe, numéro de téléphone à terme,
 * itération sur toutes les compagnies pour les crons).
 */
import { auth } from "@clerk/nextjs/server";
import type { Company } from "@/domain/company";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { isAuthEnabled, roleFromSessionClaims } from "./auth";
import { getStore } from "./store";

interface CompanyClaims {
  metadata?: { companyId?: unknown };
  publicMetadata?: { companyId?: unknown };
}

/** Extrait le companyId des claims de session (pur, testé). Null si absent. */
export function companyIdFromSessionClaims(claims: unknown): string | null {
  const c = (claims ?? {}) as CompanyClaims;
  const id = c.metadata?.companyId ?? c.publicMetadata?.companyId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** D'où vient le tenant résolu — pour ne JAMAIS retomber silencieusement sur la démo. */
export type TenantSource = "claim" | "demo-fallback" | "no-auth";

export interface ResolvedTenant {
  companyId: string;
  source: TenantSource;
  /** true si le repli démo est DANGEREUX et doit être signalé (ADR-019). */
  warn: boolean;
}

/**
 * Décision de tenant, PURE et testée (ADR-019).
 *
 * Le piège fermé ici : auth ACTIVE + utilisateur connecté SANS companyId dans
 * ses claims. L'ancien code retombait silencieusement sur DEFAULT_COMPANY_ID —
 * un non-founder voyait/éditait alors les données du tenant démo (ou pire, d'un
 * pilote). On le signale (warn=true) pour un non-founder ; le founder utilise la
 * démo par conception (ADR-017), donc pas d'alarme pour lui.
 */
export function decideTenant(authEnabled: boolean, claims: unknown): ResolvedTenant {
  if (!authEnabled) return { companyId: DEFAULT_COMPANY_ID, source: "no-auth", warn: false };
  const claimed = companyIdFromSessionClaims(claims);
  if (claimed) return { companyId: claimed, source: "claim", warn: false };
  const role = roleFromSessionClaims(claims);
  return { companyId: DEFAULT_COMPANY_ID, source: "demo-fallback", warn: role !== "founder" };
}

/** Tenant de la session courante, avec sa provenance. Émet un avertissement si le repli est dangereux. */
export async function resolveTenant(): Promise<ResolvedTenant> {
  if (!isAuthEnabled()) return { companyId: DEFAULT_COMPANY_ID, source: "no-auth", warn: false };
  const { sessionClaims } = await auth();
  const decision = decideTenant(true, sessionClaims);
  if (decision.warn) {
    // Jamais silencieux : config incomplète d'un vrai utilisateur, à corriger
    // (poser publicMetadata.companyId — ADR-017), pas un tenant légitime.
    console.warn(
      `[tenant] Auth active mais session sans companyId — repli sur le tenant démo (${DEFAULT_COMPANY_ID}). ` +
        `Poser publicMetadata.companyId sur l'utilisateur (ADR-017).`,
    );
  }
  return decision;
}

/** Id d'entreprise de la session courante ; tenant démo sans auth ou sans claim (repli signalé). */
export async function resolveCompanyId(): Promise<string> {
  return (await resolveTenant()).companyId;
}

/** Entreprise de la session courante (undefined si l'id mappé n'existe pas en base). */
export async function resolveCompany(): Promise<Company | undefined> {
  return getStore().getCompany(await resolveCompanyId());
}
