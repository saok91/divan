/**
 * Atomic import batch cutover (Story 6.2 / AD-4 / FR-38).
 *
 * Pipeline: revalidate → mutex → withTransaction(append BaselineRecorded) → evidence.
 * Production event-store ingress only here — never from preview/confirm.
 *
 * AD-6 honesty (accepted review Decision): `createPerson` uses Prisma (published
 * PE API) outside the event-store PoolClient TX. Mid-cutover abort can leave
 * orphan Person rows while Baseline events roll back. `assertZeroProductionTrace`
 * only counts `kernel_events` by correlation_id — not Person rows. Full Prisma↔Pool
 * orphan hardening remains an open Epic 4 / AD-6 action (story Absolute non-goal).
 *
 * FR-40 / LG-1: production tier requires verified signed reconciliation run
 * (Story 6.4). Trial/staging may execute without signed final reconciliation.
 * source=migration is audit metadata only — never an authz or cutover unlock.
 */

import {
  beginEvaluationSnapshot,
  bindOperationToSnapshot,
  computeContentFingerprint,
  EvaluationSnapshotError,
  markEvaluationSnapshotTerminal,
  revalidateEvaluationSnapshot,
  throwEvaluationSnapshotConflict,
} from "@divan/audit-envelope";
import type { Pool, PoolClient } from "@divan/db";
import {
  appendBusinessEvent,
  withTransaction,
} from "@divan/event-store";
import {
  PersonIdentityError,
  createPerson,
  getGradeById,
  getJobTitleById,
  getLadderById,
  getOrgUnitById,
  getOrganizationalRoleById,
  getPersonByPersonnelCode,
  type CreatePersonInput,
} from "@divan/person-employment";

import {
  getLatestBatchEvidence,
  persistBatchEvidence,
  type ImportBatchEvidence,
} from "./batch-evidence";
import {
  acquireOverlapLocks,
  buildOverlapKeys,
  formatConcurrentBatchMessage,
  releaseOverlapLocksForBatch,
} from "./concurrent-mutex";
import { MigrationError } from "./errors";
import { assertProductionReconciliationGate } from "./reconciliation";
import {
  assertApproveExecuteSegregation,
  assertMigrationExecutePermission,
  type SodPermissionHolder,
} from "./sod";
import {
  getStagingBatch,
  markStagingStatus,
  rollbackStagingBatch,
  type StagingBatchRecord,
  type StagingBatchRow,
} from "./staging-repo";
import {
  formatImportIssueCite,
  validateImportMatrix,
  type ImportIssue,
} from "./validate-import";
import {
  getLaunchImportTemplate,
  isLaunchImportTemplateKey,
} from "./templates";
import type { ParsedImportMatrix } from "./parse-workbook";
import { BASELINE_RECORDED_EVENT_TYPE } from "./event-origin";

export { BASELINE_RECORDED_EVENT_TYPE };

export type ExecuteBatchResult = {
  batch: StagingBatchRecord;
  evidence: ImportBatchEvidence;
  /** True when a prior successful cutover was returned (idempotent). */
  idempotentReplay: boolean;
};

export type ExecuteBatchOptions = {
  batchId: string;
  executorAccountId: string;
  executorDisplayName?: string;
  permissionHolder: SodPermissionHolder;
  /** Default true — same actor cannot approve+execute. */
  segregationOn?: boolean;
  /**
   * Production requires a verified signed reconciliation run id (DB-backed).
   * Arbitrary client strings are rejected by assertProductionReconciliationGate.
   * Trial/staging may omit.
   */
  cutoverTier?: "trial" | "staging" | "production";
  /** UUID of signed reconciliation_run linked to this batch. */
  reconciliationRunId?: string | null;
};

