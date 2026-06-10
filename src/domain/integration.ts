/**
 * Domaine — Integrations Hub
 * Registre déclaratif des intégrations : statut honnête (mock fonctionnel vs planifié),
 * capacités et phase de roadmap. Les adapters vivent dans src/adapters/integrations.
 */

export type IntegrationCategory =
  | "calendrier"
  | "crm"
  | "courriel"
  | "sms"
  | "paiement"
  | "automatisation"
  | "communication";

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  calendrier: "Calendrier",
  crm: "CRM",
  courriel: "Courriel",
  sms: "SMS",
  paiement: "Paiement",
  automatisation: "Automatisation",
  communication: "Communication interne",
};

export type IntegrationStatus = "mock_fonctionnel" | "planifie";

export interface IntegrationDef {
  id: string;
  label: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  capabilities: string[];
  phase: "P1" | "P2" | "P3";
}
