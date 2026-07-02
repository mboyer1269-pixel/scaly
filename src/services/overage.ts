/**
 * Service — Alertes de dépassement de minutes (P4). Fonctions PURES.
 *
 * L'usage du mois = minutes FACTURABLES (spam exclu — services/usage.ts),
 * exactement ce que la facture compterait : l'alerte et la facture ne
 * divergent jamais.
 *
 * Deux seuils, une seule alerte par seuil et par mois (dédupliquée via
 * l'audit trail) : 80 % « approche » et 100 % « dépassé » avec l'estimation
 * du coût excédentaire au tarif publié. Même tuyau SMS que le pouls.
 */
import type { Call } from "@/domain/call";
import type { Company } from "@/domain/company";
import type { ComplianceAuditEntry } from "@/server/store";
import { computeInvoice, PLANS } from "@/domain/billing";
import { computeMonthUsage } from "@/services/usage";

export const OVERAGE_AUDIT_EVENT = "alerte_dépassement";
export const APPROACH_RATIO = 0.8;

export interface OverageAlert {
  level: "approche" | "depasse";
  periodLabel: string; // "2026-06"
  minutesUsed: number;
  includedMinutes: number;
  smsText: string;
}

export function monthPeriodLabel(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Alerte à émettre pour ce mois (minutes FACTURABLES), ou null sous le seuil d'approche. */
export function buildOverageAlert(company: Company, calls: Call[], now = new Date()): OverageAlert | null {
  const plan = PLANS[company.planId];
  const minutesUsed = computeMonthUsage(calls, now).billableMinutes;
  if (minutesUsed < plan.includedMinutes * APPROACH_RATIO) return null;

  const periodLabel = monthPeriodLabel(now);
  if (minutesUsed >= plan.includedMinutes) {
    const invoice = computeInvoice(company.planId, minutesUsed);
    return {
      level: "depasse",
      periodLabel,
      minutesUsed: Math.ceil(minutesUsed),
      includedMinutes: plan.includedMinutes,
      smsText:
        `Allô Maude — minutes du mois dépassées : ${Math.ceil(minutesUsed)}/${plan.includedMinutes} min (plan ${plan.label}). ` +
        `Excédent estimé : ${invoice.overageCad.toFixed(2).replace(".", ",")} $ au tarif publié (${plan.overagePerMinuteCad.toFixed(2).replace(".", ",")} $/min). ` +
        `Aucune coupure de service. Détails : votre tableau de bord.`,
    };
  }
  return {
    level: "approche",
    periodLabel,
    minutesUsed: Math.ceil(minutesUsed),
    includedMinutes: plan.includedMinutes,
    smsText:
      `Allô Maude — vous approchez de vos minutes incluses : ${Math.ceil(minutesUsed)}/${plan.includedMinutes} min (plan ${plan.label}). ` +
      `Au-delà : ${plan.overagePerMinuteCad.toFixed(2).replace(".", ",")} $/min, aucune coupure de service.`,
  };
}

export type OverageAuditStatus = "envoye" | "journalise" | "echec";

/**
 * Vrai si cette alerte (même mois, même seuil) figure déjà dans l'audit avec
 * un statut terminal — un ÉCHEC d'envoi ne compte pas : on retente au
 * prochain passage du cron.
 */
export function alertAlreadySent(audit: ComplianceAuditEntry[], companyId: string, alert: OverageAlert): boolean {
  const marker = `${alert.periodLabel} · ${alert.level}`;
  return audit.some(
    (e) => e.companyId === companyId && e.event === OVERAGE_AUDIT_EVENT && !!e.detail?.includes(marker) && !e.detail.includes("ÉCHEC"),
  );
}

/** Détail d'audit — contient le marqueur exact utilisé par alertAlreadySent. */
export function overageAuditDetail(alert: OverageAlert, status: OverageAuditStatus): string {
  const label =
    status === "envoye"
      ? "SMS ENVOYÉ"
      : status === "journalise"
        ? "JOURNALISÉ (Twilio non configuré)"
        : "ÉCHEC SMS — nouvelle tentative au prochain passage";
  return `${alert.periodLabel} · ${alert.level} · ${alert.minutesUsed}/${alert.includedMinutes} min · ${label}`;
}
