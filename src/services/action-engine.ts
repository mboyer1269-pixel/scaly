/**
 * Service — Action Engine
 * Planifie les actions post-appel selon des règles métier, puis les exécute via
 * les adapters d'exécution (mock aujourd'hui, réels en P2/P3 — même interface).
 * Chaque transition est tracée dans l'audit trail de l'action.
 */
import type { ActionType, ScalyAction } from "@/domain/action";
import type { Call } from "@/domain/call";
import type { Company } from "@/domain/company";
import { newId } from "@/lib/format";
import { getExecutor, getRealExecutorStub } from "@/adapters/integrations/executors";

function mk(call: Call | null, company: Company, type: ActionType, title: string, payload: Record<string, unknown>): ScalyAction {
  const now = new Date().toISOString();
  return {
    id: newId("act"),
    companyId: company.id,
    callId: call?.id,
    type,
    title,
    payload,
    status: "pending",
    attempts: 0,
    executor: "mock",
    createdAt: now,
    audit: [{ at: now, event: "planifiée", detail: "Règles action-engine v1" }],
  };
}

/** Planifie les actions découlant d'un appel analysé. Fonction pure (pas d'IO). */
export function planActionsForCall(call: Call, company: Company): ScalyAction[] {
  const intel = call.intelligence;
  if (!intel || intel.intent === "spam") return [];

  const list: ScalyAction[] = [];
  const caller = call.callerName ?? "l'appelant";

  if (call.status === "missed" && company.followUp.missedCallAutoSms) {
    list.push(
      mk(call, company, "send_sms", `SMS de rappel automatique — appel manqué`, {
        to: call.fromNumber,
        body: `Bonjour ! Vous avez tenté de joindre ${company.name}. Répondez à ce SMS ou rappelez-nous : on s'occupe de vous rapidement.`,
      }),
    );
  }

  if (intel.urgency === "critique") {
    list.push(
      mk(call, company, "notify_owner", `Urgence — aviser ${company.ownerName}`, {
        channel: "sms",
        to: company.transferPhone,
        body: `URGENCE — ${caller} (${call.fromNumber}) : ${intel.summary}`,
      }),
    );
  }

  if (intel.intent === "plainte") {
    list.push(
      mk(call, company, "notify_owner", `Plainte à traiter — ${caller}`, {
        channel: "sms",
        to: company.transferPhone,
        body: `Plainte de ${caller} (${call.fromNumber}). Rappel recommandé aujourd'hui.`,
      }),
      mk(call, company, "create_task", `Rappel de service (plainte) — ${caller}`, {
        priority: "haute",
        phone: call.fromNumber,
        due: "aujourd'hui",
      }),
    );
  }

  if ((intel.leadQuality === "chaud" || intel.leadQuality === "tiede") && ["demande_soumission", "prise_rdv", "urgence"].includes(intel.intent)) {
    list.push(
      mk(call, company, "create_crm_lead", `Créer le lead CRM — ${caller}`, {
        fields: intel.collectedFields,
        tags: intel.tags,
        estimatedValueCad: intel.estimatedValueCad,
      }),
    );
  }

  if (intel.nextAction === "confirmer_rdv") {
    list.push(
      mk(call, company, "create_calendar_event", `Rendez-vous — ${caller}`, {
        when: intel.collectedFields["moment"] ?? "à planifier",
        phone: call.fromNumber,
        notes: intel.summary,
      }),
    );
    if (company.followUp.smsConfirmation && call.status !== "missed") {
      list.push(
        mk(call, company, "send_sms", `Confirmation de demande de RDV — ${caller}`, {
          to: call.fromNumber,
          body: `${company.name} : votre demande de rendez-vous (${intel.collectedFields["moment"] ?? "moment à confirmer"}) est bien reçue. L'heure exacte vous sera confirmée sous peu.`,
        }),
      );
    }
  }

  if (intel.nextAction === "envoyer_soumission") {
    list.push(
      mk(call, company, "create_task", `Préparer la soumission — ${caller}`, {
        priority: "normale",
        details: intel.collectedFields,
        valeurEstimeeCad: intel.estimatedValueCad,
      }),
    );
  }

  if (intel.nextAction === "rappeler_immediatement") {
    list.push(
      mk(call, company, "create_task", `Rappeler ${caller} immédiatement`, {
        priority: "critique",
        phone: call.fromNumber,
      }),
    );
  }

  if (intel.nextAction === "creer_suivi") {
    list.push(
      mk(call, company, "create_task", `Suivi — ${caller}`, {
        priority: "normale",
        details: intel.summary,
      }),
    );
  }

  if (call.status === "transferred") {
    list.push(
      mk(call, company, "transfer_call", `Transfert vers ${company.transferPhone}`, {
        to: company.transferPhone,
        reason: intel.transferReason ?? "Demande de l'appelant",
      }),
    );
  }

  return list;
}

/** Action récurrente : résumé quotidien (générée par le scheduler en P1, seedée pour la démo). */
export function planDailyDigest(company: Company, callsCount: number, valueCad: number): ScalyAction {
  return mk(null, company, "daily_digest", `Résumé quotidien — ${company.name}`, {
    callsCount,
    estimatedPipelineCad: valueCad,
    to: company.ownerEmail,
  });
}

/**
 * Exécute une action (mutation en place + audit trail).
 * - executor "mock" → succès simulé, journalisé honnêtement comme tel.
 * - executor "real" → `requires_config` tant que l'intégration n'est pas branchée.
 */
export function executeAction(action: ScalyAction): ScalyAction {
  if (action.status === "succeeded" || action.status === "cancelled") return action;
  const now = () => new Date().toISOString();

  action.attempts += 1;
  action.status = "executing";
  action.audit.push({ at: now(), event: "exécution démarrée", detail: `Tentative ${action.attempts}` });

  const executor = action.executor === "real" ? getRealExecutorStub(action.type) : getExecutor(action.type);

  if (executor.mode === "real") {
    action.status = "requires_config";
    action.lastError = executor.configHint;
    action.audit.push({ at: now(), event: "configuration requise", detail: executor.configHint ?? "" });
    return action;
  }

  try {
    const result = executor.run(action);
    action.status = "succeeded";
    action.executedAt = now();
    action.audit.push({ at: now(), event: "exécutée (mock)", detail: result.detail });
  } catch (err) {
    action.status = "failed";
    action.lastError = err instanceof Error ? err.message : String(err);
    action.audit.push({ at: now(), event: "échec", detail: action.lastError });
  }
  return action;
}
