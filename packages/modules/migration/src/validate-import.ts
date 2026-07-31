/**
 * FR-37 import validators → row/column Persian issues (Story 6.1 / 9.1).
 *
 * Covers: structure, required, identifiers, uniqueness, dates, enums,
 * hierarchy, references, Ladder–Grade, overlaps, order, duplicate rows.
 * Reference/hierarchy checks are structural (business-code shape / pairing) —
 * live DB FK resolution is cutover (6.2), not preview fabrication.
 *
 * Story 9.1: entity refs are business codes — UUID-shaped values fail closed.
 */

import { toLatinDigits } from "@divan/person-employment";
import { parseDateOnly } from "@divan/temporal-engine";

import type { ParsedImportMatrix } from "./parse-workbook";
import type { ImportTemplateColumn, LaunchImportTemplate } from "./templates";

export type ImportIssueSeverity = "error" | "warning";

export type ImportIssue = {
  /** 1-based source spreadsheet row (header = 1). */
  row: number;
  /** Column key or header label for cite. */
  column: string;
  /** Persian column caption for operator cite. */
  columnCaptionFa: string;
  severity: ImportIssueSeverity;
  messageFa: string;
  /**
   * Subject business code when present on the row (e.g. personnelCode).
   * Never an internal UUID — FR-57 / UX-DR35.
   */
  subjectBusinessCode?: string;
};

/** Same shape as personnel codes — business identifiers, never UUIDs. */
const BUSINESS_CODE_RE = /^[A-Za-z0-9._\-/]{1,32}$/;

const UUID_HYPHEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_HEX32_RE = /^[0-9a-f]{32}$/i;

function looksLikeInternalId(raw: string): boolean {
  return UUID_HYPHEN_RE.test(raw) || UUID_HEX32_RE.test(raw);
}

function normalizeBusinessCode(raw: string): string {
  return toLatinDigits(raw).trim();
}

const COLLABORATION_ENUM = new Set([
  "employee",
  "contractor",
  "intern",
  "consultant",
]);

const GENDER_ENUM = new Set(["male", "female", "other", "unspecified", ""]);

const ENTITY_CODE_FIELDS = [
  "teamCode",
  "organizationalRoleCode",
  "jobTitleCode",
  "ladderCode",
  "gradeCode",
  "seniorityCode",
] as const;

function captionFor(
  template: LaunchImportTemplate,
  key: string,
): string {
  return template.columns.find((c) => c.key === key)?.headerFa ?? key;
}

function pushIssue(
  issues: ImportIssue[],
  args: {
    row: number;
    column: string;
    columnCaptionFa: string;
    severity: ImportIssueSeverity;
    messageFa: string;
    subjectBusinessCode?: string;
  },
): void {
  issues.push({
    row: args.row,
    column: args.column,
    columnCaptionFa: args.columnCaptionFa,
    severity: args.severity,
    messageFa: args.messageFa,
    ...(args.subjectBusinessCode
      ? { subjectBusinessCode: args.subjectBusinessCode }
      : {}),
  });
}

function isBlank(v: string | undefined): boolean {
  return v == null || v.trim() === "";
}

function validateRequired(
  issues: ImportIssue[],
  template: LaunchImportTemplate,
  rowNum: number,
  record: Record<string, string>,
): void {
  for (const col of template.columns) {
    if (!col.required) continue;
    if (isBlank(record[col.key])) {
      pushIssue(issues, {
        row: rowNum,
        column: col.key,
        columnCaptionFa: col.headerFa,
        severity: "error",
        messageFa: `مقدار الزامی «${col.headerFa}» خالی است.`,
      });
    }
  }
}

function validateIdentifiers(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
): void {
  const code = normalizeBusinessCode(record.personnelCode ?? "");
  if (code && (looksLikeInternalId(code) || !BUSINESS_CODE_RE.test(code))) {
    pushIssue(issues, {
      row: rowNum,
      column: "personnelCode",
      columnCaptionFa: captionFor(template, "personnelCode"),
      severity: "error",
      messageFa: looksLikeInternalId(code)
        ? "کد پرسنلی نباید شناسه داخلی (UUID) باشد."
        : "کد پرسنلی فقط حروف/رقم و جداکننده‌های مجاز تا ۳۲ نویسه است.",
    });
  }

  for (const key of ENTITY_CODE_FIELDS) {
    const raw = normalizeBusinessCode(record[key] ?? "");
    if (!raw) continue;
    if (looksLikeInternalId(raw) || !BUSINESS_CODE_RE.test(raw)) {
      pushIssue(issues, {
        row: rowNum,
        column: key,
        columnCaptionFa: captionFor(template, key),
        severity: "error",
        messageFa: `«${captionFor(template, key)}» باید کد کسب‌وکار معتبر باشد (نه شناسه داخلی).`,
      });
    }
  }
}

