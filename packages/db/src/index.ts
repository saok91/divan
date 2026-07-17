import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export type { Pool, PoolClient } from "pg";
/** Runtime Prisma namespace (JsonNull, etc.) — modules import from `@divan/db`, not `@prisma/client`. */
export { Prisma };

/**
 * Shared `pg.Pool` for kernel raw-SQL paths (event-store) and Prisma adapter.
 * Callers own lifecycle — call `pool.end()` when shutting down.
 */
export function createPgPool(connectionString: string): pg.Pool {
  const trimmed = connectionString.trim();
  if (!trimmed) {
    throw new Error("DATABASE_URL / connectionString is required");
  }
  return new pg.Pool({ connectionString: trimmed });
}

/**
 * Create a Prisma client with the Prisma 7 driver adapter.
 * Callers must supply DATABASE_URL (local Postgres 17.10+).
 * Pool lifecycle is owned by the returned client — call `$disconnect()` when done.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const pool = createPgPool(connectionString);
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/**
 * Prove PostgreSQL connectivity without requiring domain tables.
 * Returns false on connection/query failure (does not throw for those).
 */
export async function checkDatabaseConnectivity(
  connectionString: string,
): Promise<boolean> {
  const trimmed = connectionString.trim();
  if (!trimmed) {
    return false;
  }

  const pool = createPgPool(trimmed);
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await client.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

export type { PrismaClient };
export type {
  EntitlementGrant,
  EntitlementGrantKind,
  EntitlementGrantStatus,
  PostUseReviewStatus,
} from "@prisma/client";
