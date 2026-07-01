/**
 * Service — Notifications propriétaire après appel.
 *
 * Fondation déterministe et pure : aucune dépendance, aucun SMS/email réel,
 * aucun Prisma. La persistance passe par un repo injectable (in-memory par
 * défaut) ; la livraison réelle, quand elle existera, passera par un port
 * `OwnerNotifier` injectable. Sans notifier fourni, une notification reste
 * simplement `pending` jusqu'à ce que le propriétaire la traite.
 */
import type {
  OwnerNotification,
  OwnerNotificationStatus,
  OwnerNotificationType,
} from "@/domain/owner-notification";
import type { Urgency } from "@/domain/call";
import { newId } from "@/lib/format";

export interface OwnerNotificationRepository {
  list(companyId: string): Promise<OwnerNotification[]>;
  get(id: string): Promise<OwnerNotification | undefined>;
  save(notification: OwnerNotification): Promise<OwnerNotification>;
}

/** Port de livraison. Aucune implémentation réseau ici : injecté au besoin. */
export interface OwnerNotifier {
  deliver(notification: OwnerNotification): Promise<{ ok: boolean; reason?: string }>;
}

export class InMemoryOwnerNotificationRepository implements OwnerNotificationRepository {
  private items = new Map<string, OwnerNotification>();

  async list(companyId: string): Promise<OwnerNotification[]> {
    return [...this.items.values()].filter((item) => item.companyId === companyId);
  }

  async get(id: string): Promise<OwnerNotification | undefined> {
    return this.items.get(id);
  }

  async save(notification: OwnerNotification): Promise<OwnerNotification> {
    this.items.set(notification.id, notification);
    return notification;
  }
}

export function getOwnerNotificationRepository(): OwnerNotificationRepository {
  const g = globalThis as { __scalyOwnerNotifications?: OwnerNotificationRepository };
  if (!g.__scalyOwnerNotifications) g.__scalyOwnerNotifications = new InMemoryOwnerNotificationRepository();
  return g.__scalyOwnerNotifications;
}

interface ServiceOptions {
  now?: Date;
  repo?: OwnerNotificationRepository;
  /** Port optionnel : si fourni, tente une livraison immédiate et met à jour le statut. */
  notifier?: OwnerNotifier;
}

const URGENCY_RANK: Record<Urgency, number> = { critique: 0, haute: 1, normale: 2, basse: 3 };
const STATUS_RANK: Record<OwnerNotificationStatus, number> = { pending: 0, failed: 1, sent: 2, dismissed: 3 };

