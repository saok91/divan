import { createPrismaClient, type PrismaClient } from "@divan/db";

let singleton: PrismaClient | null = null;

/**
 * Shared Prisma client for identity-access (via @divan/db adapter pattern).
 * Callers in web/Auth.js should prefer injecting a client when available.
 */
export function getIdentityDb(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (singleton) return singleton;
  if (!connectionString?.trim()) {
    throw new Error("DATABASE_URL is required for identity-access");
  }
  singleton = createPrismaClient(connectionString);
  return singleton;
}

/** Test / seed helper — replace or clear the singleton. */
export function setIdentityDb(client: PrismaClient | null): void {
  singleton = client;
}
