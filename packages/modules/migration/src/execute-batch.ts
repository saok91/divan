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
  activateApproval,
  createApproval,
  HeadcountApprovalError,
  listApprovals,
} from "@divan/headcount";
import {
  PersonIdentityError,
  PersonnelEventError,
  PERSONNEL_EVENT_PRODUCT_RISK_TIERS,
  createDraft,
  createPerson,
  deleteDraft,
  finalizeDraft,
  getDraft,
  getActiveEmploymentAsOf,
  getGradeByCode,
  getJobTitleByCode,
  getLadderByCode,
  getOrgUnitByCode,
  getOrganizationalRoleByCode,
  getPersonByPersonnelCode,
  getSeniorityByCode,
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
  /** Row outcome counts (FR-38 / Story 9.2). */
  created: number;
  updated: number;
  rejected: number;
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

/** Status the TX claims from before moving to executing. */
export type CutoverClaimStatus = "approved" | "confirmed-draft";

/**
 * Map evidence + row outcome ids → operator counts.
 * Success path is all-or-nothing → rejected = 0.
 * Person path: created = persons; updated = matched − created.
 * PE/HC path: createdPersonCount is 0; created = all createdRecordIds.
 */
export function mapCutoverCounts(opts: {
  createdPersonCount: number;
  recordIdsLength: number;
  rejected?: number;
}): { created: number; updated: number; rejected: number } {
  const personCreates = opts.createdPersonCount;
  const created =
    personCreates > 0 ? personCreates : opts.recordIdsLength;
  const updated =
    personCreates > 0
      ? Math.max(0, opts.recordIdsLength - personCreates)
      : 0;
  return {
    created,
    updated,
    rejected: opts.rejected ?? 0,
  };
}

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
 * Authoritative live FK checks via published PE/HC APIs (AC #3).
 * Story 9.1: staging rows carry business codes; resolve via *ByCode.
 * Story 9.3: per-template subject existence where product requires it.
 */
export async function revalidateAuthoritativeReferences(
  batch: StagingBatchRecord,
): Promise<void> {
  for (const row of batch.rows) {
    if (batch.templateKey === "personnel_event_transfer") {
      const personnelCode = (row.values.personnelCode ?? "").trim();
      if (!personnelCode) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: کد پرسنلی الزامی است.`,
        );
      }
      const person = await getPersonByPersonnelCode(personnelCode);
      if (!person) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: کد پرسنلی «${personnelCode}» یافت نشد.`,
        );
      }
    }

    const teamCode = (row.values.teamCode ?? "").trim();
    if (teamCode) {
      const unit = await getOrgUnitByCode(teamCode);
      if (!unit || unit.unitType !== "TEAM") {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: کد تیم در وضعیت جاری معتبر نیست.`,
        );
      }
    }
    const roleCode = (row.values.organizationalRoleCode ?? "").trim();
    if (roleCode) {
      const role = await getOrganizationalRoleByCode(roleCode);
      if (!role) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: کد نقش سازمانی یافت نشد.`,
        );
      }
    }
    const jobTitleCode = (row.values.jobTitleCode ?? "").trim();
    if (jobTitleCode) {
      const job = await getJobTitleByCode(jobTitleCode);
      if (!job) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: کد عنوان شغلی یافت نشد.`,
        );
      }
    }
    const ladderCode = (row.values.ladderCode ?? "").trim();
    let resolvedLadderId: string | null = null;
    if (ladderCode) {
      const ladder = await getLadderByCode(ladderCode);
      if (!ladder) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: کد نردبان یافت نشد.`,
        );
      }
      resolvedLadderId = ladder.id;
    }
    const gradeCode = (row.values.gradeCode ?? "").trim();
    if (gradeCode) {
      if (!resolvedLadderId) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: برای اعتبارسنجی کد گرید، کد نردبان الزامی است.`,
        );
      }
      const grade = await getGradeByCode(resolvedLadderId, gradeCode);
      if (!grade) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: کد گرید یافت نشد.`,
        );
      }
    }
    const seniorityCode = (row.values.seniorityCode ?? "").trim();
    if (seniorityCode) {
      const seniority = await getSeniorityByCode(seniorityCode);
      if (!seniority) {
        throw new MigrationError(
          "REVALIDATION_FAILED",
          `ردیف ${row.sourceRow}: کد ارشدیت یافت نشد.`,
        );
      }
    }
  }
}

