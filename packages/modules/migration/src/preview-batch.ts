/**
 * Preview batch DTO + ephemeral draft store (Story 6.1).
 *
 * AD-4 boundary: staging/cutover execution = Story 6.2.
 * This module never appends to the production event-store or writes Baseline.
 *
 * Ops constraint (6.1): drafts live in-process memory for previewBatchId
 * stability within a **single Node process** lifetime. Multi-instance /
 * serverless deploys need sticky routing or a shared store (deferred to 6.2+).
 * Cancel removes the draft; TTL / caps bound memory.
 */

import { randomUUID } from "node:crypto";

import type { ParsedImportMatrix } from "./parse-workbook";
import { MigrationError } from "./errors";
import {
  formatImportIssueCite,
  validateImportMatrix,
  type ImportIssue,
} from "./validate-import";
import type { LaunchImportTemplate } from "./templates";

export type PreviewRowSeverity = "ok" | "error" | "warning";

export type ImportPreviewRow = {
  /** Stable row id within the batch (not a Person UUID). */
  rowId: string;
  sourceRow: number;
  severity: PreviewRowSeverity;
  /** Permission-filtered field map (forbidden keys omitted, not null). */
  values: Record<string, string>;
};

export type ImportPreviewBatch = {
  previewBatchId: string;
  templateKey: string;
  templateTitleFa: string;
  /** Provisional catalogue honesty. */
  arMigrationStatus: "provisional-pending-freeze";
  createdAt: string;
  status: "preview" | "confirmed-draft" | "cancelled";
  rowCount: number;
  errorCount: number;
  warningCount: number;
  issues: ImportIssue[];
  issueCitesFa: string[];
  rows: ImportPreviewRow[];
  /**
   * Columns remaining after permission filter (keys + captions).
   * Omitted columns never appear in rows.values either.
   */
  visibleColumns: Array<{ key: string; headerFa: string }>;
  /** Honesty: 6.1 does not execute production cutover. */
  executionAllowed: false;
  /** Explicit AD-4: no production event-store append in this path. */
  eventStoreAppended: false;
};

export type BuildPreviewOptions = {
  /**
   * Set of dataCategory strings the viewer may see.
   * Columns whose dataCategory is not in this set are omitted from payload.
   */
  permittedDataCategories: ReadonlySet<string>;
  /**
   * Optional omit of specific column keys (field-level).
   * Keys listed here are stripped even if category is permitted.
   */
  omittedColumnKeys?: ReadonlySet<string>;
  /** Creating actor — required for ownership checks on get/cancel/confirm. */
  createdByAccountId: string;
};

export type PreviewAccessOptions = {
  permittedDataCategories?: ReadonlySet<string>;
  omittedColumnKeys?: ReadonlySet<string>;
  /** Caller account — must match draft owner. */
  actorAccountId: string;
};

type StoredDraft = {
  batch: ImportPreviewBatch;
  /** Full unfiltered rows for re-filter on get — still no event-store. */
  fullRows: ImportPreviewRow[];
  /** Unfiltered issues for re-project on get. */
  fullIssues: ImportIssue[];
  template: LaunchImportTemplate;
  createdByAccountId: string;
  createdAtMs: number;
};

const draftStore = new Map<string, StoredDraft>();

/** Bound in-process memory (single-process ops assumption). */
export const IMPORT_MAX_DRAFTS_GLOBAL = 50;
export const IMPORT_MAX_DRAFTS_PER_ACTOR = 5;
export const IMPORT_DRAFT_TTL_MS = 60 * 60 * 1000;

function severityForRow(
  sourceRow: number,
  issues: ImportIssue[],
): PreviewRowSeverity {
  const rowIssues = issues.filter((i) => i.row === sourceRow);
  if (rowIssues.some((i) => i.severity === "error")) return "error";
  if (rowIssues.some((i) => i.severity === "warning")) return "warning";
  return "ok";
}

function filterColumns(
  template: LaunchImportTemplate,
  opts: Pick<BuildPreviewOptions, "permittedDataCategories" | "omittedColumnKeys">,
): Array<{ key: string; headerFa: string; dataCategory: string }> {
  const omit = opts.omittedColumnKeys ?? new Set<string>();
  return template.columns
    .filter(
      (c) =>
        opts.permittedDataCategories.has(c.dataCategory) && !omit.has(c.key),
    )
    .map((c) => ({
      key: c.key,
      headerFa: c.headerFa,
      dataCategory: c.dataCategory,
    }));
}

