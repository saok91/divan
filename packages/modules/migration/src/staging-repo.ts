/**
 * Durable migration staging repository (Story 6.2 / AD-4).
 * Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
 *
 * Ops: preview drafts may remain in-process until promote-to-staging
 * (confirm → staging). Approve/execute paths are multi-instance safe
 * because they only read/write this schema.
 */

import { createHash, randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "@divan/db";
import { withTransaction } from "@divan/event-store";

import { MigrationError } from "./errors";
import type { ImportPreviewBatch, ImportPreviewRow } from "./preview-batch";
import { assertUploadApproveSegregation } from "./sod";
import {
  getLaunchImportTemplate,
  isLaunchImportTemplateKey,
} from "./templates";

export type StagingBatchStatus =
  | "confirmed-draft"
  | "approved"
  | "executing"
  | "cutover-complete"
  | "failed"
  | "rolled-back";

export type StagingBatchRow = {
  rowId: string;
  sourceRow: number;
  values: Record<string, string>;
};

export type StagingBatchRecord = {
  id: string;
  previewBatchId: string;
  templateKey: string;
  templateTitleFa: string;
  status: StagingBatchStatus;
  correlationId: string;
  idempotencyKey: string;
  sourceFileName: string | null;
  sourceContentHash: string;
  uploadedBy: string;
  uploadedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  executedBy: string | null;
  executedAt: string | null;
  ownerDisplayName: string;
  visibleColumns: Array<{ key: string; headerFa: string }>;
  rows: StagingBatchRow[];
  /** Executor must not mutate after approved — rows are frozen copy. */
  payloadFrozen: boolean;
};

export type PromoteToStagingInput = {
  preview: ImportPreviewBatch;
  /** Full unfiltered rows (not permission-omitted). */
  fullRows: ImportPreviewRow[];
  uploadedByAccountId: string;
  ownerDisplayName?: string;
  sourceFileName?: string | null;
  /** Precomputed content hash; if omitted, derived from frozen rows. */
  sourceContentHash?: string;
};

type PgQueryable = Pool | PoolClient;

function hashFrozenPayload(
  templateKey: string,
  rows: StagingBatchRow[],
): string {
  const canonical = JSON.stringify({
    templateKey,
    rows: rows
      .map((r) => ({
        sourceRow: r.sourceRow,
        values: Object.keys(r.values)
          .sort()
          .reduce<Record<string, string>>((acc, k) => {
            acc[k] = r.values[k] ?? "";
            return acc;
          }, {}),
      }))
      .sort((a, b) => a.sourceRow - b.sourceRow),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function buildIdempotencyKey(opts: {
  sourceContentHash: string;
  templateKey: string;
  batchId: string;
}): string {
  return `${opts.templateKey}:${opts.sourceContentHash}:${opts.batchId}`;
}

function mapBatchRow(row: Record<string, unknown>): Omit<
  StagingBatchRecord,
  "rows" | "payloadFrozen"
> {
  return {
    id: String(row.id),
    previewBatchId: String(row.preview_batch_id),
    templateKey: String(row.template_key),
    templateTitleFa: String(row.template_title_fa ?? ""),
    status: row.status as StagingBatchStatus,
    correlationId: String(row.correlation_id),
    idempotencyKey: String(row.idempotency_key),
    sourceFileName:
      row.source_file_name == null ? null : String(row.source_file_name),
    sourceContentHash: String(row.source_content_hash),
    uploadedBy: String(row.uploaded_by),
    uploadedAt: new Date(String(row.uploaded_at)).toISOString(),
    approvedBy: row.approved_by == null ? null : String(row.approved_by),
    approvedAt:
      row.approved_at == null
        ? null
        : new Date(String(row.approved_at)).toISOString(),
    executedBy: row.executed_by == null ? null : String(row.executed_by),
    executedAt:
      row.executed_at == null
        ? null
        : new Date(String(row.executed_at)).toISOString(),
    ownerDisplayName: String(row.owner_display_name ?? ""),
    visibleColumns: Array.isArray(row.visible_columns)
      ? (row.visible_columns as Array<{ key: string; headerFa: string }>)
      : typeof row.visible_columns === "string"
        ? (JSON.parse(row.visible_columns) as Array<{
            key: string;
            headerFa: string;
          }>)
        : [],
  };
}

async function loadRows(
  db: PgQueryable,
  batchId: string,
): Promise<StagingBatchRow[]> {
  const res = await db.query(
    `SELECT row_id, source_row, values
     FROM migration_staging.import_batch_row
     WHERE batch_id = $1::uuid
     ORDER BY source_row ASC`,
    [batchId],
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    rowId: String(r.row_id),
    sourceRow: Number(r.source_row),
    values:
      typeof r.values === "string"
        ? (JSON.parse(r.values) as Record<string, string>)
        : ((r.values ?? {}) as Record<string, string>),
  }));
}

/**
 * Promote a confirmed in-memory draft into durable staging.
 * Idempotent on preview_batch_id. Header + rows insert in one TX.
 */
export async function promoteConfirmedDraftToStaging(
  pool: Pool,
  input: PromoteToStagingInput,
): Promise<StagingBatchRecord> {
  if (input.preview.status !== "confirmed-draft") {
    throw new MigrationError(
      "VALIDATION_FAILED",
      "فقط پیش‌نویس تأییدشده به انبار موقت منتقل می‌شود.",
    );
  }
  if (input.preview.errorCount > 0) {
    throw new MigrationError(
      "VALIDATION_FAILED",
      "دسته دارای خطای اعتبارسنجی است و قابل انتقال نیست.",
    );
  }

  const existing = await pool.query(
    `SELECT id FROM migration_staging.import_batch
     WHERE preview_batch_id = $1::uuid`,
    [input.preview.previewBatchId],
  );
  if (existing.rows[0]) {
    return getStagingBatch(pool, String(existing.rows[0].id));
  }

  const rows: StagingBatchRow[] = input.fullRows.map((r) => ({
    rowId: r.rowId,
    sourceRow: r.sourceRow,
    values: { ...r.values },
  }));
  const sourceContentHash =
    input.sourceContentHash ??
    hashFrozenPayload(input.preview.templateKey, rows);
  const batchId = randomUUID();
  const correlationId = randomUUID();
  const idempotencyKey = buildIdempotencyKey({
    sourceContentHash,
    templateKey: input.preview.templateKey,
    batchId,
  });
  const now = new Date();

  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO migration_staging.import_batch (
         id, preview_batch_id, template_key, status, correlation_id,
         idempotency_key, source_file_name, source_content_hash,
         uploaded_by, uploaded_at, owner_display_name, template_title_fa,
         visible_columns
       ) VALUES (
         $1::uuid, $2::uuid, $3, 'confirmed-draft', $4::uuid,
         $5, $6, $7,
         $8, $9::timestamptz, $10, $11,
         $12::jsonb
       )`,
      [
        batchId,
        input.preview.previewBatchId,
        input.preview.templateKey,
        correlationId,
        idempotencyKey,
        input.sourceFileName ?? null,
        sourceContentHash,
        input.uploadedByAccountId,
        now.toISOString(),
        input.ownerDisplayName ?? input.uploadedByAccountId,
        input.preview.templateTitleFa,
        JSON.stringify(input.preview.visibleColumns),
      ],
    );

    for (const row of rows) {
      await client.query(
        `INSERT INTO migration_staging.import_batch_row (
           id, batch_id, row_id, source_row, values
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb)`,
        [
          randomUUID(),
          batchId,
          row.rowId,
          row.sourceRow,
          JSON.stringify(row.values),
        ],
      );
    }
  });

  return getStagingBatch(pool, batchId);
}

export async function getStagingBatch(
  db: PgQueryable,
  batchId: string,
): Promise<StagingBatchRecord> {
  const res = await db.query(
    `SELECT * FROM migration_staging.import_batch WHERE id = $1::uuid`,
    [batchId],
  );
  const row = res.rows[0];
  if (!row) {
    throw new MigrationError(
      "STAGING_NOT_FOUND",
      "دسته موقت واردسازی یافت نشد.",
    );
  }
  const header = mapBatchRow(row as Record<string, unknown>);
  const rows = await loadRows(db, header.id);
  const payloadFrozen = ![
    "confirmed-draft",
  ].includes(header.status);
  return { ...header, rows, payloadFrozen };
}

export async function getStagingBatchByPreviewId(
  db: PgQueryable,
  previewBatchId: string,
): Promise<StagingBatchRecord | null> {
  const res = await db.query(
    `SELECT id FROM migration_staging.import_batch
     WHERE preview_batch_id = $1::uuid`,
    [previewBatchId],
  );
  if (!res.rows[0]) return null;
  return getStagingBatch(db, String(res.rows[0].id));
}

/**
 * Approve freezes payload — executor cannot mutate rows after this.
 * Concurrent approvers race via WHERE status = 'confirmed-draft'.
 * Failed/rolled-back batches cannot be re-approved (staging rows dropped).
 */
export async function approveStagingBatch(
  db: PgQueryable,
  opts: {
    batchId: string;
    approverAccountId: string;
    ownerDisplayName?: string;
    /** Default true — uploader cannot approve. */
    segregationOn?: boolean;
  },
): Promise<StagingBatchRecord> {
  const batch = await getStagingBatch(db, opts.batchId);
  if (batch.status === "approved") {
    if (batch.approvedBy === opts.approverAccountId) {
      return batch;
    }
    throw new MigrationError(
      "BATCH_IMMUTABLE",
      "این دسته قبلاً تأیید شده و محتوای آن منجمد است.",
    );
  }
  if (batch.status !== "confirmed-draft") {
    throw new MigrationError(
      "BATCH_NOT_APPROVED",
      "وضعیت دسته برای تأیید معتبر نیست.",
    );
  }

  assertUploadApproveSegregation({
    uploadedByAccountId: batch.uploadedBy,
    approverAccountId: opts.approverAccountId,
    segregationOn: opts.segregationOn,
  });

  const now = new Date().toISOString();
  const updated = await db.query(
    `UPDATE migration_staging.import_batch
     SET status = 'approved',
         approved_by = $2,
         approved_at = $3::timestamptz,
         owner_display_name = COALESCE(NULLIF($4, ''), owner_display_name),
         error_summary = NULL,
         updated_at = $3::timestamptz
     WHERE id = $1::uuid
       AND status = 'confirmed-draft'
     RETURNING id`,
    [
      opts.batchId,
      opts.approverAccountId,
      now,
      opts.ownerDisplayName ?? "",
    ],
  );
  if ((updated.rowCount ?? 0) === 0) {
    throw new MigrationError(
      "BATCH_NOT_APPROVED",
      "وضعیت دسته برای تأیید معتبر نیست.",
    );
  }

  return getStagingBatch(db, opts.batchId);
}

export async function markStagingStatus(
  db: PgQueryable,
  batchId: string,
  status: StagingBatchStatus,
  extras?: {
    executedBy?: string;
    executedAt?: Date;
    errorSummary?: unknown;
  },
): Promise<void> {
  await db.query(
    `UPDATE migration_staging.import_batch
     SET status = $2,
         executed_by = COALESCE($3, executed_by),
         executed_at = COALESCE($4::timestamptz, executed_at),
         error_summary = COALESCE($5::jsonb, error_summary),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid`,
    [
      batchId,
      status,
      extras?.executedBy ?? null,
      extras?.executedAt?.toISOString() ?? null,
      extras?.errorSummary != null
        ? JSON.stringify(extras.errorSummary)
        : null,
    ],
  );
}

/**
 * Pre-cutover rollback: drop staging rows + overlap keys for the batch,
 * mark evidence rolled-back. Caller must assert zero production events
 * for the batch correlation (see assertZeroProductionTrace).
 */
export async function rollbackStagingBatch(
  db: PgQueryable,
  batchId: string,
): Promise<StagingBatchRecord> {
  const batch = await getStagingBatch(db, batchId);
  if (batch.status === "cutover-complete") {
    throw new MigrationError(
      "STAGING_ROLLBACK_FAILED",
      "دسته قطعی‌سازی‌شده قابل بازگشت از انبار موقت نیست.",
    );
  }

  await db.query(
    `DELETE FROM migration_staging.execution_overlap_key WHERE batch_id = $1::uuid`,
    [batchId],
  );
  await db.query(
    `DELETE FROM migration_staging.import_batch_row WHERE batch_id = $1::uuid`,
    [batchId],
  );
  await db.query(
    `UPDATE migration_staging.import_batch
     SET status = 'rolled-back', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid`,
    [batchId],
  );

  return getStagingBatch(db, batchId);
}

export async function countSuccessfulCutoverEvidence(
  db: PgQueryable,
): Promise<number> {
  const res = await db.query(
    `SELECT COUNT(*)::int AS c
     FROM migration_staging.import_batch_evidence
     WHERE status = 'cutover-complete'`,
  );
  return Number(res.rows[0]?.c ?? 0);
}

export async function listSuccessfulCutoverEvidence(
  db: PgQueryable,
  limit = 100,
): Promise<
  Array<{
    batchId: string;
    correlationId: string;
    status: string;
    actors: unknown;
    counts: unknown;
    createdRecordIds: unknown;
    createdEventIds: unknown;
    createdAt: string;
  }>
> {
  const res = await db.query(
    `SELECT batch_id, correlation_id, status, actors, counts,
            created_record_ids, created_event_ids, created_at
     FROM migration_staging.import_batch_evidence
     WHERE status = 'cutover-complete'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    batchId: String(r.batch_id),
    correlationId: String(r.correlation_id),
    status: String(r.status),
    actors: r.actors,
    counts: r.counts,
    createdRecordIds: r.created_record_ids,
    createdEventIds: r.created_event_ids,
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

/**
 * Actor-derived column omit for staging reveal (AC #7).
 * Full payload remains frozen in DB; response projection only.
 */
export function projectStagingBatchForViewer(
  batch: StagingBatchRecord,
  opts: {
    permittedDataCategories: ReadonlySet<string>;
    omittedColumnKeys?: ReadonlySet<string>;
  },
): StagingBatchRecord {
  if (!isLaunchImportTemplateKey(batch.templateKey)) {
    return batch;
  }
  const template = getLaunchImportTemplate(batch.templateKey);
  if (!template) return batch;
  const omit = opts.omittedColumnKeys ?? new Set<string>();
  const visible = template.columns.filter(
    (c) =>
      opts.permittedDataCategories.has(c.dataCategory) && !omit.has(c.key),
  );
  const visibleKeys = visible.map((c) => c.key);
  const visibleKeySet = new Set(visibleKeys);
  return {
    ...batch,
    visibleColumns: visible.map((c) => ({
      key: c.key,
      headerFa: c.headerFa,
    })),
    rows: batch.rows.map((r) => {
      const values: Record<string, string> = {};
      for (const key of visibleKeys) {
        if (Object.prototype.hasOwnProperty.call(r.values, key) || key in r.values) {
          values[key] = r.values[key] ?? "";
        }
      }
      // Drop rows that lose personnelCode identity when that column is omitted
      // — keep row shell with remaining visible fields.
      void visibleKeySet;
      return { rowId: r.rowId, sourceRow: r.sourceRow, values };
    }),
  };
}