function assertNoDuplicateSubjectCodes(issues: ImportIssue[]): void {
  const dups = issues.filter(
    (i) =>
      i.severity === "warning" &&
      (i.column === "personnelCode" || i.column === "requirementCode") &&
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
 * Count production business events for this batch correlation.
 * Honesty: does not detect Prisma Person / HC approval orphans (AD-6 / 9.3).
 */
export async function countProductionBusinessEvents(
  client: PoolClient,
  correlationId: string,
): Promise<number> {
  const res = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM kernel_events
     WHERE correlation_id = $1::uuid
       AND event_class = 'business'`,
    [correlationId],
  );
  return Number(res.rows[0]?.c ?? 0);
}

/**
 * Assert no production business events exist for this batch correlation.
 * Used after pre-cutover rollback / failed cutover when no domain side-effects.
 */
export async function assertZeroProductionTrace(
  client: PoolClient,
  correlationId: string,
): Promise<void> {
  const count = await countProductionBusinessEvents(client, correlationId);
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

function mapPersonnelEventToMigration(err: PersonnelEventError): never {
  throw new MigrationError(
    err.code === "PERMISSION_DENIED" ? "PERMISSION_DENIED" : "CUTOVER_FAILED",
    err.messageFa,
  );
}

function mapHeadcountApprovalToMigration(err: HeadcountApprovalError): never {
  throw new MigrationError(
    err.code === "PERMISSION_DENIED" ? "PERMISSION_DENIED" : "CUTOVER_FAILED",
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
      teamCode: r.values.teamCode ?? null,
      organizationalRoleCode: r.values.organizationalRoleCode ?? null,
      jobTitleCode: r.values.jobTitleCode ?? null,
      ladderCode: r.values.ladderCode ?? null,
      gradeCode: r.values.gradeCode ?? null,
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
  if (err instanceof PersonnelEventError) return err.messageFa;
  if (err instanceof HeadcountApprovalError) return err.messageFa;
  return "اجرای دسته ناموفق بود.";
}

function resolveFailureCode(err: unknown): string {
  if (err instanceof MigrationError) return err.code;
  if (err instanceof EvaluationSnapshotError) return err.code;
  if (err instanceof PersonnelEventError) return err.code;
  if (err instanceof HeadcountApprovalError) return err.code;
  return "CUTOVER_FAILED";
}

const MSG_CUTOVER_NO_PRODUCTION_CHANGE_FA =
  "اجرای دسته ناموفق بود؛ وضعیت تولید تغییر نکرد.";
const MSG_CUTOVER_PARTIAL_PRODUCTION_FA =
  "اجرای دسته ناموفق بود؛ بخشی از وضعیت تولید ممکن است تغییر کرده باشد. دسته را بازبینی کنید.";

async function cutoverPersonRow(
  client: PoolClient,
  batch: StagingBatchRecord,
  row: StagingBatchRow,
  executorAccountId: string,
  createdPersonIds: string[],
  matchedPersonIds: string[],
  eventIds: string[],
): Promise<void> {
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
      teamCode: row.values.teamCode ?? null,
      organizationalRoleCode: row.values.organizationalRoleCode ?? null,
      jobTitleCode: row.values.jobTitleCode ?? null,
      ladderCode: row.values.ladderCode ?? null,
      gradeCode: row.values.gradeCode ?? null,
      seniorityCode: row.values.seniorityCode ?? null,
      collaborationType: row.values.collaborationType ?? null,
    },
    afterEvidence: {
      personnelCode: code,
      personId: person.id,
    },
  });
  eventIds.push(eventId);
}

async function resolveTransferPayloadIds(
  values: Record<string, string>,
  sourceRow: number,
  client: PoolClient,
): Promise<{
  teamId: string;
  organizationalRoleId: string;
  jobTitleId: string;
  ladderId: string;
  gradeId: string;
  seniorityId?: string;
  preferredApprovalId?: string;
}> {
  const team = await getOrgUnitByCode((values.teamCode ?? "").trim());
  if (!team || team.unitType !== "TEAM") {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${sourceRow}: کد تیم مقصد معتبر نیست.`,
    );
  }
  const role = await getOrganizationalRoleByCode(
    (values.organizationalRoleCode ?? "").trim(),
  );
  if (!role) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${sourceRow}: کد نقش سازمانی یافت نشد.`,
    );
  }
  const job = await getJobTitleByCode((values.jobTitleCode ?? "").trim());
  if (!job) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${sourceRow}: کد عنوان شغلی یافت نشد.`,
    );
  }
  const ladder = await getLadderByCode((values.ladderCode ?? "").trim());
  if (!ladder) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${sourceRow}: کد نردبان یافت نشد.`,
    );
  }
  const grade = await getGradeByCode(
    ladder.id,
    (values.gradeCode ?? "").trim(),
  );
  if (!grade) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${sourceRow}: کد گرید یافت نشد.`,
    );
  }

  const payload: {
    teamId: string;
    organizationalRoleId: string;
    jobTitleId: string;
    ladderId: string;
    gradeId: string;
    seniorityId?: string;
    preferredApprovalId?: string;
  } = {
    teamId: team.id,
    organizationalRoleId: role.id,
    jobTitleId: job.id,
    ladderId: ladder.id,
    gradeId: grade.id,
  };

  const seniorityCode = (values.seniorityCode ?? "").trim();
  if (seniorityCode) {
    const seniority = await getSeniorityByCode(seniorityCode);
    if (!seniority) {
      throw new MigrationError(
        "REVALIDATION_FAILED",
        `ردیف ${sourceRow}: کد ارشدیت یافت نشد.`,
      );
    }
    payload.seniorityId = seniority.id;
  }

  const preferredCode = (values.preferredApprovalCode ?? "").trim();
  if (preferredCode) {
    const approvals = await listApprovals(client);
    const match = approvals.find(
      (a) => a.requirementCode === preferredCode && a.status === "active",
    );
    if (!match) {
      throw new MigrationError(
        "REVALIDATION_FAILED",
        `ردیف ${sourceRow}: کد مجوز ظرفیت ترجیحی «${preferredCode}» یافت نشد یا فعال نیست.`,
      );
    }
    // Product form uses preferredApprovalId; transfer facts also accept headcountApprovalId.
    payload.preferredApprovalId = match.id;
    (payload as { headcountApprovalId?: string }).headcountApprovalId =
      match.id;
  }

  return payload;
}

