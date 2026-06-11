/**
 * Service — Usage facturable du mois (P4, « la facture est vraie »). PUR.
 *
 * C'est ici que les engagements publics de /pricing deviennent du code :
 * - « Le spam n'est jamais facturé » : un appel classé spam (intent `spam` ou
 *   statut final `ignore_spam`) est EXCLU des minutes facturables — et le
 *   temps épargné est affiché au propriétaire, pas seulement retiré.
 * - « Arrondi sur le mois, pas par appel » : les secondes s'additionnent sur
 *   le mois civil ; computeInvoice arrondit UNE fois le total.
 *
 * Un appel sans analyse compte comme facturable : il a réellement consommé
 * des minutes. Le spam doit être DÉTECTÉ pour être offert — jamais l'inverse.
 */
import type { Call } from "@/domain/call";
import type { PlanId } from "@/domain/billing";
import { computeInvoice, type InvoiceEstimate } from "@/domain/billing";

export interface MonthUsage {
  periodLabel: string; // "2026-06"
  billableMinutes: number; // exact, non arrondi (l'arrondi appartient à la facture)
  spamMinutes: number;
  billableCalls: number;
  spamCalls: number;
}

/** Faux si l'appel est du spam détecté — il ne sera pas facturé. */
export function isBillableCall(call: Call): boolean {
  const intel = call.intelligence;
  if (!intel) return true;
  return intel.intent !== "spam" && intel.finalStatus !== "ignore_spam";
}

/** Usage du mois civil de `now` : facturable d'un côté, spam offert de l'autre. */
export function computeMonthUsage(calls: Call[], now: Date): MonthUsage {
  let billableSec = 0;
  let spamSec = 0;
  let billableCalls = 0;
  let spamCalls = 0;
  for (const call of calls) {
    const at = new Date(call.startedAt);
    if (at.getFullYear() !== now.getFullYear() || at.getMonth() !== now.getMonth()) continue;
    if (isBillableCall(call)) {
      billableSec += call.durationSec;
      billableCalls += 1;
    } else {
      spamSec += call.durationSec;
      spamCalls += 1;
    }
  }
  return {
    periodLabel: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    billableMinutes: billableSec / 60,
    spamMinutes: spamSec / 60,
    billableCalls,
    spamCalls,
  };
}

/** Facture estimée du mois — TOUJOURS sur les minutes facturables, jamais brutes. */
export function estimateMonthInvoice(planId: PlanId, usage: MonthUsage): InvoiceEstimate {
  return computeInvoice(planId, usage.billableMinutes);
}