function rowToCreatePersonInput(values: Record<string, string>): CreatePersonInput {
  const input: CreatePersonInput = {
    personnelCode: values.personnelCode ?? "",
    givenName: values.givenName ?? "",
    familyName: values.familyName ?? "",
    mobilePhone: values.mobilePhone ?? "",
  };
  if (values.fatherName?.trim()) input.fatherName = values.fatherName.trim();
  if (values.birthDate?.trim()) input.birthDate = values.birthDate.trim();
  if (values.gender?.trim()) input.gender = values.gender.trim();
  if (values.nationality?.trim()) input.nationality = values.nationality.trim();
  return input;
}

function stagingRowsToParsedMatrix(
  batch: StagingBatchRecord,
): ParsedImportMatrix {
  if (!isLaunchImportTemplateKey(batch.templateKey)) {
    throw new MigrationError(
      "TEMPLATE_UNKNOWN",
      "قالب دسته برای اعتبارسنجی مجدد شناخته نشد.",
    );
  }
  const template = getLaunchImportTemplate(batch.templateKey);
  if (!template) {
    throw new MigrationError(
      "TEMPLATE_UNKNOWN",
      "قالب دسته برای اعتبارسنجی مجدد شناخته نشد.",
    );
  }
  return {
    template,
    headers: template.columns.map((c) => c.headerFa),
    columnKeys: template.columns.map((c) => c.key),
    rows: batch.rows.map((r) => ({ ...r.values })),
    sourceRowNumbers: batch.rows.map((r) => r.sourceRow),
  };
}

/**
 * Re-run FR-37 validators against frozen staging rows before cutover.
 */
export function revalidateStagingBatch(batch: StagingBatchRecord): ImportIssue[] {
  const parsed = stagingRowsToParsedMatrix(batch);
  return validateImportMatrix(parsed);
}

/**
 * Authoritative live FK checks via published PE APIs (AC #3).
 */
export async function revalidateAuthoritativeReferences(
  batch: StagingBatchRecord,
): Promise<void> {
  for (const row of batch.rows) {
    const teamId = (row.values.teamId ?? "").trim();
    if (teamId) {
      const unit = await getOrgUnitById(teamId);
      if (!unit || unit.unitType !== "TEAM") {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: شناسه تیم در وضعیت جاری معتبر نیست.`,
        );
      }
    }
    const roleId = (row.values.organizationalRoleId ?? "").trim();
    if (roleId) {
      const role = await getOrganizationalRoleById(roleId);
      if (!role) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: شناسه نقش سازمانی یافت نشد.`,
        );
      }
    }
    const jobTitleId = (row.values.jobTitleId ?? "").trim();
    if (jobTitleId) {
      const job = await getJobTitleById(jobTitleId);
      if (!job) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: شناسه عنوان شغلی یافت نشد.`,
        );
      }
    }
    const ladderId = (row.values.ladderId ?? "").trim();
    if (ladderId) {
      const ladder = await getLadderById(ladderId);
      if (!ladder) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: شناسه نردبان یافت نشد.`,
        );
      }
    }
    const gradeId = (row.values.gradeId ?? "").trim();
    if (gradeId) {
      const grade = await getGradeById(gradeId);
      if (!grade) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: شناسه گرید یافت نشد.`,
        );
      }
    }
  }
}

function assertNoDuplicatePersonnelCodes(issues: ImportIssue[]): void {
  const dups = issues.filter(
    (i) =>
      i.severity === "warning" &&
      i.column === "personnelCode" &&
      i.messageFa.includes("در چند ردیف"),
  );
  if (dups.length > 0) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `اعتبارسنجی مجدد ناموفق: ${formatImportIssueCite(dups[0]!)}`,
    );
  }
}

/**
 * Assert no production business events exist for this batch correlation.
 * Used after pre-cutover rollback / failed cutover (AC #4).
 *
 * Honesty: does not detect Prisma Person orphans (see file header AD-6 note).
 */
export async function assertZeroProductionTrace(
  client: PoolClient,
  correlationId: string,
): Promise<void> {
  const res = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM kernel_events
     WHERE correlation_id = $1::uuid
       AND event_class = 'business'`,
    [correlationId],
  );
  const count = Number(res.rows[0]?.c ?? 0);
  if (count > 0) {
    throw new MigrationError(
      "CUTOVER_FAILED",
      `ردی از رویدادهای تولید برای این دسته باقی مانده است (${count}).`,
    );
  }
}

