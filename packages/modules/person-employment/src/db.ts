import { createPrismaClient, type PrismaClient } from "@divan/db";

let singleton: PrismaClient | null = null;

/**
 * Shared Prisma client for person-employment (via @divan/db adapter).
 */
export function getPersonDb(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (singleton) return singleton;
  if (!connectionString?.trim()) {
    throw new Error("DATABASE_URL is required for person-employment");
  }
  singleton = createPrismaClient(connectionString);
  return singleton;
}

/** Test / seed helper — replace or clear the singleton. */
export function setPersonDb(client: PrismaClient | null): void {
  singleton = client;
}