function validateDates(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
): void {
  for (const key of ["birthDate", "startDate"] as const) {
    const raw = record[key]?.trim() ?? "";
    if (!raw) continue;
    const parsed = parseDateOnly(raw);
    if (!parsed.ok) {
      pushIssue(issues, {
        row: rowNum,
        column: key,
        columnCaptionFa: captionFor(template, key),
        severity: "error",
        messageFa: `«${captionFor(template, key)}» باید تاریخ میلادی YYYY-MM-DD معتبر باشد.`,
      });
    }
  }
}

function validateEnums(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
): void {
  const collab = (record.collaborationType ?? "").trim().toLowerCase();
  if (collab && !COLLABORATION_ENUM.has(collab)) {
    pushIssue(issues, {
      row: rowNum,
      column: "collaborationType",
      columnCaptionFa: captionFor(template, "collaborationType"),
      severity: "error",
      messageFa:
        "نوع همکاری باید یکی از employee، contractor، intern، consultant باشد.",
    });
  }
  const gender = (record.gender ?? "").trim().toLowerCase();
  if (gender && !GENDER_ENUM.has(gender)) {
    pushIssue(issues, {
      row: rowNum,
      column: "gender",
      columnCaptionFa: captionFor(template, "gender"),
      severity: "warning",
      messageFa:
        "مقدار جنسیت استاندارد نیست؛ در اجرا ممکن است رد شود (male/female/other/unspecified).",
    });
  }
}

/**
 * Ladder–Grade pairing: both required together; warn if one blank when other set
 * (required validator already catches blanks for required cols).
 */
function validateLadderGrade(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
): void {
  const ladder = record.ladderCode?.trim() ?? "";
  const grade = record.gradeCode?.trim() ?? "";
  if ((ladder && !grade) || (!ladder && grade)) {
    pushIssue(issues, {
      row: rowNum,
      column: grade ? "ladderCode" : "gradeCode",
      columnCaptionFa: captionFor(
        template,
        grade ? "ladderCode" : "gradeCode",
      ),
      severity: "error",
      messageFa: "نردبان و گرید باید با هم مشخص شوند (زوج Ladder–Grade).",
    });
  }
}

/** Soft hierarchy: team present when role/job present. */
function validateHierarchy(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
): void {
  const team = record.teamCode?.trim() ?? "";
  const role = record.organizationalRoleCode?.trim() ?? "";
  const job = record.jobTitleCode?.trim() ?? "";
  if ((role || job) && !team) {
    pushIssue(issues, {
      row: rowNum,
      column: "teamCode",
      columnCaptionFa: captionFor(template, "teamCode"),
      severity: "error",
      messageFa: "برای نقش/عنوان شغلی، کد تیم الزامی است (سلسله‌مراتب).",
    });
  }
}

/** Reference shape covered by business-code checks; flag copy-paste across cols. */
function validateReferences(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
): void {
  // Preview cannot invent live org/job existence — structural only.
  // Duplicate identical code across distinct semantic columns → warning.
  const codes = [
    record.teamCode,
    record.organizationalRoleCode,
    record.jobTitleCode,
    record.ladderCode,
    record.gradeCode,
  ]
    .map((v) => v?.trim() ?? "")
    .filter(Boolean);
  const unique = new Set(codes);
  if (codes.length >= 2 && unique.size === 1) {
    pushIssue(issues, {
      row: rowNum,
      column: "teamCode",
      columnCaptionFa: captionFor(template, "teamCode"),
      severity: "warning",
      messageFa:
        "همه کدهای مرجع یکسان‌اند؛ احتمال خطای کپی در ستون‌های مرجع.",
    });
  }
}

function validateOrderAndOverlaps(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
  priorStartByCode: Map<string, string>,
): void {
  const code = record.personnelCode?.trim() ?? "";
  const start = record.startDate?.trim() ?? "";
  if (!code || !start) return;
  const prev = priorStartByCode.get(code);
  if (prev && start < prev) {
    pushIssue(issues, {
      row: rowNum,
      column: "startDate",
      columnCaptionFa: captionFor(template, "startDate"),
      severity: "warning",
      messageFa:
        "تاریخ شروع این ردیف قبل از ردیف قبلی همان کد پرسنلی است (ترتیب/هم‌پوشانی مشکوک).",
    });
  }
  if (!prev || start >= prev) {
    priorStartByCode.set(code, start);
  }
}

