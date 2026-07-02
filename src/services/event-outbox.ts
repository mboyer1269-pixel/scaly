/**
 * Service — Event Outbox de la frontière Scaly (ADR-020).
 *
 * Scaly émet, l'écosystème consomme. Chaque moment métier significatif devient
 * un RuntimeEvent appendé ici ; Oria Action Ledger (et Memex Core) viendront
 * les chercher SANS que Scaly recode sa persistance. Pas de bus, pas de
 * framework : un repo substituable + une fonction d'append idempotente.
 *
 * Invariants durs (testés) :
 *  - companyId obligatoire — aucun événement sans tenant ;
 *  - idempotence par (companyId, dedupeKey) — un retry Twilio ne double jamais ;
 *  - payload passé au sanitizer AVANT persistance (secrets caviardés,
 *    transcript interdit, JSON-safe garanti) ;
 *  - append best-effort : `tryAppendRuntimeEvent` ne jette JAMAIS — la
 *    frontière ne casse pas le téléphone.
 */
import type { RuntimeEvent, RuntimeEventStatus, RuntimeEventType } from "@/domain/runtime-event";
import {
  RUNTIME_EVENT_SCHEMA_VERSION,
  RUNTIME_EVENT_SOURCE,
  defaultDedupeKey,
  sanitizeRuntimeEventPayload,
} from "@/domain/runtime-event";
import { newId } from "@/lib/format";

export interface EventOutboxRepository {
  listEvents(companyId: string, status?: RuntimeEventStatus): Promise<RuntimeEvent[]>;
  getEvent(id: string): Promise<RuntimeEvent | undefined>;
  saveEvent(event: RuntimeEvent): Promise<RuntimeEvent>;
  findEventByDedupeKey(companyId: string, dedupeKey: string): Promise<RuntimeEvent | undefined>;
  /** Supprime tous les événements du tenant (Loi 25). Retourne le nombre supprimé. */
  deleteByCompany(companyId: string): Promise<number>;
}

export class EventOutboxError extends Error {}

export class InMemoryEventOutboxRepository implements EventOutboxRepository {
  private events = new Map<string, RuntimeEvent>();

