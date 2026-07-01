/**
 * Domaine — compteur revenus/couts Phase 4.
 * Les montants sont des estimations produit, pas de la facturation officielle.
 */

export interface RevenueCounter {
  periodDays: number;
  protectedCad: number;
  protectedDeclaredCad: number;
  protectedEstimatedCad: number;
  estimatedAiMinutes: number;
  estimatedAiCostCad: number;
  estimatedMarginCad: number;
  estimatedMarginRate: number | null;
  costPerProtectedDollarCad: number | null;
  costedCallsCount: number;
  assumption: string;
}
