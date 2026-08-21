import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * Standard Next.js Prisma singleton pattern: in dev, hot-reloading would
 * otherwise create a fresh PrismaClient (and a fresh connection pool) on
 * every file save, eventually exhausting the DB's connection limit.
 * Stashing the instance on `globalThis` survives module reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
