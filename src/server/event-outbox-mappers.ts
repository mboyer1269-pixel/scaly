/**
 * Mappers PURS row <-> domaine pour l'Event Outbox (ADR-020).
 *
 * Aucun import Prisma : testables sans base ni client (mêmes conventions que
 * gap-recovery-mappers) — DateTime -> ISO string, null -> undefined, payload
 * stocké en Json (déjà JSON-safe : sanitizé AVANT persistance par le service).
 */
import type { RuntimeEvent, RuntimeEventPayload } from "@/domain/runtime-event";
import { RUNTIME_EVENT_SOURCE } from "@/domain/runtime-event";

const iso = (d: Date): string => d.toISOString();
const strOpt = (s: string | null): string | undefined => s ?? undefined;

export interface RuntimeEventRow {
  id: string;
  companyId: string;
  type: string;
  occurredAt: Date;
  correlationId: string;
  externalId: string | null;
  dedupeKey: string;
  schemaVersion: number;
  payload: RuntimeEventPayload;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function runtimeEventFromDb(row: RuntimeEventRow): RuntimeEvent {
  return {
    id: row.id,
    companyId: row.companyId,
    source: RUNTIME_EVENT_SOURCE,
    type: row.type as RuntimeEvent["type"],
    occurredAt: iso(row.occurredAt),
    correlationId: row.correlationId,
    externalId: strOpt(row.externalId),
    dedupeKey: row.dedupeKey,
    schemaVersion: row.schemaVersion,
    payload: row.payload ?? {},
    status: row.status as RuntimeEvent["status"],
    attempts: row.attempts,
    lastError: strOpt(row.lastError),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function runtimeEventToDb(event: RuntimeEvent): RuntimeEventRow {
  return {
    id: event.id,
    companyId: event.companyId,
    type: event.type,
    occurredAt: new Date(event.occurredAt),
    correlationId: event.correlationId,
    externalId: event.externalId ?? null,
    dedupeKey: event.dedupeKey,
    schemaVersion: event.schemaVersion,
    payload: event.payload,
    status: event.status,
    attempts: event.attempts,
    lastError: event.lastError ?? null,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  };
}
