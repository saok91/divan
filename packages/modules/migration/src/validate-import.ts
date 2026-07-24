/**
 * FR-37 import validators → row/column Persian issues (Story 6.1).
 *
 * Covers: structure, required, identifiers, uniqueness, dates, enums,
 * hierarchy, references, Ladder–Grade, overlaps, order, duplicate rows.
 * Reference/hierarchy checks are structural (UUID shape / pairing) — live DB
 * FK resolution is cutover (6.2), not preview fabrication.
 */

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
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COLLABORATION_ENUM = new Set([
  "employee",
  "contractor",
  "intern",
  "consultant",
]);

const GENDER_ENUM = new Set(["male", "female", "other", "unspecified", ""]);

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
  },
): void {
  issues.push({
    row: args.row,
    column: args.column,
    columnCaptionFa: args.columnCaptionFa,
    severity: args.severity,
    messageFa: args.messageFa,
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
  const code = record.personnelCode?.trim() ?? "";
  if (code && !/^[A-Za-z0-9._\-/]{1,32}$/.test(code)) {
    pushIssue(issues, {
      row: rowNum,
      column: "personnelCode",
      columnCaptionFa: captionFor(template, "personnelCode"),
      severity: "error",
      messageFa: "کد پرسنلی فقط حروف/رقم و جداکننده‌های مجاز تا ۳۲ نویسه است.",
    });
  }

  const uuidFields = [
    "teamId",
    "organizationalRoleId",
    "jobTitleId",
    "ladderId",
    "gradeId",
    "seniorityId",
  ] as const;
  for (const key of uuidFields) {
    const raw = record[key]?.trim() ?? "";
    if (!raw) continue;
    if (!UUID_RE.test(raw)) {
      pushIssue(issues, {
        row: rowNum,
        column: key,
        columnCaptionFa: captionFor(template, key),
        severity: "error",
        messageFa: `«${captionFor(template, key)}» باید شناسه UUID معتبر باشد.`,
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
  const ladder = record.ladderId?.trim() ?? "";
  const grade = record.gradeId?.trim() ?? "";
  if ((ladder && !grade) || (!ladder && grade)) {
    pushIssue(issues, {
      row: rowNum,
      column: grade ? "ladderId" : "gradeId",
      columnCaptionFa: captionFor(
        template,
        grade ? "ladderId" : "gradeId",
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
  const team = record.teamId?.trim() ?? "";
  const role = record.organizationalRoleId?.trim() ?? "";
  const job = record.jobTitleId?.trim() ?? "";
  if ((role || job) && !team) {
    pushIssue(issues, {
      row: rowNum,
      column: "teamId",
      columnCaptionFa: captionFor(template, "teamId"),
      severity: "error",
      messageFa: "برای نقش/عنوان شغلی، شناسه تیم الزامی است (سلسله‌مراتب).",
    });
  }
}

/** Reference shape already covered by UUID; flag empty optional seniority as ok. */
function validateReferences(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
): void {
  // Preview cannot invent live org/job existence — structural only.
  // Duplicate identical UUID across distinct semantic columns → warning.
  const ids = [
    record.teamId,
    record.organizationalRoleId,
    record.jobTitleId,
    record.ladderId,
    record.gradeId,
  ]
    .map((v) => v?.trim() ?? "")
    .filter(Boolean);
  const unique = new Set(ids);
  if (ids.length >= 2 && unique.size === 1) {
    pushIssue(issues, {
      row: rowNum,
      column: "teamId",
      columnCaptionFa: captionFor(template, "teamId"),
      severity: "warning",
      messageFa:
        "همه شناسه‌های مرجع یکسان‌اند؛ احتمال خطای کپی در ستون‌های مرجع.",
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
      });
    }
  }

  return issues;
}

/** Operator cite: «ردیف ۱۲، ستون کد پرسنلی: …» */
export function formatImportIssueCite(issue: ImportIssue): string {
  return `ردیف ${issue.row}، ستون ${issue.columnCaptionFa}: ${issue.messageFa}`;
}

export function columnMetaForKey(
  template: LaunchImportTemplate,
  key: string,
): ImportTemplateColumn | undefined {
  return template.columns.find((c) => c.key === key);
}
