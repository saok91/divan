/**
 * Day-to-day bulk commit (Story 9.2 / FR-59).
 *
 * Reuses FR-37 staging + FR-38 atomic cutover / mutex / evidence, but gates
 * only on `template.requiredPermission` — never migration.approve / execute
 * SoD or reconciliation workspace. Migration `/import` SoD path stays intact.
 */

import type { Pool } from "@divan/db";

import {
  getLatestBatchEvidence,
  type ImportBatchEvidence,
} from "./batch-evidence";
import { formatConcurrentBatchMessage } from "./concurrent-mutex";
import { MigrationError } from "./errors";
import {
  mapCutoverCounts,
  performAtomicCutover,
  type ExecuteBatchResult,
} from "./execute-batch";
import type { SodPermissionHolder } from "./sod";
import { getStagingBatch, type StagingBatchRecord } from "./staging-repo";
import {
  getLaunchImportTemplate,
  isLaunchImportTemplateKey,
} from "./templates";

export type DayToDayBulkCommitOptions = {
  batchId: string;
  actorAccountId: string;
  actorDisplayName?: string;
  permissionHolder: SodPermissionHolder;
};

export type DayToDayBulkCommitResult = ExecuteBatchResult & {
  correlationId: string;
};

async function assertTemplateCreatePermission(
  holder: SodPermissionHolder,
  requiredPermission: string,
): Promise<void> {
  const ok = await holder.holds(requiredPermission);
  if (!ok) {
    throw new MigrationError(
      "PERMISSION_DENIED",
      `مجوز ایجاد برای این قالب را ندارید (${requiredPermission}).`,
    );
  }
}

function countsFromEvidence(evidence: ImportBatchEvidence): {
  created: number;
  updated: number;
  rejected: number;
} {
  return mapCutoverCounts({
    createdPersonCount: evidence.counts.createdPersonCount,
    recordIdsLength: evidence.createdRecordIds.length,
    rejected:
      evidence.status === "failed" || evidence.status === "rolled-back"
        ? evidence.counts.errorCount
        : 0,
  });
}

/**
 * Commit a confirmed-draft staging batch without migration SoD.
 * Idempotent when already cutover-complete.
 */
export async function commitDayToDayBulk(
  pool: Pool,
  opts: DayToDayBulkCommitOptions,
): Promise<DayToDayBulkCommitResult> {
  const batch = await getStagingBatch(pool, opts.batchId);

  if (!isLaunchImportTemplateKey(batch.templateKey)) {
    throw new MigrationError(
      "TEMPLATE_UNKNOWN",
      "قالب دسته برای ورود گروهی شناخته نشد.",
    );
  }
  const template = getLaunchImportTemplate(batch.templateKey);
  if (!template) {
    throw new MigrationError(
      "TEMPLATE_UNKNOWN",
      "قالب دسته برای ورود گروهی شناخته نشد.",
    );
  }

  await assertTemplateCreatePermission(
    opts.permissionHolder,
    template.requiredPermission,
  );

  if (batch.status === "cutover-complete") {
    const prior = await getLatestBatchEvidence(pool, batch.id);
    if (prior && prior.status === "cutover-complete") {
      return {
        batch,
        evidence: prior,
        idempotentReplay: true,
        correlationId: batch.correlationId,
        ...countsFromEvidence(prior),
      };
    }
    throw new MigrationError(
      "IDEMPOTENCY_CONFLICT",
      "دسته قطعی‌سازی‌شده است اما مدرک اجرا یافت نشد.",
    );
  }

  if (batch.status === "executing") {
    throw new MigrationError(
      "CONCURRENT_BATCH",
      formatConcurrentBatchMessage({
        ownerDisplayName: batch.ownerDisplayName || batch.executedBy || "",
        correlationId: batch.correlationId,
      }),
      {
        ownerDisplayName: batch.ownerDisplayName || batch.executedBy || "",
        correlationId: batch.correlationId,
      },
    );
  }

  if (batch.status === "failed" || batch.status === "rolled-back") {
    throw new MigrationError(
      "BATCH_NOT_APPROVED",
      "دسته ناموفق است و ردیف‌های موقت پاک شده‌اند؛ بارگذاری جدید لازم است.",
    );
  }

  // Day-to-day skips migration approve — only confirmed-draft is eligible.
  // Migration "approved" batches stay on the SoD execute path.
  if (batch.status !== "confirmed-draft") {
    throw new MigrationError(
      "BATCH_NOT_APPROVED",
      "وضعیت دسته برای ورود گروهی معتبر نیست.",
    );
  }

  const display =
    opts.actorDisplayName?.trim() || opts.actorAccountId;

  const result = await performAtomicCutover(pool, {
    batch,
    claimFromStatus: "confirmed-draft",
    executorAccountId: opts.actorAccountId,
    executorDisplayName: display,
  });

  return {
    batch: result.batch,
    evidence: result.evidence,
    idempotentReplay: false,
    correlationId: result.batch.correlationId,
    created:
      result.createdPersonIds.length + result.createdDomainRecordIds.length,
    updated: result.matchedPersonIds.length,
    rejected: 0,
  };
}

/** Narrow re-export for callers that only need the staging shape. */
export type { StagingBatchRecord };