async function cutoverTransferRow(
  pool: Pool,
  client: PoolClient,
  batch: StagingBatchRecord,
  row: StagingBatchRow,
  executorAccountId: string,
  createdRecordIds: string[],
  eventIds: string[],
): Promise<void> {
  const code = (row.values.personnelCode ?? "").trim();
  const effectiveDate = (row.values.effectiveDate ?? "").trim();
  if (!code || !effectiveDate) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${row.sourceRow}: کد پرسنلی یا تاریخ مؤثر خالی است.`,
    );
  }

  const person = await getPersonByPersonnelCode(code);
  if (!person) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${row.sourceRow}: کد پرسنلی «${code}» یافت نشد.`,
    );
  }

  let employment;
  try {
    employment = await getActiveEmploymentAsOf(person.id, effectiveDate);
  } catch (err) {
    if (err instanceof PersonIdentityError) mapPersonIdentityToMigration(err);
    throw err;
  }
  if (!employment) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${row.sourceRow}: اشتغال فعال برای «${code}» در تاریخ مؤثر یافت نشد.`,
    );
  }

  const ids = await resolveTransferPayloadIds(
    row.values,
    row.sourceRow,
    client,
  );

  try {
    const draft = await createDraft(
      {
        personId: person.id,
        employmentId: employment.id,
        eventType: "TransferRecorded",
        effectiveDate,
        payload: {
          ...ids,
          employmentId: employment.id,
        },
      },
      { accountId: executorAccountId },
    );

    try {
      const finalized = await finalizeDraft(
        {
          draftId: draft.id,
          actorId: executorAccountId,
          correlationId: batch.correlationId,
          riskTier: PERSONNEL_EVENT_PRODUCT_RISK_TIERS,
        },
        pool,
      );

      if (finalized.outcome !== "finalized" || !finalized.eventId) {
        const conflictHint =
          finalized.outcome === "rejected" &&
          Array.isArray(finalized.conflicts) &&
          finalized.conflicts.length > 0
            ? ` — ${finalized.conflicts
                .map((c) =>
                  typeof c === "object" && c && "messageFa" in c
                    ? String((c as { messageFa: string }).messageFa)
                    : String(c),
                )
                .slice(0, 3)
                .join("؛ ")}`
            : "";
        throw new MigrationError(
          "CUTOVER_FAILED",
          `ردیف ${row.sourceRow}: نهایی‌سازی رویداد انتقال به وضعیت قطعی نرسید (${finalized.outcome})${conflictHint}.`,
        );
      }

      createdRecordIds.push(draft.id);
      eventIds.push(finalized.eventId);
    } catch (finalizeErr) {
      // Best-effort: abandon open/pending draft so failed finalize does not leave orphans.
      try {
        const current = await getDraft(draft.id);
        if (
          current.status === "open" ||
          current.status === "pending_review"
        ) {
          await deleteDraft(draft.id, current.version, {
            accountId: executorAccountId,
          });
        }
      } catch {
        // draft may already be deleted / finalized race
      }
      throw finalizeErr;
    }
  } catch (err) {
    if (err instanceof PersonnelEventError) mapPersonnelEventToMigration(err);
    if (err instanceof MigrationError) throw err;
    throw err;
  }
}

async function cutoverHeadcountRow(
  pool: Pool,
  row: StagingBatchRow,
  executorAccountId: string,
  createdRecordIds: string[],
): Promise<void> {
  const requirementCode = (row.values.requirementCode ?? "").trim();
  const teamCode = (row.values.teamCode ?? "").trim();
  const jobTitleCode = (row.values.jobTitleCode ?? "").trim();
  const allowedRaw = (row.values.allowedCount ?? "").trim();
  const validityStart = (row.values.validityStart ?? "").trim();
  const validityEndExclusive = (row.values.validityEndExclusive ?? "").trim();

  if (
    !requirementCode ||
    !teamCode ||
    !jobTitleCode ||
    !allowedRaw ||
    !validityStart ||
    !validityEndExclusive
  ) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${row.sourceRow}: فیلدهای الزامی مجوز ظرفیت ناقص است.`,
    );
  }

  const team = await getOrgUnitByCode(teamCode);
  if (!team || team.unitType !== "TEAM") {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${row.sourceRow}: کد تیم معتبر نیست.`,
    );
  }
  const job = await getJobTitleByCode(jobTitleCode);
  if (!job) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${row.sourceRow}: کد عنوان شغلی یافت نشد.`,
    );
  }

  let seniorityId: string | null = null;
  const seniorityCode = (row.values.seniorityCode ?? "").trim();
  if (seniorityCode) {
    const seniority = await getSeniorityByCode(seniorityCode);
    if (!seniority) {
      throw new MigrationError(
        "REVALIDATION_FAILED",
        `ردیف ${row.sourceRow}: کد ارشدیت یافت نشد.`,
      );
    }
    seniorityId = seniority.id;
  }

  const allowedCount = Number.parseInt(allowedRaw, 10);
  if (!Number.isFinite(allowedCount) || allowedCount < 0) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `ردیف ${row.sourceRow}: سقف مجاز نامعتبر است.`,
    );
  }

  try {
    // Single TX: create+activate — PoolClient path skips nested BEGIN (headcount runInTransaction).
    const activated = await withTransaction(pool, async (tx) => {
      const created = await createApproval(tx, {
        requirementCode,
        teamId: team.id,
        jobTitleId: job.id,
        seniorityId,
        allowedCount,
        validityStart,
        validityEndExclusive,
        approvalReference:
          (row.values.approvalReference ?? "").trim() || null,
        actorId: executorAccountId,
      });
      return activateApproval(tx, {
        id: created.id,
        actorId: executorAccountId,
      });
    });
    createdRecordIds.push(activated.id);
  } catch (err) {
    if (err instanceof HeadcountApprovalError) {
      mapHeadcountApprovalToMigration(err);
    }
    throw err;
  }
}