function mapPersonIdentityToMigration(err: PersonIdentityError): never {
  throw new MigrationError(
    err.code === "PERMISSION_DENIED" ? "SOD_VIOLATION" : "REVALIDATION_FAILED",
    err.messageFa,
  );
}

/**
 * Story 7.8 — canonical payload for the batch-wide evaluation snapshot.
 * Structural refs + personnel codes only — never given/family names or other PII.
 */
function buildImportEvaluationPayload(
  batch: StagingBatchRecord,
): Record<string, unknown> {
  return {
    batchId: batch.id,
    rows: batch.rows.map((r) => ({
      personnelCode: (r.values.personnelCode ?? "").trim(),
      teamId: r.values.teamId ?? null,
      organizationalRoleId: r.values.organizationalRoleId ?? null,
      jobTitleId: r.values.jobTitleId ?? null,
      ladderId: r.values.ladderId ?? null,
      gradeId: r.values.gradeId ?? null,
    })),
  };
}

/** Story 7.8 — bound refs re-checked at each revalidation point. */
function buildImportEvaluationBoundRefs(
  batch: StagingBatchRecord,
  overlapKeys: readonly string[],
): Record<string, unknown> {
  return {
    batchId: batch.id,
    overlapKeys: [...overlapKeys].sort(),
    rowCount: batch.rows.length,
  };
}

/** Fail-closed message/code resolution across MigrationError / EvaluationSnapshotError. */
function resolveFailureMessageFa(err: unknown): string {
  if (err instanceof MigrationError) return err.messageFa;
  if (err instanceof EvaluationSnapshotError) return err.messageFa;
  return "اجرای دسته ناموفق بود.";
}

function resolveFailureCode(err: unknown): string {
  if (err instanceof MigrationError) return err.code;
  if (err instanceof EvaluationSnapshotError) return err.code;
  return "CUTOVER_FAILED";
}

async function cutoverRowsInTx(
  client: PoolClient,
  batch: StagingBatchRecord,
  executorAccountId: string,
): Promise<{
  createdPersonIds: string[];
  matchedPersonIds: string[];
  eventIds: string[];
}> {
  const createdPersonIds: string[] = [];
  const matchedPersonIds: string[] = [];
  const eventIds: string[] = [];

  for (const row of batch.rows) {
    const code = (row.values.personnelCode ?? "").trim();
    if (!code) {
      throw new MigrationError(
        "REVALIDATION_FAILED",
        `ردیف ${row.sourceRow}: کد پرسنلی خالی است.`,
      );
    }

    let person;
    try {
      person = await getPersonByPersonnelCode(code);
      if (!person) {
        person = await createPerson(rowToCreatePersonInput(row.values), {
          accountId: executorAccountId,
          correlationId: batch.correlationId,
        });
        createdPersonIds.push(person.id);
      } else {
        matchedPersonIds.push(person.id);
      }
    } catch (err) {
      if (err instanceof PersonIdentityError) mapPersonIdentityToMigration(err);
      throw err;
    }

    const effectiveDate =
      (row.values.startDate ?? "").trim() ||
      new Date().toISOString().slice(0, 10);

    const { id: eventId } = await appendBusinessEvent(client, {
      correlationId: batch.correlationId,
      eventType: BASELINE_RECORDED_EVENT_TYPE,
      personId: person.id,
      effectiveDate,
      registeredBy: executorAccountId,
      status: "Effective",
      finalizedBy: executorAccountId,
      finalizedAt: new Date(),
      // provenance.source=migration is audit metadata only (FR-39 / AD-4) —
      // never a cutover/authz control; SoD/approve/execute gate elsewhere.
      provenance: {
        source: "migration",
        batchId: batch.id,
        previewBatchId: batch.previewBatchId,
        templateKey: batch.templateKey,
        sourceRow: row.sourceRow,
      },
      payload: {
        source: "migration",
        rowId: row.rowId,
        teamId: row.values.teamId ?? null,
        organizationalRoleId: row.values.organizationalRoleId ?? null,
        jobTitleId: row.values.jobTitleId ?? null,
        ladderId: row.values.ladderId ?? null,
        gradeId: row.values.gradeId ?? null,
        seniorityId: row.values.seniorityId ?? null,
        collaborationType: row.values.collaborationType ?? null,
      },
      afterEvidence: {
        personnelCode: code,
        personId: person.id,
      },
    });
    eventIds.push(eventId);
  }

  return { createdPersonIds, matchedPersonIds, eventIds };
}