/**
 * Drop issues that cite omitted columns; keep structure-level cites.
 */
export function filterIssuesForVisibleColumns(
  issues: ImportIssue[],
  visibleKeys: ReadonlySet<string>,
): ImportIssue[] {
  return issues.filter((i) => {
    if (i.column === "_structure" || i.column === "") return true;
    return visibleKeys.has(i.column);
  });
}

function projectRowValues(
  record: Record<string, string>,
  visibleKeys: string[],
): Record<string, string> {
  const out = Object.create(null) as Record<string, string>;
  for (const key of visibleKeys) {
    if (Object.prototype.hasOwnProperty.call(record, key) || key in record) {
      out[key] = record[key] ?? "";
    }
  }
  return out;
}

function purgeExpiredDrafts(now = Date.now()): void {
  for (const [id, stored] of draftStore) {
    if (now - stored.createdAtMs > IMPORT_DRAFT_TTL_MS) {
      draftStore.delete(id);
    }
  }
}

function assertDraftCapacity(actorAccountId: string): void {
  purgeExpiredDrafts();
  if (draftStore.size >= IMPORT_MAX_DRAFTS_GLOBAL) {
    throw new MigrationError(
      "VALIDATION_FAILED",
      "ظرفیت پیش‌نویس‌های موقت پر است. پیش‌نمایش‌های قبلی را لغو کنید یا بعداً دوباره تلاش کنید.",
    );
  }
  let actorCount = 0;
  for (const stored of draftStore.values()) {
    if (stored.createdByAccountId === actorAccountId) actorCount++;
  }
  if (actorCount >= IMPORT_MAX_DRAFTS_PER_ACTOR) {
    throw new MigrationError(
      "VALIDATION_FAILED",
      "تعداد پیش‌نویس‌های باز شما به حد مجاز رسیده است. یکی را لغو کنید و دوباره بارگذاری کنید.",
    );
  }
}

function assertOwner(stored: StoredDraft, actorAccountId: string): void {
  if (stored.createdByAccountId !== actorAccountId) {
    throw new MigrationError(
      "PERMISSION_DENIED",
      "دسترسی به این پیش‌نمایش دسته را ندارید.",
    );
  }
}

function projectBatch(
  stored: StoredDraft,
  opts: Pick<BuildPreviewOptions, "permittedDataCategories" | "omittedColumnKeys">,
): ImportPreviewBatch {
  const visible = filterColumns(stored.template, opts);
  const visibleKeys = visible.map((c) => c.key);
  const visibleKeySet = new Set(visibleKeys);
  const issues = filterIssuesForVisibleColumns(stored.fullIssues, visibleKeySet);
  return {
    ...stored.batch,
    issues,
    issueCitesFa: issues.map(formatImportIssueCite),
    errorCount: issues.filter((i) => i.severity === "error").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
    rows: stored.fullRows.map((r) => ({
      rowId: r.rowId,
      sourceRow: r.sourceRow,
      severity: severityForRow(r.sourceRow, issues),
      values: projectRowValues(r.values, visibleKeys),
    })),
    visibleColumns: visible.map((c) => ({
      key: c.key,
      headerFa: c.headerFa,
    })),
    executionAllowed: false,
    eventStoreAppended: false,
  };
}

/**
 * Build a preview batch from a parsed+validated matrix.
 * Does not touch event-store / Baseline.
 */
