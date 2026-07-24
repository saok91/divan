import { getSharedPrismaClient, type PrismaClient } from "@divan/db";

/** Test / seed override — does not replace the process-wide shared client. */
let override: PrismaClient | null = null;

/**
 * Shared Prisma client for person-employment (via @divan/db adapter).
 */
export function getPersonDb(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (override) return override;
  return getSharedPrismaClient(connectionString);
}

/** Test / seed helper — replace or clear the module override. */
export function setPersonDb(client: PrismaClient | null): void {
  override = client;
}
