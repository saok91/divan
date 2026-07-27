/**
 * Ops-safe import batch aggregate (Story 7.2 / FR-45).
 * Counts by staging status only — never row payloads, personnel codes, or names.
 * Do NOT reuse getStagingBatch / person-gated APIs for SysAdmin.
 */

import type { Pool, PoolClient } from "@divan/db";

import type { StagingBatchStatus } from "./staging-repo";

type PgQueryable = Pool | PoolClient;

const KNOWN_STAGING_BATCH_STATUSES: ReadonlySet<StagingBatchStatus> = new Set([
  "confirmed-draft",
  "approved",
  "executing",
  "cutover-complete",
  "failed",
  "rolled-back",
]);

export type OpsImportBatchSummary = {
  byStatus: Partial<Record<StagingBatchStatus, number>>;
  recentFailedCount: number;
  totalBatches: number;
  /** Epic 6 retro honesty — aggregates are not cutover proof. */
  honestyFa: string;
  /** false when import_batch relation/schema unreachable */
  schemaAvailable: boolean;
  /** Rows whose status is outside the known StagingBatchStatus union */
  unknownStatusCount: number;
};

const IMPORT_OPS_HONESTY_FA =
  "خلاصهٔ ورود فقط شمارش وضعیت دسته‌هاست — اثبات cutover تمیز یا تمامیت Baseline نیست. حوزه‌های اشتغال/انتصاب ممکن است unavailable باشند.";

/**
 * Aggregate import_batch statuses for ops dashboard.
 * Schema-missing → schemaAvailable false (caller marks unavailable; no invented green).
 */
export async function getOpsImportBatchSummary(
  db: PgQueryable,
): Promise<OpsImportBatchSummary> {
  try {
    const res = await db.query<{ status: string; c: string | number }>(
      `SELECT status, COUNT(*)::int AS c
       FROM migration_staging.import_batch
       GROUP BY status`,
    );
    const byStatus: Partial<Record<StagingBatchStatus, number>> = {};
    let totalBatches = 0;
    let unknownStatusCount = 0;
    for (const row of res.rows) {
      const count = Number(row.c ?? 0);
      if (!Number.isFinite(count)) continue;
      if (!KNOWN_STAGING_BATCH_STATUSES.has(row.status as StagingBatchStatus)) {
        unknownStatusCount += count;
        totalBatches += count;
        continue;
      }
      const status = row.status as StagingBatchStatus;
      byStatus[status] = count;
      totalBatches += count;
    }
    const recentFailed = await db.query<{ c: string | number }>(
      `SELECT COUNT(*)::int AS c
       FROM migration_staging.import_batch
       WHERE status IN ('failed', 'rolled-back')`,
    );
    return {
      byStatus,
      recentFailedCount: Number(recentFailed.rows[0]?.c ?? 0),
      totalBatches,
      honestyFa: IMPORT_OPS_HONESTY_FA,
      schemaAvailable: true,
      unknownStatusCount,
    };
  } catch {
    // Schema may not exist yet — honest unavailable, not invented zeros implying clean cutover.
    return {
      byStatus: {},
      recentFailedCount: 0,
      totalBatches: 0,
      honestyFa:
        "جدول ورود در دسترس نیست یا هنوز راه‌اندازی نشده — وضعیت ورود unavailable است؛ صفر جعلی برای cutover تمیز نیست.",
      schemaAvailable: false,
      unknownStatusCount: 0,
    };
  }
}
