/**
 * Concurrent overlap mutex for import batch cutover (Story 6.2 / UX-DR16).
 *
 * Prefer transaction-scoped advisory locks (`pg_try_advisory_xact_lock`) plus
 * durable overlap-key rows. Session advisory locks are avoided (pool-unsafe).
 * Overlap keys are acquired in deterministic sorted order to avoid deadlocks.
 */

import type { PoolClient } from "@divan/db";

import { MigrationError } from "./errors";

/** Namespace for migration advisory locks (arbitrary stable int32). */
export const MIGRATION_ADVISORY_NAMESPACE = 0x4d494752; // 'MIGR'

export const MSG_CONCURRENT_BATCH_FA = "دسته دیگری در حال اجراست";

export type OverlapLockHolder = {
  batchId: string;
  ownerAccountId: string;
  ownerDisplayName: string;
  correlationId: string;
};

/**
 * Deterministic overlap keys from staging row identity values.
 * Prefer personnelCode; fall back to rowId.
 */
export function buildOverlapKeys(
  rows: Array<{ rowId: string; values: Record<string, string> }>,
): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    const code = (row.values.personnelCode ?? "").trim();
    if (code) {
      keys.add(`pc:${code}`);
    } else {
      keys.add(`row:${row.rowId}`);
    }
  }
  return [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Fail closed when a batch has no overlap identity keys. */
export function assertOverlapKeysPresent(overlapKeys: string[]): void {
  if (overlapKeys.length === 0) {
    throw new MigrationError(
      "VALIDATION_FAILED",
      "دسته بدون ردیف قابل اجرا نیست.",
    );
  }
}

/** Stable int hash of overlap key for advisory lock (two-int form). */
export function advisoryLockKeyPair(overlapKey: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < overlapKey.length; i++) {
    h ^= overlapKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Force signed 32-bit
  const k2 = h | 0;
  return [MIGRATION_ADVISORY_NAMESPACE, k2];
}

export function formatConcurrentBatchMessage(holder: {
  ownerDisplayName: string;
  correlationId: string;
}): string {
  const owner = holder.ownerDisplayName.trim() || "—";
  return `${MSG_CONCURRENT_BATCH_FA} — مالک: ${owner} — شناسه همبستگی: ${holder.correlationId}`;
}

/**
 * Try to claim overlap keys inside an open transaction.
 * On conflict: throw CONCURRENT_BATCH with Persian message + owner + correlation.
 */
export async function acquireOverlapLocks(
  client: PoolClient,
  opts: {
    overlapKeys: string[];
    holder: OverlapLockHolder;
  },
): Promise<void> {
  assertOverlapKeysPresent(opts.overlapKeys);
  const keys = [...opts.overlapKeys].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

  for (const key of keys) {
    const [n1, n2] = advisoryLockKeyPair(key);
    const lockRes = await client.query(
      `SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS ok`,
      [n1, n2],
    );
    if (!lockRes.rows[0]?.ok) {
      const existing = await client.query(
        `SELECT owner_account, owner_display, correlation_id, batch_id
         FROM migration_staging.execution_overlap_key
         WHERE overlap_key = $1`,
        [key],
      );
      const row = existing.rows[0] as
        | {
            owner_display?: string;
            correlation_id?: string;
          }
        | undefined;
      const message = formatConcurrentBatchMessage({
        ownerDisplayName: String(row?.owner_display ?? ""),
        correlationId: String(row?.correlation_id ?? opts.holder.correlationId),
      });
      throw new MigrationError("CONCURRENT_BATCH", message, {
        ownerDisplayName: String(row?.owner_display ?? ""),
        correlationId: String(row?.correlation_id ?? opts.holder.correlationId),
      });
    }

    const insertRes = await client.query(
      `INSERT INTO migration_staging.execution_overlap_key (
         overlap_key, batch_id, owner_account, owner_display, correlation_id
       ) VALUES ($1, $2::uuid, $3, $4, $5::uuid)
       ON CONFLICT (overlap_key) DO NOTHING
       RETURNING overlap_key`,
      [
        key,
        opts.holder.batchId,
        opts.holder.ownerAccountId,
        opts.holder.ownerDisplayName,
        opts.holder.correlationId,
      ],
    );
    if ((insertRes.rowCount ?? 0) === 0) {
      const existing = await client.query(
        `SELECT owner_display, correlation_id
         FROM migration_staging.execution_overlap_key
         WHERE overlap_key = $1`,
        [key],
      );
      const row = existing.rows[0] as
        | { owner_display?: string; correlation_id?: string }
        | undefined;
      const message = formatConcurrentBatchMessage({
        ownerDisplayName: String(row?.owner_display ?? ""),
        correlationId: String(
          row?.correlation_id ?? opts.holder.correlationId,
        ),
      });
      throw new MigrationError("CONCURRENT_BATCH", message, {
        ownerDisplayName: String(row?.owner_display ?? ""),
        correlationId: String(
          row?.correlation_id ?? opts.holder.correlationId,
        ),
      });
    }
  }
}

export async function releaseOverlapLocksForBatch(
  client: PoolClient,
  batchId: string,
): Promise<void> {
  await client.query(
    `DELETE FROM migration_staging.execution_overlap_key WHERE batch_id = $1::uuid`,
    [batchId],
  );
}
