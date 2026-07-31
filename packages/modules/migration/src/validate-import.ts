/**
 * FR-37 import validators → row/column Persian issues (Story 6.1 / 9.1 / 9.3).
 *
 * Covers: structure, required, identifiers, uniqueness, dates, enums,
 * hierarchy, references, Ladder–Grade, overlaps, order, duplicate rows.
 * Reference/hierarchy checks are structural (business-code shape / pairing) —
 * live DB FK resolution is cutover (6.2), not preview fabrication.
 *
 * Story 9.1: entity refs are business codes — UUID-shaped values fail closed.
 * Story 9.3: per-template dispatch (person / event transfer / headcount).
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

const PERSON_ENTITY_CODE_FIELDS = [
  "teamCode",
  "organizationalRoleCode",
  "jobTitleCode",
  "ladderCode",
  "gradeCode",
  "seniorityCode",
] as const;

const TRANSFER_ENTITY_CODE_FIELDS = [
  "teamCode",
  "organizationalRoleCode",
  "jobTitleCode",
  "ladderCode",
  "gradeCode",
  "seniorityCode",
  "preferredApprovalCode",
] as const;

const HEADCOUNT_ENTITY_CODE_FIELDS = [
  "teamCode",
  "jobTitleCode",
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

function validateBusinessCodeField(
  issues: ImportIssue[],
  rowNum: number,
  template: LaunchImportTemplate,
  key: string,
  raw: string,
  opts?: { rejectUuidAsPersonnel?: boolean },
): void {
  if (!raw) return;
  if (looksLikeInternalId(raw) || !BUSINESS_CODE_RE.test(raw)) {
    const isPersonnel = key === "personnelCode" || key === "requirementCode";
    pushIssue(issues, {
      row: rowNum,
      column: key,
      columnCaptionFa: captionFor(template, key),
      severity: "error",
      messageFa: looksLikeInternalId(raw)
        ? isPersonnel && opts?.rejectUuidAsPersonnel !== false
          ? key === "requirementCode"
            ? "کد نیازمندی نباید شناسه داخلی (UUID) باشد."
            : "کد پرسنلی نباید شناسه داخلی (UUID) باشد."
          : `«${captionFor(template, key)}» باید کد کسب‌وکار معتبر باشد (نه شناسه داخلی).`
        : isPersonnel && key === "personnelCode"
          ? "کد پرسنلی فقط حروف/رقم و جداکننده‌های مجاز تا ۳۲ نویسه است."
          : isPersonnel && key === "requirementCode"
            ? "کد نیازمندی فقط حروف/رقم و جداکننده‌های مجاز تا ۳۲ نویسه است."
            : `«${captionFor(template, key)}» باید کد کسب‌وکار معتبر باشد (نه شناسه داخلی).`,
    });
  }
}

function validateDatesOnKeys(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
  keys: readonly string[],
): void {
  for (const key of keys) {
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

function validateReferences(
  issues: ImportIssue[],
  rowNum: number,
  record: Record<string, string>,
  template: LaunchImportTemplate,
): void {
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

function validatePersonRow(
  issues: ImportIssue[],
  template: LaunchImportTemplate,
  rowNum: number,
  record: Record<string, string>,
  priorStartByCode: Map<string, string>,
): void {
  validateRequired(issues, template, rowNum, record);

  const code = normalizeBusinessCode(record.personnelCode ?? "");
  validateBusinessCodeField(issues, rowNum, template, "personnelCode", code);

  for (const key of PERSON_ENTITY_CODE_FIELDS) {
    validateBusinessCodeField(
      issues,
      rowNum,
      template,
      key,
      normalizeBusinessCode(record[key] ?? ""),
    );
  }

  validateDatesOnKeys(issues, rowNum, record, template, [
    "birthDate",
    "startDate",
  ]);

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
}

function validateTransferRow(
  issues: ImportIssue[],
  template: LaunchImportTemplate,
  rowNum: number,
  record: Record<string, string>,
): void {
  validateRequired(issues, template, rowNum, record);

  validateBusinessCodeField(
    issues,
    rowNum,
    template,
    "personnelCode",
    normalizeBusinessCode(record.personnelCode ?? ""),
  );

  for (const key of TRANSFER_ENTITY_CODE_FIELDS) {
    validateBusinessCodeField(
      issues,
      rowNum,
      template,
      key,
      normalizeBusinessCode(record[key] ?? ""),
    );
  }

  validateDatesOnKeys(issues, rowNum, record, template, ["effectiveDate"]);
  validateLadderGrade(issues, rowNum, record, template);
  validateHierarchy(issues, rowNum, record, template);
  validateReferences(issues, rowNum, record, template);
}

function validateHeadcountRow(
  issues: ImportIssue[],
  template: LaunchImportTemplate,
  rowNum: number,
  record: Record<string, string>,
): void {
  validateRequired(issues, template, rowNum, record);

  validateBusinessCodeField(
    issues,
    rowNum,
    template,
    "requirementCode",
    normalizeBusinessCode(record.requirementCode ?? ""),
  );

  for (const key of HEADCOUNT_ENTITY_CODE_FIELDS) {
    validateBusinessCodeField(
      issues,
      rowNum,
      template,
      key,
      normalizeBusinessCode(record[key] ?? ""),
    );
  }

  validateDatesOnKeys(issues, rowNum, record, template, [
    "validityStart",
    "validityEndExclusive",
  ]);

  const start = record.validityStart?.trim() ?? "";
  const end = record.validityEndExclusive?.trim() ?? "";
  if (start && end && start >= end) {
    const startOk = parseDateOnly(start);
    const endOk = parseDateOnly(end);
    if (startOk.ok && endOk.ok) {
      pushIssue(issues, {
        row: rowNum,
        column: "validityEndExclusive",
        columnCaptionFa: captionFor(template, "validityEndExclusive"),
        severity: "error",
        messageFa: "پایان اعتبار باید بعد از شروع اعتبار باشد.",
      });
    }
  }

  const allowedRaw = toLatinDigits(record.allowedCount ?? "").trim();
  if (allowedRaw) {
    if (!/^\d+$/.test(allowedRaw)) {
      pushIssue(issues, {
        row: rowNum,
        column: "allowedCount",
        columnCaptionFa: captionFor(template, "allowedCount"),
        severity: "error",
        messageFa: "سقف مجاز باید عدد صحیح غیرمنفی باشد.",
      });
    }
  }
}

function rowFingerprint(record: Record<string, string>, keys: string[]): string {
  return keys.map((k) => `${k}=${(record[k] ?? "").trim()}`).join("|");
}

function subjectCodeForTemplate(
  template: LaunchImportTemplate,
  record: Record<string, string>,
): string | undefined {
  const raw =
    template.key === "headcount_approval_create"
      ? (record.requirementCode ?? "").trim()
      : (record.personnelCode ?? "").trim();
  if (raw && !looksLikeInternalId(raw)) return raw;
  return undefined;
}

function uniquenessKeyForTemplate(
  template: LaunchImportTemplate,
  record: Record<string, string>,
): { column: string; code: string } | null {
  if (template.key === "headcount_approval_create") {
    const code = record.requirementCode?.trim() ?? "";
    return code ? { column: "requirementCode", code } : null;
  }
  const code = record.personnelCode?.trim() ?? "";
  return code ? { column: "personnelCode", code } : null;
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

    switch (template.key) {
      case "personnel_event_transfer":
        validateTransferRow(issues, template, rowNum, record);
        break;
      case "headcount_approval_create":
        validateHeadcountRow(issues, template, rowNum, record);
        break;
      case "person_employment_start":
        validatePersonRow(
          issues,
          template,
          rowNum,
          record,
          priorStartByCode,
        );
        break;
      default:
        pushIssue(issues, {
          row: rowNum,
          column: "_template",
          columnCaptionFa: "قالب",
          severity: "error",
          messageFa: `قالب «${template.key}» برای اعتبارسنجی پشتیبانی نمی‌شود.`,
        });
        break;
    }

    const uniq = uniquenessKeyForTemplate(template, record);
    if (uniq) {
      const list = codeRows.get(`${uniq.column}:${uniq.code}`) ?? [];
      list.push(rowNum);
      codeRows.set(`${uniq.column}:${uniq.code}`, list);
    }

    const fp = rowFingerprint(record, keys);
    const prevFpRow = fingerprints.get(fp);
    if (prevFpRow != null) {
      const subjectCol =
        template.key === "headcount_approval_create"
          ? "requirementCode"
          : "personnelCode";
      pushIssue(issues, {
        row: rowNum,
        column: subjectCol,
        columnCaptionFa: captionFor(template, subjectCol),
        severity: "error",
        messageFa: `ردیف تکراری با ردیف ${prevFpRow} (تمام ستون‌ها یکسان).`,
      });
    } else {
      fingerprints.set(fp, rowNum);
    }
  }

  for (const [keyed, rowList] of codeRows) {
    if (rowList.length <= 1) continue;
    const sep = keyed.indexOf(":");
    const column = keyed.slice(0, sep);
    const code = keyed.slice(sep + 1);
    for (let i = 1; i < rowList.length; i++) {
      const rowNum = rowList[i]!;
      const alreadyDup = issues.some(
        (iss) =>
          iss.row === rowNum &&
          iss.messageFa.includes("ردیف تکراری"),
      );
      if (alreadyDup) continue;
      const label =
        column === "requirementCode" ? "کد نیازمندی" : "کد پرسنلی";
      pushIssue(issues, {
        row: rowNum,
        column,
        columnCaptionFa: captionFor(template, column),
        severity: "warning",
        messageFa: `${label} «${code}» در چند ردیف تکرار شده (${rowList.join("، ")}).`,
        subjectBusinessCode: looksLikeInternalId(code) ? undefined : code,
      });
    }
  }

  const codeByRow = new Map<number, string>();
  for (let i = 0; i < rows.length; i++) {
    const rowNum = sourceRowNumbers[i] ?? i + 2;
    const subject = subjectCodeForTemplate(template, rows[i]!);
    if (subject) codeByRow.set(rowNum, subject);
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