/**
 * Execute approved staging batch: revalidate, mutex, atomic cutover, evidence.
 * Repeat of successful batch returns prior evidence (idempotent — no duplicate events).
 * Failed batches require a new upload/approve cycle after staging drop
 * (review Decision #3 + AC #4).
 */
export async function executeImportBatch(
  pool: Pool,
  opts: ExecuteBatchOptions,
): Promise<ExecuteBatchResult> {
  await assertMigrationExecutePermission(opts.permissionHolder);

  const batch = await getStagingBatch(pool, opts.batchId);

  // Idempotent replay of successful cutover
  if (batch.status === "cutover-complete") {
    const prior = await getLatestBatchEvidence(pool, batch.id);
    if (prior && prior.status === "cutover-complete") {
      return { batch, evidence: prior, idempotentReplay: true };
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

  if (batch.status === "failed") {
    throw new MigrationError(
      "BATCH_NOT_APPROVED",
      "دسته ناموفق است و ردیف‌های موقت پاک شده‌اند؛ بارگذاری و تأیید جدید لازم است.",
    );
  }

  if (batch.status !== "approved") {
    if (batch.status === "confirmed-draft") {
      throw new MigrationError(
        "BATCH_NOT_APPROVED",
        "دسته هنوز تأیید نشده است.",
      );
    }
    throw new MigrationError(
      "BATCH_NOT_APPROVED",
      "وضعیت دسته برای اجرا معتبر نیست.",
    );
  }

  if (!batch.approvedBy) {
    throw new MigrationError(
      "BATCH_NOT_APPROVED",
      "دسته هنوز تأیید نشده است.",
    );
  }

  assertApproveExecuteSegregation({
    approvedByAccountId: batch.approvedBy,
    executorAccountId: opts.executorAccountId,
    segregationOn: opts.segregationOn,
  });

  const tier = opts.cutoverTier ?? "trial";
  if (tier === "production") {
    // Verify persisted signed reconciliation — never unlock on free-string token.
    // source=migration remains audit metadata only (not an authz unlock).
    await assertProductionReconciliationGate(pool, {
      batchId: opts.batchId,
      reconciliationRunId: opts.reconciliationRunId,
    });
  }

  const issues = revalidateStagingBatch(batch);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `اعتبارسنجی مجدد ناموفق: ${formatImportIssueCite(errors[0]!)}`,
    );
  }
  assertNoDuplicatePersonnelCodes(issues);
  await revalidateAuthoritativeReferences(batch);

  const overlapKeys = buildOverlapKeys(batch.rows);
  const executorDisplay =
    opts.executorDisplayName?.trim() || opts.executorAccountId;

  let evalSnapId: string | null = null;
  let evalSnapFingerprint: string | null = null;

  try {
    const result = await withTransaction(pool, async (client) => {
      const claimed = await client.query(
        `SELECT id FROM migration_staging.import_batch
         WHERE id = $1::uuid AND status = 'approved'
         FOR UPDATE`,
        [batch.id],
      );
      if ((claimed.rowCount ?? 0) === 0) {
        throw new MigrationError(
          "CONCURRENT_BATCH",
          formatConcurrentBatchMessage({
            ownerDisplayName: batch.ownerDisplayName || "",
            correlationId: batch.correlationId,
          }),
          {
            ownerDisplayName: batch.ownerDisplayName || "",
            correlationId: batch.correlationId,
          },
        );
      }

      await markStagingStatus(client, batch.id, "executing", {
        executedBy: opts.executorAccountId,
        executedAt: new Date(),
      });

      await acquireOverlapLocks(client, {
        overlapKeys,
        holder: {
          batchId: batch.id,
          ownerAccountId: opts.executorAccountId,
          ownerDisplayName: executorDisplay,
          correlationId: batch.correlationId,
        },
      });

      // Story 7.8 — bind under claim/mutex (AC4 Task 3).
      const evalSnap = await beginEvaluationSnapshot(client, {
        kind: "import_execution",
        payload: buildImportEvaluationPayload(batch),
        attribution: { actorAccountId: opts.executorAccountId },
        correlationId: batch.correlationId,
        boundRefs: buildImportEvaluationBoundRefs(batch, overlapKeys),
      });
      evalSnapId = evalSnap.id;
      evalSnapFingerprint = evalSnap.contentFingerprint;

      // Live org/role/ref re-check + fingerprint — concurrent drift fails closed.
      await revalidateAuthoritativeReferences(batch);
      const preCutoverCheck = await revalidateEvaluationSnapshot(
        client,
        { id: evalSnap.id },
        {
          liveFingerprint: computeContentFingerprint(
            buildImportEvaluationPayload(batch),
          ),
          boundRefs: buildImportEvaluationBoundRefs(batch, overlapKeys),
        },
      );
      if (!("ok" in preCutoverCheck)) {
        throwEvaluationSnapshotConflict(preCutoverCheck);
      }

      const { createdPersonIds, matchedPersonIds, eventIds } =
        await cutoverRowsInTx(client, batch, opts.executorAccountId);

      await markStagingStatus(client, batch.id, "cutover-complete", {
        executedBy: opts.executorAccountId,
        executedAt: new Date(),
      });

      await releaseOverlapLocksForBatch(client, batch.id);

      await revalidateAuthoritativeReferences(batch);
      const preCommitCheck = await revalidateEvaluationSnapshot(
        client,
        { id: evalSnap.id },
        {
          liveFingerprint: computeContentFingerprint(
            buildImportEvaluationPayload(batch),
          ),
          boundRefs: buildImportEvaluationBoundRefs(batch, overlapKeys),
        },
      );
      if (!("ok" in preCommitCheck)) {
        throwEvaluationSnapshotConflict(preCommitCheck);
      }

      await bindOperationToSnapshot(client, {
        snapshot: evalSnap,
        operationRef: {
          entityType: "import_batch",
          entityId: batch.id,
          eventIds,
        },
        markConsumed: true,
      });

      const allRecordIds = [...createdPersonIds, ...matchedPersonIds];
      const evidence = await persistBatchEvidence(client, {
        batchId: batch.id,
        correlationId: batch.correlationId,
        status: "cutover-complete",
        actors: {
          uploadedBy: batch.uploadedBy,
          uploadedAt: batch.uploadedAt,
          approvedBy: batch.approvedBy,
          approvedAt: batch.approvedAt,
          executedBy: opts.executorAccountId,
          executedAt: new Date().toISOString(),
          evaluationSnapshotId: evalSnap.id,
          evaluationSnapshotFingerprint: evalSnap.contentFingerprint,
        },
        counts: {
          rowCount: batch.rows.length,
          createdPersonCount: createdPersonIds.length,
          createdEventCount: eventIds.length,
          errorCount: 0,
        },
        createdRecordIds: allRecordIds,
        createdEventIds: eventIds,
      });

      return { createdPersonIds, matchedPersonIds, eventIds, evidence };
    });

    const updated = await getStagingBatch(pool, batch.id);
    return {
      batch: updated,
      evidence: result.evidence,
      idempotentReplay: false,
    };
  } catch (err) {
    // Pre-cutover / mid-cutover abort before COMMIT → TX rolled back by withTransaction
    // (including any in-TX evaluation_snapshot insert). Best-effort staging cleanup.
    // If a durable snapshot somehow survived outside this TX, expire it.
    if (evalSnapId) {
      try {
        await markEvaluationSnapshotTerminal(pool, evalSnapId, "expired", {
          reason: "import_execution_failed",
          code: resolveFailureCode(err),
        });
      } catch {
        // best-effort
      }
    }
    try {
      await withTransaction(pool, async (client) => {
        await assertZeroProductionTrace(client, batch.correlationId);
        await releaseOverlapLocksForBatch(client, batch.id);
        await rollbackStagingBatch(client, batch.id);
        await markStagingStatus(client, batch.id, "failed", {
          executedBy: opts.executorAccountId,
          executedAt: new Date(),
          errorSummary: {
            messageFa: resolveFailureMessageFa(err),
            code: resolveFailureCode(err),
          },
        });
        await persistBatchEvidence(client, {
          batchId: batch.id,
          correlationId: batch.correlationId,
          status: "failed",
          actors: {
            uploadedBy: batch.uploadedBy,
            uploadedAt: batch.uploadedAt,
            approvedBy: batch.approvedBy,
            approvedAt: batch.approvedAt,
            executedBy: opts.executorAccountId,
            executedAt: new Date().toISOString(),
            ...(evalSnapId && evalSnapFingerprint
              ? {
                  evaluationSnapshotId: evalSnapId,
                  evaluationSnapshotFingerprint: evalSnapFingerprint,
                }
              : {}),
          },
          counts: {
            rowCount: batch.rows.length,
            createdPersonCount: 0,
            createdEventCount: 0,
            errorCount: 1,
          },
          errors: [resolveFailureMessageFa(err)],
        });
      });
    } catch {
      // Best-effort cleanup; rethrow original
    }

    if (err instanceof MigrationError) throw err;
    if (err instanceof PersonIdentityError) mapPersonIdentityToMigration(err);
    // Story 7.8 — evaluation-snapshot conflicts are fail-closed, never swallowed.
    if (err instanceof EvaluationSnapshotError) {
      throw new MigrationError("REVALIDATION_FAILED", err.messageFa);
    }
    throw new MigrationError(
      "CUTOVER_FAILED",
      "اجرای دسته ناموفق بود؛ وضعیت تولید تغییر نکرد.",
    );
  }
}

