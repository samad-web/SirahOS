import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "./logger";

// ─── Retry logic for transient database errors ──────────────────────────────

const TRANSIENT_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const code =
        err instanceof Prisma.PrismaClientKnownRequestError ? err.code :
        err instanceof Prisma.PrismaClientInitializationError ? "P1001" :
        null;

      if (!code || !TRANSIENT_CODES.has(code) || attempt === MAX_RETRIES) throw err;

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      logger.db.warn(`Transient error ${code}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ─── Client setup ────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

// Extend with retry middleware
export const prisma = basePrisma.$extends({
  query: {
    $allOperations({ args, query }) {
      return withRetry(() => query(args));
    },
  },
}) as unknown as PrismaClient;

// ─── Connection verification ─────────────────────────────────────────────────

export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    await basePrisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.db.error("Database connection failed", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function disconnectPrisma() {
  await basePrisma.$disconnect();
}
