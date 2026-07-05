/**
 * Service — compteur revenus/couts Phase 4.
 *
 * Premiere version volontairement pure : elle s'appuie sur les durees d'appel
 * connues et sur le modele de cout IA interne. Les traces provider reelles
 * arriveront via ModelUsage/LiteLLM sans changer le contrat produit.
 */
import type { Call } from "@/domain/call";
import type { RevenueCounter } from "@/domain/revenue";
import { EST_AI_COST_PER_MINUTE_CAD } from "@/domain/billing";

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function ratio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function inTrailingPeriod(call: Call, sinceMs: number): boolean {
  return new Date(call.startedAt).getTime() >= sinceMs;
}

export function computeRevenueCounter(
  calls: Call[],
  opts: { periodDays?: number; now?: Date } = {},
): RevenueCounter {
  const periodDays = opts.periodDays ?? 14;
  const now = opts.now ?? new Date();
  const sinceMs = now.getTime() - periodDays * 24 * 3600 * 1000;
  const inPeriod = calls.filter((call) => inTrailingPeriod(call, sinceMs));
  const savedCalls = inPeriod.filter((call) => call.intelligence?.saved);
  const protectedCad = savedCalls.reduce((sum, call) => sum + (call.intelligence?.estimatedValueCad ?? 0), 0);
  const protectedDeclaredCad = savedCalls
    .filter((call) => call.intelligence?.valueBasis === "montant_mentionne")
    .reduce((sum, call) => sum + (call.intelligence?.estimatedValueCad ?? 0), 0);
  const protectedEstimatedCad = Math.max(0, protectedCad - protectedDeclaredCad);
  const costedCalls = inPeriod.filter((call) => call.durationSec > 0);
  const estimatedAiMinutes = Math.round(costedCalls.reduce((sum, call) => sum + call.durationSec / 60, 0) * 100) / 100;
  const estimatedAiCostCad = money(estimatedAiMinutes * EST_AI_COST_PER_MINUTE_CAD);
  const estimatedMarginCad = money(protectedCad - estimatedAiCostCad);

  return {
    periodDays,
    protectedCad: money(protectedCad),
    protectedDeclaredCad: money(protectedDeclaredCad),
    protectedEstimatedCad: money(protectedEstimatedCad),
    estimatedAiMinutes,
    estimatedAiCostCad,
    estimatedMarginCad,
    estimatedMarginRate: protectedCad > 0 ? ratio(estimatedMarginCad / protectedCad) : null,
    costPerProtectedDollarCad: protectedCad > 0 ? ratio(estimatedAiCostCad / protectedCad) : null,
    costedCallsCount: costedCalls.length,
    assumption: `Proxy de cout IA a ${EST_AI_COST_PER_MINUTE_CAD.toFixed(2)} $CA/min sur les appels avec duree connue; remplacable par ModelUsage provider reel.`,
  };
}