function clean(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

async function persistNew(
  notification: OwnerNotification,
  repo: OwnerNotificationRepository,
  notifier?: OwnerNotifier,
): Promise<OwnerNotification> {
  const saved = await repo.save(notification);
  if (!notifier) return saved;
  // Livraison best-effort via le port injectable. Ne jette jamais : un échec
  // de livraison devient un statut `failed` visible, pas une exception.
  try {
    const result = await notifier.deliver(saved);
    return repo.save(
      result.ok
        ? { ...saved, status: "sent", sentAt: saved.updatedAt, updatedAt: saved.updatedAt }
        : { ...saved, status: "failed", failureReason: result.reason ?? "delivery_failed", updatedAt: saved.updatedAt },
    );
  } catch (error) {
    return repo.save({
      ...saved,
      status: "failed",
      failureReason: error instanceof Error ? error.message : "delivery_error",
      updatedAt: saved.updatedAt,
    });
  }
}

export interface PostCallNotificationInput {
  summary: string;
  recommendedAction: string;
  urgency: Urgency;
  title?: string;
  type?: Extract<OwnerNotificationType, "post_call_summary" | "escalation" | "follow_up_needed">;
  sourceCallId?: string;
  sourceTraceId?: string;
  modelCostEstimateCad?: number;
}

const POST_CALL_TITLES: Record<PostCallNotificationInput["type"] & string, string> = {
  post_call_summary: "Récapitulatif d'appel",
  escalation: "Escalade — décision requise",
  follow_up_needed: "Suivi requis",
};

export async function createPostCallNotification(
  companyId: string,
  input: PostCallNotificationInput,
  options: ServiceOptions = {},
): Promise<OwnerNotification> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getOwnerNotificationRepository();
  const summary = clean(input.summary, 500);
  const recommendedAction = clean(input.recommendedAction, 300);
  if (!summary) throw new Error("Résumé requis.");
  if (!recommendedAction) throw new Error("Action recommandée requise.");
  const type = input.type ?? "post_call_summary";
  const notification: OwnerNotification = {
    id: newId("ownernote"),
    companyId,
    type,
    status: "pending",
    title: input.title ? clean(input.title, 120) : POST_CALL_TITLES[type],
    summary,
    recommendedAction,
    urgency: input.urgency,
    sourceCallId: input.sourceCallId,
    sourceTraceId: input.sourceTraceId,
    modelCostEstimateCad: input.modelCostEstimateCad,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return persistNew(notification, repo, options.notifier);
}

export interface UnknownAnswerNotificationInput {
  question: string;
  reason: "no_approved_source" | "question_too_short";
  sourceCallId?: string;
  sourceTraceId?: string;
  modelCostEstimateCad?: number;
}

export async function createUnknownAnswerNotification(
  companyId: string,
  input: UnknownAnswerNotificationInput,
  options: ServiceOptions = {},
): Promise<OwnerNotification> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getOwnerNotificationRepository();
  const question = clean(input.question, 300);
  const summary =
    input.reason === "question_too_short"
      ? `Maude n'a pas pu répondre : question trop courte pour trouver une source approuvée${question ? ` (« ${question} »)` : ""}.`
      : `Maude n'avait aucune source approuvée pour répondre${question ? ` à « ${question} »` : ""}.`;
  const notification: OwnerNotification = {
    id: newId("ownernote"),
    companyId,
    type: "unknown_answer",
    status: "pending",
    title: "Maude a besoin d'une décision",
    summary,
    recommendedAction: "Répondre au client, puis ajouter l'information au Cerveau d'entreprise.",
    urgency: "haute",
    sourceCallId: input.sourceCallId,
    sourceTraceId: input.sourceTraceId,
    modelCostEstimateCad: input.modelCostEstimateCad,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return persistNew(notification, repo, options.notifier);
}

async function transition(
  companyId: string,
  id: string,
  repo: OwnerNotificationRepository,
  patch: (current: OwnerNotification, iso: string) => OwnerNotification,
  now: Date,
): Promise<OwnerNotification> {
  const current = await repo.get(id);
  if (!current || current.companyId !== companyId) throw new Error("Notification introuvable.");
  return repo.save(patch(current, now.toISOString()));
}

export function markNotificationSent(
  companyId: string,
  id: string,
  options: ServiceOptions = {},
): Promise<OwnerNotification> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getOwnerNotificationRepository();
  return transition(companyId, id, repo, (current, iso) => ({ ...current, status: "sent", sentAt: iso, updatedAt: iso }), now);
}

export function markNotificationFailed(
  companyId: string,
  id: string,
  reason: string,
  options: ServiceOptions = {},
): Promise<OwnerNotification> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getOwnerNotificationRepository();
  return transition(
    companyId,
    id,
    repo,
    (current, iso) => ({ ...current, status: "failed", failureReason: clean(reason, 200) || "delivery_failed", updatedAt: iso }),
    now,
  );
}

export function dismissNotification(
  companyId: string,
  id: string,
  options: ServiceOptions = {},
): Promise<OwnerNotification> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getOwnerNotificationRepository();
  return transition(companyId, id, repo, (current, iso) => ({ ...current, status: "dismissed", dismissedAt: iso, updatedAt: iso }), now);
}

export interface ListOwnerNotificationsOptions {
  status?: OwnerNotificationStatus;
  repo?: OwnerNotificationRepository;
}

/** Tri stable : pending d'abord, puis par urgence, puis les plus récentes. */
export async function listOwnerNotifications(
  companyId: string,
  options: ListOwnerNotificationsOptions = {},
): Promise<OwnerNotification[]> {
  const repo = options.repo ?? getOwnerNotificationRepository();
  const all = await repo.list(companyId);
  const filtered = options.status ? all.filter((item) => item.status === options.status) : all;
  return filtered.sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (URGENCY_RANK[a.urgency] !== URGENCY_RANK[b.urgency]) return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
    return a.id.localeCompare(b.id);
  });
}
