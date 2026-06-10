/**
 * Adapters — Exécuteurs d'actions
 * Chaque type d'action a un exécuteur. Aujourd'hui : exécuteurs MOCK qui journalisent
 * en détail ce qu'ils AURAIENT fait (aucun SMS/courriel/événement réel n'est envoyé).
 * Les exécuteurs réels (P3) implémenteront la même interface `ActionExecutor` —
 * l'Action Engine n'aura pas à changer.
 */
import type { ActionType, ScalyAction } from "@/domain/action";

export interface ExecutorResult {
  detail: string;
}

export interface ActionExecutor {
  mode: "mock" | "real";
  /** Pour mode "real" non configuré : explique quoi brancher. */
  configHint?: string;
  run(action: ScalyAction): ExecutorResult;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v ?? "");
}

function truncate(s: string, max = 110): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const MOCK_DETAILS: Record<ActionType, (a: ScalyAction) => string> = {
  send_sms: (a) => `SMS simulé vers ${str(a.payload.to)} : « ${truncate(str(a.payload.body))} » — aucun SMS réel envoyé (Twilio non branché).`,
  send_email: (a) => `Courriel simulé vers ${str(a.payload.to)} — objet : « ${truncate(str(a.payload.subject))} ». Aucun courriel réel envoyé.`,
  create_task: (a) => `Tâche créée dans le registre interne Scaly : « ${truncate(str(a.title))} » (priorité ${str(a.payload.priority ?? "normale")}).`,
  create_crm_lead: (a) => `Lead simulé pour le CRM (valeur estimée ${str(a.payload.estimatedValueCad)} $) — sera poussé vers HubSpot/Pipedrive une fois l'intégration branchée (P3).`,
  create_calendar_event: (a) => `Événement calendrier simulé : ${truncate(str(a.payload.when))} — sera créé dans Google/Outlook Calendar une fois OAuth branché (P3).`,
  send_webhook: (a) => `Webhook simulé vers ${str(a.payload.url ?? "URL à configurer")} — payload journalisé, aucune requête réseau émise.`,
  transfer_call: (a) => `Transfert journalisé vers ${str(a.payload.to ?? "numéro de transfert")} (raison : ${truncate(str(a.payload.reason))}). Le transfert réel sera fait par Twilio en P2.`,
  notify_owner: (a) => `Notification propriétaire simulée (${str(a.payload.channel ?? "sms")}) : « ${truncate(str(a.payload.body))} ».`,
  daily_digest: () => `Résumé quotidien généré et journalisé — l'envoi courriel réel sera branché en P3.`,
  weekly_report: () => `Rapport hebdomadaire généré et journalisé — l'envoi réel sera branché en P3.`,
};

/** Exécuteur mock (toujours disponible). */
export function getExecutor(type: ActionType): ActionExecutor {
  return {
    mode: "mock",
    run: (action) => ({ detail: MOCK_DETAILS[type](action) }),
  };
}

/**
 * Stub d'exécuteur réel : démontre le chemin "requires_config".
 * Tant que l'intégration n'est pas configurée, l'action est bloquée avec une
 * explication claire au lieu d'un faux succès.
 */
export function getRealExecutorStub(type: ActionType): ActionExecutor {
  const hints: Partial<Record<ActionType, string>> = {
    send_sms: "Brancher Twilio Messaging (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) — phase P3.",
    send_email: "Brancher Gmail/Outlook via OAuth — phase P3.",
    create_crm_lead: "Brancher HubSpot/Pipedrive/Zoho via OAuth — phase P3.",
    create_calendar_event: "Brancher Google/Outlook Calendar via OAuth — phase P3.",
    send_webhook: "Configurer l'URL webhook signée du client — phase P3.",
    transfer_call: "Brancher Twilio Programmable Voice — phase P2 (docs/VOICE.md).",
  };
  return {
    mode: "real",
    configHint: hints[type] ?? "Intégration réelle non configurée — voir ROADMAP.md.",
    run: () => {
      throw new Error("Exécuteur réel non configuré.");
    },
  };
}
