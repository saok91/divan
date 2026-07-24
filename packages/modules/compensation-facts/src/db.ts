/**
 * Module-owned Prisma accessor for compensation-facts (AD-3).
 * Other packages must not create clients that reach compensation tables directly.
 */

import { getSharedPrismaClient, type PrismaClient } from "@divan/db";

/** Test / seed override — does not replace the process-wide shared client. */
let override: PrismaClient | null = null;

export function getCompensationDb(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (override) return override;
  return getSharedPrismaClient(connectionString);
}

export function setCompensationDb(client: PrismaClient | null): void {
  override = client;
}
