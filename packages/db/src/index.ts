import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export type { Pool, PoolClient } from "pg";
/** Runtime Prisma namespace (JsonNull, etc.) — modules import from `@divan/db`, not `@prisma/client`. */
export { Prisma };

type DivanDbGlobal = {
  __divanPgPool?: pg.Pool;
  __divanPgPoolUrl?: string;
  __divanPrisma?: PrismaClient;
};

const globalForDb = globalThis as typeof globalThis & DivanDbGlobal;

function defaultPoolMax(env: NodeJS.ProcessEnv = process.env): number {
  const fromEnv = Number(env.DIVAN_PG_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  // Dev/Turbopack HMR used to spawn many module-local pools; keep the shared
  // process budget small so Postgres `max_connections` is not exhausted.
  return env.NODE_ENV === "production" ? 10 : 5;
}

/** Pure helper for settings inventory binder (Story 10.4) — no pool required. */
export function resolveDefaultPoolMax(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return defaultPoolMax(env);
}

/**
 * Shared `pg.Pool` for kernel raw-SQL paths (event-store) and Prisma adapter.
 * Survives Turbopack/HMR via `globalThis` so hot reloads do not leak clients.
 */
export function getSharedPgPool(
  connectionString = process.env.DATABASE_URL,
): pg.Pool {
  const trimmed = connectionString?.trim();
  if (!trimmed) {
    throw new Error("DATABASE_URL / connectionString is required");
  }
  if (
    globalForDb.__divanPgPool &&
    globalForDb.__divanPgPoolUrl === trimmed
  ) {
    return globalForDb.__divanPgPool;
  }
  if (globalForDb.__divanPgPool) {
    void globalForDb.__divanPgPool.end().catch(() => undefined);
    globalForDb.__divanPrisma = undefined;
  }
  globalForDb.__divanPgPool = new pg.Pool({
    connectionString: trimmed,
    max: defaultPoolMax(),
  });
  globalForDb.__divanPgPoolUrl = trimmed;
  return globalForDb.__divanPgPool;
}

/**
 * Process-wide Prisma client (same DATABASE_URL / schema for all modules).
 * Prefer this over `createPrismaClient` in long-lived web/worker processes.
 */
export function getSharedPrismaClient(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (globalForDb.__divanPrisma) return globalForDb.__divanPrisma;
  const pool = getSharedPgPool(connectionString);
  const adapter = new PrismaPg(pool);
  globalForDb.__divanPrisma = new PrismaClient({ adapter });
  return globalForDb.__divanPrisma;
}

/**
 * One-off `pg.Pool` (selfchecks / workers that own lifecycle).
 * Prefer `getSharedPgPool` in apps/web request paths.
 */
export function createPgPool(
  connectionString: string,
  options?: { max?: number },
): pg.Pool {
  const trimmed = connectionString.trim();
  if (!trimmed) {
    throw new Error("DATABASE_URL / connectionString is required");
  }
  return new pg.Pool({
    connectionString: trimmed,
    max: options?.max ?? defaultPoolMax(),
  });
}

/**
 * Create a disposable Prisma client with its own pool (selfchecks).
 * Long-lived code should use `getSharedPrismaClient`.
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

  // Separate readiness budget; domain transactions retain their normal limits.
  const client = new pg.Client({
    connectionString: trimmed,
    connectionTimeoutMillis: 2_000,
    query_timeout: 2_000,
    statement_timeout: 2_000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export type { PrismaClient };
export type {
  EntitlementGrant,
  EntitlementGrantKind,
  EntitlementGrantStatus,
  PostUseReviewStatus,
} from "@prisma/client";