export function buildImportPreviewBatch(
  parsed: ParsedImportMatrix,
  opts: BuildPreviewOptions,
): ImportPreviewBatch {
  assertDraftCapacity(opts.createdByAccountId);

  const fullIssues = validateImportMatrix(parsed);
  const visible = filterColumns(parsed.template, opts);
  const visibleKeys = visible.map((c) => c.key);
  const visibleKeySet = new Set(visibleKeys);
  const issues = filterIssuesForVisibleColumns(fullIssues, visibleKeySet);

  const fullRows: ImportPreviewRow[] = parsed.rows.map((record, i) => {
    const sourceRow = parsed.sourceRowNumbers[i] ?? i + 2;
    return {
      rowId: randomUUID(),
      sourceRow,
      severity: severityForRow(sourceRow, fullIssues),
      values: { ...record },
    };
  });

  const projectedRows: ImportPreviewRow[] = fullRows.map((r) => ({
    rowId: r.rowId,
    sourceRow: r.sourceRow,
    severity: severityForRow(r.sourceRow, issues),
    values: projectRowValues(r.values, visibleKeys),
  }));

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const batch: ImportPreviewBatch = {
    previewBatchId: randomUUID(),
    templateKey: parsed.template.key,
    templateTitleFa: parsed.template.titleFa,
    arMigrationStatus: "provisional-pending-freeze",
    createdAt: new Date().toISOString(),
    status: "preview",
    rowCount: projectedRows.length,
    errorCount,
    warningCount,
    issues,
    issueCitesFa: issues.map(formatImportIssueCite),
    rows: projectedRows,
    visibleColumns: visible.map((c) => ({
      key: c.key,
      headerFa: c.headerFa,
    })),
    executionAllowed: false,
    eventStoreAppended: false,
  };

  draftStore.set(batch.previewBatchId, {
    batch,
    fullRows,
    fullIssues,
    template: parsed.template,
    createdByAccountId: opts.createdByAccountId,
    createdAtMs: Date.now(),
  });

  return batch;
}

export function getImportPreviewBatch(
  previewBatchId: string,
  opts: PreviewAccessOptions,
): ImportPreviewBatch {
  purgeExpiredDrafts();
  const stored = draftStore.get(previewBatchId);
  if (!stored || stored.batch.status === "cancelled") {
    throw new MigrationError(
      "PREVIEW_NOT_FOUND",
      "پیش‌نمایش دسته یافت نشد یا لغو شده است.",
    );
  }
  assertOwner(stored, opts.actorAccountId);
  if (
    opts.permittedDataCategories == null &&
    opts.omittedColumnKeys == null
  ) {
    return stored.batch;
  }
  return projectBatch(stored, {
    permittedDataCategories:
      opts.permittedDataCategories ??
      new Set(stored.template.columns.map((c) => c.dataCategory)),
    omittedColumnKeys: opts.omittedColumnKeys,
  });
}

/** Cancel clears draft — leave-guard dirty should clear. */
export function cancelImportPreviewBatch(
  previewBatchId: string,
  actorAccountId: string,
): void {
  purgeExpiredDrafts();
  const stored = draftStore.get(previewBatchId);
  if (!stored) {
    throw new MigrationError(
      "PREVIEW_NOT_FOUND",
      "پیش‌نمایش دسته یافت نشد یا لغو شده است.",
    );
  }
  assertOwner(stored, actorAccountId);
  draftStore.delete(previewBatchId);
}

/**
 * Confirm = freeze draft acknowledgement only.
 * Does NOT execute production cutover / event-store append (Story 6.2).
 * Idempotent when already confirmed-draft.
 */
export function confirmImportPreviewDraft(
  previewBatchId: string,
  actorAccountId: string,
): ImportPreviewBatch {
  purgeExpiredDrafts();
  const stored = draftStore.get(previewBatchId);
  if (!stored || stored.batch.status === "cancelled") {
    throw new MigrationError(
      "PREVIEW_NOT_FOUND",
      "پیش‌نمایش دسته یافت نشد یا لغو شده است.",
    );
  }
  assertOwner(stored, actorAccountId);
  if (stored.batch.status === "confirmed-draft") {
    return stored.batch;
  }
  if (stored.batch.status !== "preview") {
    throw new MigrationError(
      "VALIDATION_FAILED",
      "وضعیت پیش‌نمایش برای تأیید معتبر نیست.",
    );
  }
  if (stored.batch.errorCount > 0) {
    throw new MigrationError(
      "VALIDATION_FAILED",
      "تا رفع خطاهای ردیفی نمی‌توان پیش‌نویس را تأیید کرد.",
    );
  }
  stored.batch = {
    ...stored.batch,
    status: "confirmed-draft",
    executionAllowed: false,
    eventStoreAppended: false,
  };
  return stored.batch;
}

/** Test/selfcheck helper — wipe in-memory drafts. */
export function clearImportPreviewDraftStore(): void {
  draftStore.clear();
}

/** Selfcheck: ensure no draft claims event-store append. */
export function assertNoEventStoreAppendInDrafts(): void {
  for (const { batch } of draftStore.values()) {
    if (batch.eventStoreAppended !== false) {
      throw new Error(`draft ${batch.previewBatchId} claims event-store append`);
    }
    if (batch.executionAllowed !== false) {
      throw new Error(`draft ${batch.previewBatchId} claims execution allowed`);
    }
  }
}
