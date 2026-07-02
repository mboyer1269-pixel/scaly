/**
 * Repo Prisma de l'Event Outbox (ADR-020). Chargé uniquement quand
 * STORE_PROVIDER=prisma (lazy require côté service) — le client Prisma n'est
 * jamais importé en mode démo. Tenant filtré par companyId sur chaque requête.
 */
import { prisma } from "./prisma";
import type { RuntimeEvent, RuntimeEventStatus } from "@/domain/runtime-event";
import type { EventOutboxRepository } from "@/services/event-outbox";
import { runtimeEventFromDb, runtimeEventToDb, type RuntimeEventRow } from "./event-outbox-mappers";

export class PrismaEventOutboxRepository implements EventOutboxRepository {
  async listEvents(companyId: string, status?: RuntimeEventStatus): Promise<RuntimeEvent[]> {
    const rows = await prisma.runtimeEvent.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => runtimeEventFromDb(row as unknown as RuntimeEventRow));
  }

  async getEvent(id: string): Promise<RuntimeEvent | undefined> {
    const row = await prisma.runtimeEvent.findUnique({ where: { id } });
    return row ? runtimeEventFromDb(row as unknown as RuntimeEventRow) : undefined;
  }

  async saveEvent(event: RuntimeEvent): Promise<RuntimeEvent> {
    const data = runtimeEventToDb(event);
    await prisma.runtimeEvent.upsert({ where: { id: event.id }, create: data, update: data });
    return event;
  }

  async findEventByDedupeKey(companyId: string, dedupeKey: string): Promise<RuntimeEvent | undefined> {
    const row = await prisma.runtimeEvent.findUnique({
      where: { companyId_dedupeKey: { companyId, dedupeKey } },
    });
    return row ? runtimeEventFromDb(row as unknown as RuntimeEventRow) : undefined;
  }

  async deleteByCompany(companyId: string): Promise<number> {
    const result = await prisma.runtimeEvent.deleteMany({ where: { companyId } });
    return result.count;
  }
}
