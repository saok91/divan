import { getSharedPrismaClient, type PrismaClient } from "@divan/db";

/** Test / seed override — does not replace the process-wide shared client. */
let override: PrismaClient | null = null;

/**
 * Shared Prisma client for identity-access (via @divan/db adapter pattern).
 * Callers in web/Auth.js should prefer injecting a client when available.
 */
export function getIdentityDb(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (override) return override;
  return getSharedPrismaClient(connectionString);
}

/** Test / seed helper — replace or clear the module override. */
export function setIdentityDb(client: PrismaClient | null): void {
  override = client;
}
