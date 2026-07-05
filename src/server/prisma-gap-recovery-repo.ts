/**
 * Repo Prisma du remplissage intelligent des annulations. Chargé uniquement
 * quand STORE_PROVIDER=prisma (lazy require côté service) — le client Prisma
 * n'est jamais importé en mode démo. Tenant filtré par companyId sur CHAQUE
 * requête, y compris les lectures par id (défense en profondeur côté service).
 */
import { prisma } from "./prisma";
import type { AppointmentGap, RecoveryOffer, WaitlistEntry } from "@/domain/gap-recovery";
import type { GapRecoveryRepository } from "@/services/gap-recovery";
import {
  appointmentGapFromDb,
  appointmentGapToDb,
  recoveryOfferFromDb,
  recoveryOfferToDb,
  waitlistEntryFromDb,
  waitlistEntryToDb,
} from "./gap-recovery-mappers";

export class PrismaGapRecoveryRepository implements GapRecoveryRepository {
  async listWaitlistEntries(companyId: string): Promise<WaitlistEntry[]> {
    const rows = await prisma.waitlistEntry.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
    return rows.map(waitlistEntryFromDb);
  }

  async getWaitlistEntry(id: string): Promise<WaitlistEntry | undefined> {
    const row = await prisma.waitlistEntry.findUnique({ where: { id } });
    return row ? waitlistEntryFromDb(row) : undefined;
  }

  async saveWaitlistEntry(entry: WaitlistEntry): Promise<WaitlistEntry> {
    const data = waitlistEntryToDb(entry);
    await prisma.waitlistEntry.upsert({ where: { id: entry.id }, create: data, update: data });
    return entry;
  }

  async listGaps(companyId: string): Promise<AppointmentGap[]> {
    const rows = await prisma.appointmentGap.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
    return rows.map(appointmentGapFromDb);
  }

  async getGap(id: string): Promise<AppointmentGap | undefined> {
    const row = await prisma.appointmentGap.findUnique({ where: { id } });
    return row ? appointmentGapFromDb(row) : undefined;
  }

  async saveGap(gap: AppointmentGap): Promise<AppointmentGap> {
    const data = appointmentGapToDb(gap);
    await prisma.appointmentGap.upsert({ where: { id: gap.id }, create: data, update: data });
    return gap;
  }

  async findGapByIdempotencyKey(companyId: string, key: string): Promise<AppointmentGap | undefined> {
    const row = await prisma.appointmentGap.findFirst({ where: { companyId, idempotencyKey: key } });
    return row ? appointmentGapFromDb(row) : undefined;
  }

  async listOffers(companyId: string, gapId?: string): Promise<RecoveryOffer[]> {
    const rows = await prisma.recoveryOffer.findMany({
      where: { companyId, ...(gapId ? { gapId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(recoveryOfferFromDb);
  }

  async getOffer(id: string): Promise<RecoveryOffer | undefined> {
    const row = await prisma.recoveryOffer.findUnique({ where: { id } });
    return row ? recoveryOfferFromDb(row) : undefined;
  }

  async saveOffer(offer: RecoveryOffer): Promise<RecoveryOffer> {
    const data = recoveryOfferToDb(offer);
    await prisma.recoveryOffer.upsert({ where: { id: offer.id }, create: data, update: data });
    return offer;
  }

  async findOfferByIdempotencyKey(companyId: string, key: string): Promise<RecoveryOffer | undefined> {
    const row = await prisma.recoveryOffer.findUnique({
      where: { companyId_idempotencyKey: { companyId, idempotencyKey: key } },
    });
    return row ? recoveryOfferFromDb(row) : undefined;
  }

  async deleteByCompany(companyId: string): Promise<number> {
    const [offers, gaps, entries] = await prisma.$transaction([
      prisma.recoveryOffer.deleteMany({ where: { companyId } }),
      prisma.appointmentGap.deleteMany({ where: { companyId } }),
      prisma.waitlistEntry.deleteMany({ where: { companyId } }),
    ]);
    return offers.count + gaps.count + entries.count;
  }
}