function rowFingerprint(record: Record<string, string>, keys: string[]): string {
  return keys.map((k) => `${k}=${(record[k] ?? "").trim()}`).join("|");
}

/**
 * Validate a parsed matrix. Structure mismatches are already thrown at parse.
 */
export function validateImportMatrix(parsed: ParsedImportMatrix): ImportIssue[] {
  const { template, rows, sourceRowNumbers } = parsed;
  const issues: ImportIssue[] = [];
  const codeRows = new Map<string, number[]>();
  const fingerprints = new Map<string, number>();
  const priorStartByCode = new Map<string, string>();
  const keys = template.columns.map((c) => c.key);

  if (rows.length === 0) {
    pushIssue(issues, {
      row: 1,
      column: "_structure",
      columnCaptionFa: "ساختار",
      severity: "error",
      messageFa: "پس از سطر عنوان، هیچ ردیف داده‌ای نیست.",
    });
    return issues;
  }

  for (let i = 0; i < rows.length; i++) {
    const record = rows[i]!;
    const rowNum = sourceRowNumbers[i] ?? i + 2;

    validateRequired(issues, template, rowNum, record);
    validateIdentifiers(issues, rowNum, record, template);
    validateDates(issues, rowNum, record, template);
    validateEnums(issues, rowNum, record, template);
    validateLadderGrade(issues, rowNum, record, template);
    validateHierarchy(issues, rowNum, record, template);
    validateReferences(issues, rowNum, record, template);
    validateOrderAndOverlaps(
      issues,
      rowNum,
      record,
      template,
      priorStartByCode,
    );

    const code = record.personnelCode?.trim() ?? "";
    if (code) {
      const list = codeRows.get(code) ?? [];
      list.push(rowNum);
      codeRows.set(code, list);
    }

    const fp = rowFingerprint(record, keys);
    const prevFpRow = fingerprints.get(fp);
    if (prevFpRow != null) {
      pushIssue(issues, {
        row: rowNum,
        column: "personnelCode",
        columnCaptionFa: captionFor(template, "personnelCode"),
        severity: "error",
        messageFa: `ردیف تکراری با ردیف ${prevFpRow} (تمام ستون‌ها یکسان).`,
      });
    } else {
      fingerprints.set(fp, rowNum);
    }
  }

  // Uniqueness of personnel code across rows (soft: same code different facts = warning)
  for (const [code, rowList] of codeRows) {
    if (rowList.length <= 1) continue;
    // If not already flagged as full duplicate, warn uniqueness
    for (let i = 1; i < rowList.length; i++) {
      const rowNum = rowList[i]!;
      const alreadyDup = issues.some(
        (iss) =>
          iss.row === rowNum &&
          iss.messageFa.includes("ردیف تکراری"),
      );
      if (alreadyDup) continue;
      pushIssue(issues, {
        row: rowNum,
        column: "personnelCode",
        columnCaptionFa: captionFor(template, "personnelCode"),
        severity: "warning",
        messageFa: `کد پرسنلی «${code}» در چند ردیف تکرار شده (${rowList.join("، ")}).`,
        subjectBusinessCode: looksLikeInternalId(code) ? undefined : code,
      });
    }
  }

  // Attach subject business code (personnelCode) when present — never UUID.
  const codeByRow = new Map<number, string>();
  for (let i = 0; i < rows.length; i++) {
    const rowNum = sourceRowNumbers[i] ?? i + 2;
    const raw = (rows[i]!.personnelCode ?? "").trim();
    if (raw && !looksLikeInternalId(raw)) {
      codeByRow.set(rowNum, raw);
    }
  }
  for (const issue of issues) {
    if (issue.subjectBusinessCode) continue;
    const code = codeByRow.get(issue.row);
    if (code) issue.subjectBusinessCode = code;
  }

  return issues;
}

/**
 * Operator cite: «ردیف ۱۲، ستون کد پرسنلی، موضوع P-100: …»
 * Never cites internal UUIDs (FR-57 / UX-DR35).
 */
export function formatImportIssueCite(issue: ImportIssue): string {
  const subject = issue.subjectBusinessCode?.trim();
  const subjectPart =
    subject && !looksLikeInternalId(subject) ? `، موضوع ${subject}` : "";
  return `ردیف ${issue.row}، ستون ${issue.columnCaptionFa}${subjectPart}: ${issue.messageFa}`;
}

export function columnMetaForKey(
  template: LaunchImportTemplate,
  key: string,
): ImportTemplateColumn | undefined {
  return template.columns.find((c) => c.key === key);
}