  async listEvents(companyId: string, status?: RuntimeEventStatus): Promise<RuntimeEvent[]> {
    return [...this.events.values()]
      .filter((e) => e.companyId === companyId && (!status || e.status === status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getEvent(id: string): Promise<RuntimeEvent | undefined> {
    return this.events.get(id);
  }

  async saveEvent(event: RuntimeEvent): Promise<RuntimeEvent> {
    this.events.set(event.id, event);
    return event;
  }

  async findEventByDedupeKey(companyId: string, dedupeKey: string): Promise<RuntimeEvent | undefined> {
    return [...this.events.values()].find((e) => e.companyId === companyId && e.dedupeKey === dedupeKey);
  }

  async deleteByCompany(companyId: string): Promise<number> {
    let count = 0;
    for (const [id, event] of [...this.events]) {
      if (event.companyId === companyId) {
        this.events.delete(id);
        count += 1;
      }
    }
    return count;
  }
}

export function getEventOutboxRepository(): EventOutboxRepository {
  const g = globalThis as { __scalyEventOutbox?: EventOutboxRepository };
  if (g.__scalyEventOutbox) return g.__scalyEventOutbox;
  const repo: EventOutboxRepository =
    process.env.STORE_PROVIDER === "prisma"
      ? new (require("../server/prisma-event-outbox-repo").PrismaEventOutboxRepository)()
      : new InMemoryEventOutboxRepository();
  g.__scalyEventOutbox = repo;
  return repo;
}

export interface AppendRuntimeEventInput {
  companyId: string;
  type: RuntimeEventType;
  /** callSid Twilio pour la voix, `sms:<phone canonique>` pour les SMS. */
  correlationId: string;
  /** Identifiant du système externe (callSid, MessageSid…) si disponible. */
  externalId?: string;
  /** Moment métier ; défaut = now. */
  occurredAt?: string;
  /** Défaut : `${type}:${correlationId}` — un type par flux corrélé. */
  dedupeKey?: string;
  /** Payload brut : sera sanitizé (secrets, transcript, JSON-safe) avant persistance. */
  payload?: Record<string, unknown>;
}

export interface EventOutboxOptions {
  now?: Date;
  repo?: EventOutboxRepository;
}

export interface AppendRuntimeEventResult {
  event: RuntimeEvent;
  /** true si un événement avec la même dedupeKey existait déjà (aucune écriture). */
  idempotent: boolean;
}

/**
 * Appende un événement dans l'outbox. Idempotent par (companyId, dedupeKey).
 * Jette EventOutboxError si companyId ou correlationId manquent — pour les
 * chemins d'appel réels, préférer `tryAppendRuntimeEvent` (best-effort).
 */
export async function appendRuntimeEvent(
  input: AppendRuntimeEventInput,
  options: EventOutboxOptions = {},
): Promise<AppendRuntimeEventResult> {
  if (!input.companyId) throw new EventOutboxError("companyId requis — aucun événement sans tenant.");
  if (!input.correlationId) throw new EventOutboxError("correlationId requis — un événement doit être corrélable.");
  const now = options.now ?? new Date();
  const repo = options.repo ?? getEventOutboxRepository();
  const dedupeKey = input.dedupeKey ?? defaultDedupeKey(input.type, input.correlationId);

  const existing = await repo.findEventByDedupeKey(input.companyId, dedupeKey);
  if (existing) return { event: existing, idempotent: true };

  const { payload, redactions } = sanitizeRuntimeEventPayload(input.payload);
  if (redactions.length > 0) payload._redactions = redactions;

  const iso = now.toISOString();
  const event: RuntimeEvent = {
    id: newId("evt"),
    companyId: input.companyId,
    source: RUNTIME_EVENT_SOURCE,
    type: input.type,
    occurredAt: input.occurredAt ?? iso,
    correlationId: input.correlationId,
    externalId: input.externalId,
    dedupeKey,
    schemaVersion: RUNTIME_EVENT_SCHEMA_VERSION,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: iso,
    updatedAt: iso,
  };
  await repo.saveEvent(event);
  return { event, idempotent: false };
}

/**
 * Variante best-effort pour les chemins d'appel réels : ne jette JAMAIS.
 * Règle produit : le téléphone ne casse pas parce que la frontière a hoqueté.
 */
export async function tryAppendRuntimeEvent(
  input: AppendRuntimeEventInput,
  options: EventOutboxOptions = {},
): Promise<AppendRuntimeEventResult | undefined> {
  try {
    return await appendRuntimeEvent(input, options);
  } catch {
    return undefined;
  }
}

/** Transitions légales de statut — un événement livré ne redevient jamais pending. */
const EVENT_TRANSITIONS: Record<RuntimeEventStatus, RuntimeEventStatus[]> = {
  pending: ["delivered", "failed"],
  failed: ["delivered", "failed"],
  delivered: [],
};

/**
 * Marque le résultat d'une tentative de livraison (utilisé par le futur
 * dispatcher Oria). Transition illégale → EventOutboxError.
 */
export async function markRuntimeEventDelivery(
  companyId: string,
  id: string,
  outcome: { ok: boolean; error?: string },
  options: EventOutboxOptions = {},
): Promise<RuntimeEvent> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getEventOutboxRepository();
  const current = await repo.getEvent(id);
  if (!current || current.companyId !== companyId) throw new EventOutboxError("Événement introuvable pour ce tenant.");
  const next: RuntimeEventStatus = outcome.ok ? "delivered" : "failed";
  if (!EVENT_TRANSITIONS[current.status].includes(next)) {
    throw new EventOutboxError(`Transition illégale ${current.status} → ${next}.`);
  }
  return repo.saveEvent({
    ...current,
    status: next,
    attempts: current.attempts + 1,
    lastError: outcome.ok ? undefined : (outcome.error ?? "delivery_failed").slice(0, 300),
    updatedAt: now.toISOString(),
  });
}
