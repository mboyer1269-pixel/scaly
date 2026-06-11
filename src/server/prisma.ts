/** Client Prisma singleton (survit au hot-reload Next.js via globalThis). */
import { PrismaClient } from "@prisma/client";

const g = globalThis as { __scalyPrisma?: PrismaClient };

export const prisma: PrismaClient = g.__scalyPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") g.__scalyPrisma = prisma;
