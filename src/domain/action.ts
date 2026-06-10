/**
 * Domaine — Action Engine
 * Toute conséquence d'un appel (SMS, tâche, lead CRM, événement calendrier, webhook…)
 * est une ScalyAction traçable avec audit trail. Les exécuteurs sont mockés (executor: "mock"),
 * l'architecture est prête pour des exécuteurs réels (executor: "real" → requires_config tant
 * que l'intégration n'est pas branchée).
 */

export type ActionType =
  | "send_sms"
  | "send_email"
  | "create_task"
  | "create_crm_lead"
  | "create_calendar_event"
  | "send_webhook"
  | "transfer_call"
  | "notify_owner"
  | "daily_digest"
  | "weekly_report";

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  send_sms: "Envoyer un SMS",
  send_email: "Envoyer un courriel",
  create_task: "Créer une tâche",
  create_crm_lead: "Créer un lead CRM",
  create_calendar_event: "Créer un événement calendrier",
  send_webhook: "Envoyer un webhook",
  transfer_call: "Transférer l'appel",
  notify_owner: "Notifier le propriétaire",
  daily_digest: "Résumé quotidien",
  weekly_report: "Rapport hebdomadaire",
};

export type ActionStatus =
  | "pending"
  | "executing"
  | "succeeded"
  | "failed"
  | "requires_config"
  | "cancelled";

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  pending: "En attente",
  executing: "En cours",
  succeeded: "Réussie",
  failed: "Échouée",
  requires_config: "Config. requise",
  cancelled: "Annulée",
};

export interface AuditEntry {
  at: string; // ISO
  event: string;
  detail?: string;
}

export interface ScalyAction {
  id: string;
  companyId: string;
  callId?: string;
  type: ActionType;
  title: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  attempts: number;
  lastError?: string;
  /** "mock" = simulé et journalisé. "real" = nécessite une intégration configurée. */
  executor: "mock" | "real";
  executedAt?: string;
  createdAt: string;
  audit: AuditEntry[];
}
