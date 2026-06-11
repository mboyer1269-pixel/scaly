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
import { isAuthEnabled } from "./auth";
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

/** Id d'entreprise de la session courante ; tenant démo sans auth ou sans claim. */
export function resolveCompanyId(): string {
  if (!isAuthEnabled()) return DEFAULT_COMPANY_ID;
  const { sessionClaims } = auth();
  return companyIdFromSessionClaims(sessionClaims) ?? DEFAULT_COMPANY_ID;
}

/** Entreprise de la session courante (undefined si l'id mappé n'existe pas en base). */
export async function resolveCompany(): Promise<Company | undefined> {
  return getStore().getCompany(resolveCompanyId());
}
