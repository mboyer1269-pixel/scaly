/**
 * Domaine — Facturation
 * Plans, add-ons et calcul d'estimation de facture.
 * HONNÊTETÉ : les prix sont des hypothèses de travail internes (pas des données de marché).
 * Aucun paiement réel n'est branché (Stripe = P4, voir ROADMAP.md).
 */

export type PlanId = "starter" | "pro" | "premium";

export interface Plan {
  id: PlanId;
  label: string;
  priceMonthlyCad: number;
  includedMinutes: number;
  overagePerMinuteCad: number;
  maxAgents: number;
  setupFeeCad: number;
  features: string[];
}

export interface AddOn {
  id: string;
  label: string;
  priceMonthlyCad: number;
  description: string;
}

export interface UsagePeriod {
  companyId: string;
  periodLabel: string;
  minutesUsed: number;
  callsCount: number;
}

export interface InvoiceEstimate {
  planId: PlanId;
  baseCad: number;
  includedMinutes: number;
  minutesUsed: number;
  overageMinutes: number;
  overageCad: number;
  totalCad: number;
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    label: "Starter",
    priceMonthlyCad: 249,
    includedMinutes: 300,
    overagePerMinuteCad: 0.65,
    maxAgents: 1,
    setupFeeCad: 500,
    features: [
      "1 agent vocal (FR ou EN)",
      "Réception + qualification + résumé d'appel",
      "SMS de rappel d'appel manqué",
      "Tableau de bord et journaux d'appels",
    ],
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceMonthlyCad: 549,
    includedMinutes: 900,
    overagePerMinuteCad: 0.55,
    maxAgents: 2,
    setupFeeCad: 500,
    features: [
      "Tout Starter",
      "Agent bilingue (FR/EN) avec bascule fluide",
      "Prise de rendez-vous calendrier",
      "Intégration CRM + webhooks",
      "Résumé quotidien automatique",
    ],
  },
  premium: {
    id: "premium",
    label: "Premium",
    priceMonthlyCad: 1190,
    includedMinutes: 2200,
    overagePerMinuteCad: 0.45,
    maxAgents: 5,
    setupFeeCad: 0,
    features: [
      "Tout Pro",
      "Agents vocaux spécialisés par département",
      "Rapports hebdomadaires avancés",
      "Intégrations premium (Salesforce, Teams)",
      "Support prioritaire + SLA",
    ],
  },
};

export const ADD_ONS: AddOn[] = [
  { id: "agent_extra", label: "Agent vocal additionnel", priceMonthlyCad: 149, description: "Un agent spécialisé de plus (ex. urgences, SAV)" },
  { id: "integration_premium", label: "Intégration premium", priceMonthlyCad: 99, description: "Salesforce, Teams ou ERP custom" },
  { id: "rapports_avances", label: "Rapports avancés", priceMonthlyCad: 79, description: "Analyses de tendances et benchmark interne" },
];

/** Calcule une estimation de facture mensuelle (hors taxes, hors frais d'installation). */
export function computeInvoice(planId: PlanId, minutesUsed: number): InvoiceEstimate {
  const plan = PLANS[planId];
  const overageMinutes = Math.max(0, Math.ceil(minutesUsed) - plan.includedMinutes);
  const overageCad = Math.round(overageMinutes * plan.overagePerMinuteCad * 100) / 100;
  return {
    planId,
    baseCad: plan.priceMonthlyCad,
    includedMinutes: plan.includedMinutes,
    minutesUsed: Math.ceil(minutesUsed),
    overageMinutes,
    overageCad,
    totalCad: Math.round((plan.priceMonthlyCad + overageCad) * 100) / 100,
  };
}

/**
 * Modèle de coût IA interne (hypothèses documentées, à recalibrer avec des factures réelles) :
 * STT ~0,02 $/min + LLM ~0,06 $/min + TTS ~0,03 $/min ≈ 0,11 $CA/min.
 */
export const EST_AI_COST_PER_MINUTE_CAD = 0.11;
