/**
 * Service pur — Hook post-appel → notification propriétaire.
 *
 * À partir d'un `Call` déjà analysé (intelligence présente), construit une
 * notification `post_call_summary` owner-facing. Anti-spam : seuls les appels
 * qui méritent une décision produisent une notification.
 *
 * INTÉGRATION (non câblée ici, volontairement, pour ne pas toucher la
 * téléphonie/fallback humain) :
 *   Point d'appel exact = `src/app/api/voice/complete/route.ts`, juste après
 *   `await store.addCall(call, actions);` (~ligne 90). Y ajouter, en best-effort
 *   non bloquant :
 *     try { await createPostCallNotificationFromCall(call, { modelUsage }); }
 *     catch { — ne jamais bloquer la fin d'appel — }
 *   Le simulateur et le Voice Lab peuvent réutiliser le même point.
 */
import type { Call } from "@/domain/call";
import { INTENT_LABELS, NEXT_ACTION_LABELS } from "@/domain/call";
import type { ModelUsage } from "@/domain/model-usage";
import type { OwnerNotification } from "@/domain/owner-notification";
import {
  createPostCallNotification,
  type OwnerNotificationRepository,
  type OwnerNotifier,
} from "./owner-notifications";

/**
 * Anti-spam : un appel mérite une action owner s'il est urgent, transféré, à
 * suivre, perdu, un lead chaud, un appel "sauvé", ou porte une action à faire.
 * Les appels résolus sans suite et le spam sont ignorés.
 */
export function callWarrantsOwnerNotification(call: Call): boolean {
  const i = call.intelligence;
  if (!i) return false;
  if (i.finalStatus === "ignore_spam" || i.intent === "spam") return false;
  if (i.urgency === "critique" || i.urgency === "haute") return true;
  if (i.finalStatus === "transfere" || i.finalStatus === "suivi_requis" || i.finalStatus === "perdu") return true;
  if (i.leadQuality === "chaud") return true;
  if (i.saved) return true;
  return i.nextAction !== "aucune";
}

function sumModelCostForCall(usage: ModelUsage[] | undefined, callId: string): number | undefined {
  if (!usage?.length) return undefined;
  const relevant = usage.filter((u) => u.callId === callId && u.status === "succeeded");
  if (!relevant.length) return undefined;
  const total = relevant.reduce((sum, u) => sum + u.estimatedCostCad, 0);
  return Math.round(total * 10000) / 10000;
}

export interface PostCallNotificationOptions {
  now?: Date;
  repo?: OwnerNotificationRepository;
  notifier?: OwnerNotifier;
  /** ModelUsage de l'appel : si présent, le coût IA est propagé sur la notification. */
  modelUsage?: ModelUsage[];
  /** Trace modèle source, si connue à l'appel. */
  traceId?: string;
}

/**
 * Crée une notification post-appel si l'appel le mérite. Retourne `null`
 * (sans effet de bord) si l'intelligence manque ou si l'appel ne mérite pas
 * d'alerte — l'appelant peut ignorer sans traiter d'erreur.
 */
export async function createPostCallNotificationFromCall(
  call: Call,
  options: PostCallNotificationOptions = {},
): Promise<OwnerNotification | null> {
  const i = call.intelligence;
  if (!i || !callWarrantsOwnerNotification(call)) return null;

  const who = call.callerName ?? call.fromNumber;
  const summary = `${INTENT_LABELS[i.intent]} — ${who}. ${i.summary}`;
  const recommendedAction =
    i.nextAction !== "aucune" ? NEXT_ACTION_LABELS[i.nextAction] : "Revoir l'appel et décider du suivi.";

  return createPostCallNotification(
    call.companyId,
    {
      type: "post_call_summary",
      summary,
      recommendedAction,
      urgency: i.urgency,
      sourceCallId: call.id,
      sourceTraceId: options.traceId,
      modelCostEstimateCad: sumModelCostForCall(options.modelUsage, call.id),
    },
    { now: options.now, repo: options.repo, notifier: options.notifier },
  );
}
