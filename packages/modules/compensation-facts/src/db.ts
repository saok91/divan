/**
 * Module-owned Prisma accessor for compensation-facts (AD-3).
 * Other packages must not create clients that reach compensation tables directly.
 */

import { createPrismaClient, type PrismaClient } from "@divan/db";

let singleton: PrismaClient | null = null;

export function getCompensationDb(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (singleton) return singleton;
  if (!connectionString?.trim()) {
    throw new Error("DATABASE_URL is required for compensation-facts");
  }
  singleton = createPrismaClient(connectionString);
  return singleton;
}

export function setCompensationDb(client: PrismaClient | null): void {
  singleton = client;
}