/**
 * Pre-cutover staging drop with zero production trace assertion (AC #4).
 */
export async function rollbackImportStaging(
  pool: Pool,
  opts: { batchId: string },
): Promise<{ batch: StagingBatchRecord; evidence: ImportBatchEvidence }> {
  const batch = await getStagingBatch(pool, opts.batchId);

  return withTransaction(pool, async (client) => {
    await assertZeroProductionTrace(client, batch.correlationId);
    await releaseOverlapLocksForBatch(client, batch.id);
    const rolled = await rollbackStagingBatch(client, batch.id);
    const evidence = await persistBatchEvidence(client, {
      batchId: rolled.id,
      correlationId: rolled.correlationId,
      status: "rolled-back",
      actors: {
        uploadedBy: rolled.uploadedBy,
        uploadedAt: rolled.uploadedAt,
        approvedBy: rolled.approvedBy,
        approvedAt: rolled.approvedAt,
        executedBy: rolled.executedBy,
        executedAt: rolled.executedAt,
      },
      counts: {
        rowCount: 0,
        createdPersonCount: 0,
        createdEventCount: 0,
        errorCount: 0,
      },
    });
    return { batch: rolled, evidence };
  });
}

/** Read-only projection of frozen staging rows for executor UI. */
export function stagingRowsReadOnly(
  batch: StagingBatchRecord,
): StagingBatchRow[] {
  return batch.rows.map((r) => ({
    rowId: r.rowId,
    sourceRow: r.sourceRow,
    values: { ...r.values },
  }));
}
