/**
 * Domaine — Analytics & intelligence stratégique
 * Structures des agrégats du dashboard PME et du cockpit admin/fondateur.
 */
import type { Call, Intent } from "./call";
import type { ScalyAction } from "./action";
import type { Company } from "./company";
import type { InvoiceEstimate } from "./billing";

export interface DayBucket {
  date: string; // "2026-06-09"
  total: number;
  missed: number;
}

export interface StrategicInsight {
  id: string;
  kind: "opportunite" | "risque" | "tendance" | "objection" | "recommandation";
  title: string;
  detail: string;
  impactCad?: number;
  callIds: string[];
}

export interface DashboardData {
  periodDays: number;
  callsTotal: number;
  answeredByAi: number;
  missed: number;
  transferred: number;
  urgentOpen: number;
  savedCount: number;
  savedValueCad: number;
  missedValueAtRiskCad: number;
  pipelineValueCad: number;
  avgDurationSec: number;
  byDay: DayBucket[];
  byIntent: { intent: Intent; count: number }[];
  hotOpportunities: Call[];
  atRiskCalls: Call[];
  recentCalls: Call[];
  pendingActions: ScalyAction[];
  insights: StrategicInsight[];
}

/**
 * File de sauvetage (« missed-call rescue ») — le cœur opérationnel du wedge :
 * chaque appel manqué non récupéré est une perte qui se joue en minutes
 * (« speed to lead » : la majorité des clients achètent du premier répondant).
 */
export type RescueWindow = "fenetre_critique" | "encore_chaud" | "refroidi";

export interface RescueEntry {
  call: Call;
  minutesSinceCall: number;
  window: RescueWindow;
  valueAtRiskCad: number;
  /** Un SMS de rappel automatique est déjà planifié/parti pour cet appel. */
  smsPlanned: boolean;
  /** Prochaine action recommandée, en clair. */
  suggested: string;
}

/** Le ROI en une phrase : ce que Scaly coûte vs ce qu'il protège. */
export interface RoiSnapshot {
  periodDays: number;
  planPriceCad: number;
  /** Valeur des appels qui auraient été perdus sans Scaly (sauvés). */
  protectedCad: number;
  wouldBeLostCount: number;
  /** Valeur encore à risque (manqués non récupérés). */
  atRiskCad: number;
  atRiskCount: number;
  /** protectedCad / prix du plan — l'argument de renouvellement. */
  multiple: number | null;
  /** Appels servis en anglais — la preuve bilingue chiffrée. */
  enCallsCount: number;
}

export interface ProviderHealth {
  name: string;
  status: "operationnel" | "non_configure" | "degrade";
  note: string;
}

export interface AdminIncident {
  id: string;
  at: string;
  severity: "mineur" | "majeur";
  title: string;
  status: "ouvert" | "resolu";
}

export interface AdminCompanyRow {
  company: Company;
  calls14d: number;
  minutes: number;
  estAiCostCad: number;
  planPriceCad: number;
  estMarginCad: number;
  invoice: InvoiceEstimate;
}

export interface AdminOverview {
  mrrCad: number;
  totalMinutes: number;
  totalAiCostCad: number;
  grossMarginCad: number;
  rows: AdminCompanyRow[];
  providerHealth: ProviderHealth[];
  incidents: AdminIncident[];
}