async function cutoverRowsInTx(
  pool: Pool,
  client: PoolClient,
  batch: StagingBatchRecord,
  executorAccountId: string,
): Promise<{
  createdPersonIds: string[];
  matchedPersonIds: string[];
  createdDomainRecordIds: string[];
  eventIds: string[];
}> {
  const createdPersonIds: string[] = [];
  const matchedPersonIds: string[] = [];
  const createdDomainRecordIds: string[] = [];
  const eventIds: string[] = [];

  for (const row of batch.rows) {
    switch (batch.templateKey) {
      case "personnel_event_transfer":
        await cutoverTransferRow(
          pool,
          client,
          batch,
          row,
          executorAccountId,
          createdDomainRecordIds,
          eventIds,
        );
        break;
      case "headcount_approval_create":
        await cutoverHeadcountRow(
          pool,
          row,
          executorAccountId,
          createdDomainRecordIds,
        );
        break;
      case "person_employment_start":
        await cutoverPersonRow(
          client,
          batch,
          row,
          executorAccountId,
          createdPersonIds,
          matchedPersonIds,
          eventIds,
        );
        break;
      default:
        throw new MigrationError(
          "TEMPLATE_UNKNOWN",
          `قالب «${batch.templateKey}» برای قطعی‌سازی پشتیبانی نمی‌شود.`,
        );
    }
  }

  return {
    createdPersonIds,
    matchedPersonIds,
    createdDomainRecordIds,
    eventIds,
  };
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
 * Shared atomic cutover body (mutex → Baseline append → evidence).
 * Used by migration SoD execute and day-to-day bulk commit (Story 9.2).
 */
export async function performAtomicCutover(
  pool: Pool,
  opts: {
    batch: StagingBatchRecord;
    claimFromStatus: CutoverClaimStatus;
    executorAccountId: string;
    executorDisplayName: string;
  },
): Promise<{
  batch: StagingBatchRecord;
  evidence: ImportBatchEvidence;
  createdPersonIds: string[];
  matchedPersonIds: string[];
  createdDomainRecordIds: string[];
  eventIds: string[];
}> {
  const { batch } = opts;
  const issues = revalidateStagingBatch(batch);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new MigrationError(
      "REVALIDATION_FAILED",
      `اعتبارسنجی مجدد ناموفق: ${formatImportIssueCite(errors[0]!)}`,
    );
  }
  assertNoDuplicateSubjectCodes(issues);
  await revalidateAuthoritativeReferences(batch);

  const overlapKeys = buildOverlapKeys(batch.rows);
  let evalSnapId: string | null = null;
  let evalSnapFingerprint: string | null = null;
  const domainOutsideTx =
    batch.templateKey === "personnel_event_transfer" ||
    batch.templateKey === "headcount_approval_create";

  try {
    // Phase 1 — claim + mutex + evaluation snapshot (short TX).
    // Story 9.3: PE finalize / HC activate open their own transactions; running
    // them inside this TX deadlocks the pool. Domain cutover runs after commit.
    const prep = await withTransaction(pool, async (client) => {
      const claimed = await client.query(
        `SELECT id FROM migration_staging.import_batch
         WHERE id = $1::uuid AND status = $2
         FOR UPDATE`,
        [batch.id, opts.claimFromStatus],
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
          ownerDisplayName: opts.executorDisplayName,
          correlationId: batch.correlationId,
        },
      });

      const evalSnap = await beginEvaluationSnapshot(client, {
        kind: "import_execution",
        payload: buildImportEvaluationPayload(batch),
        attribution: { actorAccountId: opts.executorAccountId },
        correlationId: batch.correlationId,
        boundRefs: buildImportEvaluationBoundRefs(batch, overlapKeys),
      });
      evalSnapId = evalSnap.id;
      evalSnapFingerprint = evalSnap.contentFingerprint;

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

      return { evalSnap };
    });

    // Phase 2 — person cutover stays in one TX with Baseline append;
    // PE/HC cutover runs outside (product APIs own their transactions).
    let createdPersonIds: string[] = [];
    let matchedPersonIds: string[] = [];
    let createdDomainRecordIds: string[] = [];
    let eventIds: string[] = [];

    if (domainOutsideTx) {
      const client = await pool.connect();
      try {
        const cut = await cutoverRowsInTx(
          pool,
          client,
          batch,
          opts.executorAccountId,
        );
        createdPersonIds = cut.createdPersonIds;
        matchedPersonIds = cut.matchedPersonIds;
        createdDomainRecordIds = cut.createdDomainRecordIds;
        eventIds = cut.eventIds;
      } finally {
        client.release();
      }
    }

    const result = await withTransaction(pool, async (client) => {
      if (!domainOutsideTx) {
        const cut = await cutoverRowsInTx(
          pool,
          client,
          batch,
          opts.executorAccountId,
        );
        createdPersonIds = cut.createdPersonIds;
        matchedPersonIds = cut.matchedPersonIds;
        createdDomainRecordIds = cut.createdDomainRecordIds;
        eventIds = cut.eventIds;
      }

      await markStagingStatus(client, batch.id, "cutover-complete", {
        executedBy: opts.executorAccountId,
        executedAt: new Date(),
      });

      await releaseOverlapLocksForBatch(client, batch.id);

      await revalidateAuthoritativeReferences(batch);
      const preCommitCheck = await revalidateEvaluationSnapshot(
        client,
        { id: prep.evalSnap.id },
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
        snapshot: prep.evalSnap,
        operationRef: {
          entityType: "import_batch",
          entityId: batch.id,
          eventIds,
        },
        markConsumed: true,
      });

      const allRecordIds = [
        ...createdPersonIds,
        ...matchedPersonIds,
        ...createdDomainRecordIds,
      ];
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
          evaluationSnapshotId: prep.evalSnap.id,
          evaluationSnapshotFingerprint: prep.evalSnap.contentFingerprint,
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

      return {
        createdPersonIds,
        matchedPersonIds,
        createdDomainRecordIds,
        eventIds,
        evidence,
      };
    });

    const updated = await getStagingBatch(pool, batch.id);
    return {
      batch: updated,
      evidence: result.evidence,
      createdPersonIds: result.createdPersonIds,
      matchedPersonIds: result.matchedPersonIds,
      createdDomainRecordIds: result.createdDomainRecordIds,
      eventIds: result.eventIds,
    };
  } catch (err) {
    // Pre-cutover / mid-cutover abort. Story 9.3 Honesty+harden: PE/HC may have
    // committed domain side-effects outside this TX — never leave status=executing,
    // and do not claim "production unchanged" when business events exist.
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

    let productionEventCount = 0;
    try {
      const probe = await pool.connect();
      try {
        productionEventCount = await countProductionBusinessEvents(
          probe,
          batch.correlationId,
        );
      } finally {
        probe.release();
      }
    } catch {
      // probe failed — assume unknown; use domainOutsideTx as hint below
      productionEventCount = domainOutsideTx ? -1 : 0;
    }

    const productionTouched =
      productionEventCount > 0 ||
      (productionEventCount < 0 && domainOutsideTx);
    const failureMessageFa = productionTouched
      ? `${resolveFailureMessageFa(err)} — ${MSG_CUTOVER_PARTIAL_PRODUCTION_FA}`
      : resolveFailureMessageFa(err);

    try {
      await withTransaction(pool, async (client) => {
        // Only assert zero-trace when we believe production is clean.
        if (!productionTouched) {
          await assertZeroProductionTrace(client, batch.correlationId);
          await rollbackStagingBatch(client, batch.id);
        } else {
          // Drop staging rows when possible; do not require zero production.
          try {
            await rollbackStagingBatch(client, batch.id);
          } catch {
            // staging may already be inconsistent; still mark failed below
          }
        }
        await releaseOverlapLocksForBatch(client, batch.id);
        await markStagingStatus(client, batch.id, "failed", {
          executedBy: opts.executorAccountId,
          executedAt: new Date(),
          errorSummary: {
            messageFa: failureMessageFa,
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
            createdEventCount: Math.max(0, productionEventCount),
            errorCount: 1,
          },
          errors: [failureMessageFa],
        });
      });
    } catch {
      // Best-effort cleanup; rethrow original below
    }

    if (err instanceof MigrationError) throw err;
    if (err instanceof PersonIdentityError) mapPersonIdentityToMigration(err);
    if (err instanceof PersonnelEventError) mapPersonnelEventToMigration(err);
    if (err instanceof HeadcountApprovalError) {
      mapHeadcountApprovalToMigration(err);
    }
    if (err instanceof EvaluationSnapshotError) {
      throw new MigrationError("REVALIDATION_FAILED", err.messageFa);
    }
    throw new MigrationError(
      "CUTOVER_FAILED",
      productionTouched
        ? MSG_CUTOVER_PARTIAL_PRODUCTION_FA
        : MSG_CUTOVER_NO_PRODUCTION_CHANGE_FA,
    );
  }
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
      return {
        batch,
        evidence: prior,
        idempotentReplay: true,
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

  const executorDisplay =
    opts.executorDisplayName?.trim() || opts.executorAccountId;

  const result = await performAtomicCutover(pool, {
    batch,
    claimFromStatus: "approved",
    executorAccountId: opts.executorAccountId,
    executorDisplayName: executorDisplay,
  });

  return {
    batch: result.batch,
    evidence: result.evidence,
    idempotentReplay: false,
    created:
      result.createdPersonIds.length + result.createdDomainRecordIds.length,
    updated: result.matchedPersonIds.length,
    rejected: 0,
  };
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
