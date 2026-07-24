/**
 * CSV/XLSX parse pipeline for import preview (Story 6.1 / FR-52).
 *
 * Server-side only — never trust client-parsed rows as authoritative.
 * Rejects formulas, macros, external links, and active workbook structures.
 * Leading formula-control characters are stored/displayed as literal text.
 */

import ExcelJS from "exceljs";

import { MigrationError } from "./errors";
import {
  getLaunchImportTemplate,
  templateHeaderMap,
  type LaunchImportTemplate,
} from "./templates";

/** Hard limits — NFR-13 envelope; not invented AR-NFR percentiles. */
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_SHEETS = 1;
export const IMPORT_MAX_DATA_ROWS = 5_000;

const FORMULA_CONTROL_PREFIX = /^[=+\-@\t\r]/;

export type ParsedImportMatrix = {
  template: LaunchImportTemplate;
  /** Header labels as found in file (trimmed). */
  headers: string[];
  /** Column keys aligned to template after header map. */
  columnKeys: string[];
  /**
   * Data rows as null-prototype records keyed by template column key.
   * Values are literal strings (formula-control prefixes preserved as text).
   */
  rows: Array<Record<string, string>>;
  /** 1-based spreadsheet row numbers parallel to `rows` (header is row 1). */
  sourceRowNumbers: number[];
};

export type ImportFileKind = "csv" | "xlsx" | "macro" | "unknown";

export function detectImportFileKind(fileName: string): ImportFileKind {
  const lower = fileName.trim().toLowerCase();
  if (
    lower.endsWith(".xlsm") ||
    lower.endsWith(".xlsb") ||
    lower.endsWith(".xls")
  ) {
    return "macro";
  }
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return "unknown";
}

/** OLE Compound Document magic (legacy .xls / macro containers). */
function isOleCompound(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  );
}

function isZipContainer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/**
 * Resolve kind from extension + content sniff (do not trust rename alone).
 */
export function resolveImportFileKind(
  buffer: Buffer,
  fileName: string,
): ImportFileKind {
  if (isOleCompound(buffer)) return "macro";
  const byName = detectImportFileKind(fileName);
  if (byName === "macro") return "macro";
  if (byName === "xlsx") {
    if (!isZipContainer(buffer)) return "unknown";
    return "xlsx";
  }
  if (byName === "csv") {
    if (isZipContainer(buffer) || isOleCompound(buffer)) return "unknown";
    return "csv";
  }
  return "unknown";
}

/**
 * Normalize a cell display value: coerce to string and keep leading
 * formula-control characters as literal text (FR-52).
 */
export function literalizeCellValue(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === "boolean") return raw ? "true" : "false";
  if (raw instanceof Date) {
    // Excel date-only cells: use UTC Y-M-D to avoid local-TZ day shift.
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const d = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === "object") {
    // ExcelJS rich text / hyperlink objects — take text only if plain.
    const obj = raw as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(obj.richText)) {
      return literalizeCellValue(obj.richText.map((p) => p.text).join(""));
    }
    if (obj.text != null) return literalizeCellValue(obj.text);
    if (obj.result != null) return literalizeCellValue(obj.result);
    return "";
  }
  let text = String(raw);
  // Strip UTF-8 BOM if present on first cell
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // Preserve formula-control prefix as literal (do not strip)
  if (FORMULA_CONTROL_PREFIX.test(text)) {
    return text;
  }
  return text.trim();
}

/** True when a plain-text value begins with spreadsheet formula-control chars. */
export function hasFormulaControlPrefix(value: string): boolean {
  return FORMULA_CONTROL_PREFIX.test(value);
}

function assertFileSize(byteLength: number): void {
  if (byteLength > IMPORT_MAX_FILE_BYTES) {
    throw new MigrationError(
      "FILE_TOO_LARGE",
      `حجم فایل از حد مجاز (${Math.floor(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} مگابایت) بیشتر است.`,
    );
  }
}

function assertTemplateKey(templateKey: string): LaunchImportTemplate {
  const template = getLaunchImportTemplate(templateKey);
  if (!template) {
    throw new MigrationError(
      "TEMPLATE_UNKNOWN",
      "قالب واردسازی شناخته‌شده نیست. از قالب‌های ثبت‌شدهٔ راه‌اندازی استفاده کنید (انجماد AR-MIGRATION هنوز نهایی شده).",
    );
  }
  return template;
}

function mapHeadersToColumns(
  template: LaunchImportTemplate,
  headers: string[],
): { columnKeys: string[]; issues: string[] } {
  const headerMap = templateHeaderMap(template);
  const columnKeys: string[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const header of headers) {
    const col = headerMap.get(header.trim());
    if (!col) {
      issues.push(`ستون ناشناخته «${header}» با قالب «${template.titleFa}» مطابقت ندارد.`);
      columnKeys.push("");
      continue;
    }
    if (seen.has(col.key)) {
      issues.push(`ستون تکراری «${header}».`);
      columnKeys.push("");
      continue;
    }
    seen.add(col.key);
    columnKeys.push(col.key);
  }

  for (const col of template.columns) {
    if (col.required && !seen.has(col.key)) {
      issues.push(`ستون الزامی «${col.headerFa}» در فایل نیست.`);
    }
  }

  return { columnKeys, issues };
}

function matrixToRecords(
  template: LaunchImportTemplate,
  headers: string[],
  matrix: string[][],
  sourceRowNumbers: number[],
): ParsedImportMatrix {
  const { columnKeys, issues } = mapHeadersToColumns(template, headers);
  if (issues.length > 0) {
    throw new MigrationError(
      "TEMPLATE_MISMATCH",
      issues.join(" "),
    );
  }

  if (matrix.length > IMPORT_MAX_DATA_ROWS) {
    throw new MigrationError(
      "ROW_LIMIT",
      `تعداد ردیف‌ها از حد مجاز (${IMPORT_MAX_DATA_ROWS}) بیشتر است.`,
    );
  }

  const rows: Array<Record<string, string>> = [];
  for (let i = 0; i < matrix.length; i++) {
    const cells = matrix[i]!;
    const record = Object.create(null) as Record<string, string>;
    for (let c = 0; c < columnKeys.length; c++) {
      const key = columnKeys[c]!;
      if (!key) continue;
      record[key] = cells[c] ?? "";
    }
    rows.push(record);
  }

  return {
    template,
    headers,
    columnKeys: columnKeys.filter(Boolean),
    rows,
    sourceRowNumbers,
  };
}

export type ParseCsvTextOptions = {
  /** Max total rows including header; throws ROW_LIMIT when exceeded. */
  maxTotalRows?: number;
};

/** Minimal RFC4180-ish CSV parse (quoted fields, comma separator). */
export function parseCsvText(
  text: string,
  opts?: ParseCsvTextOptions,
): string[][] {
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const maxTotalRows = opts?.maxTotalRows;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushRow = (): void => {
    rows.push(row);
    row = [];
    if (maxTotalRows != null && rows.length > maxTotalRows) {
      throw new MigrationError(
        "ROW_LIMIT",
        `تعداد ردیف‌ها از حد مجاز (${IMPORT_MAX_DATA_ROWS}) بیشتر است.`,
      );
    }
  };

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(literalizeCellValue(field));
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(literalizeCellValue(field));
      field = "";
      pushRow();
      continue;
    }
    if (ch === "\r") {
      continue;
    }
    field += ch;
  }
  if (inQuotes) {
    throw new MigrationError(
      "PARSE_FAILED",
      "نقل‌قول CSV بسته نشده است.",
    );
  }
  if (field.length > 0 || row.length > 0) {
    row.push(literalizeCellValue(field));
    pushRow();
  }
  return rows;
}

export async function parseCsvBuffer(
  buffer: Buffer,
  templateKey: string,
  fileName: string,
): Promise<ParsedImportMatrix> {
  assertFileSize(buffer.byteLength);
  const kind = resolveImportFileKind(buffer, fileName);
  if (kind !== "csv") {
    throw new MigrationError(
      "FILE_TYPE_REJECTED",
      "فقط فایل‌های CSV یا XLSX ساده پذیرفته می‌شوند. فایل‌های ماکرو (.xlsm) و OLE رد می‌شوند.",
    );
  }
  const template = assertTemplateKey(templateKey);
  const text = buffer.toString("utf8");
  // header + max data rows — reject while parsing, not after full materialize
  const allRows = parseCsvText(text, {
    maxTotalRows: IMPORT_MAX_DATA_ROWS + 1,
  });
  if (allRows.length === 0) {
    throw new MigrationError("PARSE_FAILED", "فایل CSV خالی است.");
  }
  const headers = (allRows[0] ?? []).map((h) => h.trim());
  const data = allRows.slice(1);
  if (data.length > IMPORT_MAX_DATA_ROWS) {
    throw new MigrationError(
      "ROW_LIMIT",
      `تعداد ردیف‌ها از حد مجاز (${IMPORT_MAX_DATA_ROWS}) بیشتر است.`,
    );
  }
  const sourceRowNumbers = data.map((_, i) => i + 2);
  return matrixToRecords(template, headers, data, sourceRowNumbers);
}

function cellHasFormula(cell: ExcelJS.Cell): boolean {
  if (cell.formula) return true;
  const v = cell.value as unknown;
  if (v && typeof v === "object" && "formula" in (v as object)) return true;
  if (v && typeof v === "object" && "sharedFormula" in (v as object)) return true;
  return false;
}

export async function parseXlsxBuffer(
  buffer: Buffer,
  templateKey: string,
  fileName: string,
): Promise<ParsedImportMatrix> {
  assertFileSize(buffer.byteLength);
  const kind = resolveImportFileKind(buffer, fileName);
  if (kind === "macro") {
    throw new MigrationError(
      "MACRO_REJECTED",
      "فایل‌های دارای ماکرو یا قالب قدیمی Excel (.xlsm/.xls/.xlsb) پذیرفته نمی‌شوند. فایل XLSX ساده بدون ماکرو ارسال کنید.",
    );
  }
  if (kind !== "xlsx") {
    throw new MigrationError(
      "FILE_TYPE_REJECTED",
      "فقط فایل‌های CSV یا XLSX ساده پذیرفته می‌شوند.",
    );
  }

  const template = assertTemplateKey(templateKey);
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs typings accept Buffer via Uint8Array in practice
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new MigrationError(
      "PARSE_FAILED",
      "خواندن فایل Excel ممکن نشد. فایل را بررسی کنید یا CSV ارسال کنید.",
    );
  }

  // VBA / macros — ExcelJS exposes vbaProject when present
  const wbAny = workbook as unknown as { vbaProject?: unknown; model?: { vba?: unknown } };
  if (wbAny.vbaProject != null || wbAny.model?.vba != null) {
    throw new MigrationError(
      "MACRO_REJECTED",
      "فایل دارای ماکرو/VBA است و رد شد. فایل XLSX بدون ماکرو ارسال کنید.",
    );
  }

  if (workbook.worksheets.length > IMPORT_MAX_SHEETS) {
    throw new MigrationError(
      "SHEET_LIMIT",
      `فقط ${IMPORT_MAX_SHEETS} برگه در فایل واردسازی مجاز است.`,
    );
  }
  if (workbook.worksheets.length === 0) {
    throw new MigrationError("PARSE_FAILED", "فایل Excel برگه‌ای ندارد.");
  }

  // Defined names used as active structures — reject non-empty defined names collections
  const definedNames = workbook.definedNames;
  const modelNames =
    definedNames &&
    typeof (definedNames as { model?: unknown }).model !== "undefined"
      ? (definedNames as { model: unknown }).model
      : null;
  if (Array.isArray(modelNames) && modelNames.length > 0) {
    throw new MigrationError(
      "ACTIVE_STRUCTURE_REJECTED",
      "فایل شامل نام‌های تعریف‌شده (Defined Names) فعال است و رد شد. فقط مقادیر ساده بفرستید.",
    );
  }

  const sheet = workbook.worksheets[0]!;

  // External links / hyperlinks on cells
  let hasExternal = false;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value as unknown;
      if (v && typeof v === "object" && "hyperlink" in (v as object)) {
        hasExternal = true;
      }
      if (cellHasFormula(cell)) {
        throw new MigrationError(
          "FORMULA_REJECTED",
          `سلول دارای فرمول در ردیف ${row.number} رد شد. فقط مقادیر ثابت (بدون فرمول) مجاز است.`,
        );
      }
    });
  });
  if (hasExternal) {
    throw new MigrationError(
      "EXTERNAL_LINK_REJECTED",
      "فایل شامل پیوند خارجی/هایپرلینک است و رد شد.",
    );
  }

  const matrix: string[][] = [];
  const sourceRowNumbers: number[] = [];
  let headers: string[] | null = null;

  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values: string[] = [];
    const cellCount = Math.max(row.cellCount, headers?.length ?? 0);
    for (let c = 1; c <= cellCount; c++) {
      const cell = row.getCell(c);
      if (cellHasFormula(cell)) {
        throw new MigrationError(
          "FORMULA_REJECTED",
          `سلول دارای فرمول در ردیف ${rowNumber} رد شد. فقط مقادیر ثابت مجاز است.`,
        );
      }
      values.push(literalizeCellValue(cell.value));
    }
    if (headers == null) {
      headers = values.map((h) => h.trim()).filter((h, i, arr) => {
        // keep trailing empty only if mid-row — trim trailing empties
        return h.length > 0 || arr.slice(i + 1).some((x) => x.length > 0);
      });
      // Re-slice to non-trailing-empty headers
      while (headers.length > 0 && headers[headers.length - 1] === "") {
        headers.pop();
      }
      return;
    }
    // Skip fully empty data rows
    if (values.every((v) => v === "")) return;
    const padded = headers.map((_, i) => values[i] ?? "");
    matrix.push(padded);
    sourceRowNumbers.push(rowNumber);
  });

  // Callback mutation is invisible to control-flow; re-bind for narrowing.
  const resolvedHeaders = headers == null ? [] : [...headers];
  if (resolvedHeaders.length === 0) {
    throw new MigrationError("PARSE_FAILED", "سطر عنوان در فایل Excel یافت نشد.");
  }

  return matrixToRecords(template, resolvedHeaders, matrix, sourceRowNumbers);
}

export async function parseImportFile(args: {
  buffer: Buffer;
  fileName: string;
  templateKey: string;
}): Promise<ParsedImportMatrix> {
  const kind = resolveImportFileKind(args.buffer, args.fileName);
  if (kind === "macro") {
    throw new MigrationError(
      "MACRO_REJECTED",
      "فایل‌های دارای ماکرو یا قالب قدیمی Excel (.xlsm/.xls/.xlsb) پذیرفته نمی‌شوند. فایل CSV یا XLSX ساده ارسال کنید.",
    );
  }
  if (kind === "unknown") {
    throw new MigrationError(
      "FILE_TYPE_REJECTED",
      "نوع فایل واردسازی شناخته‌شده نیست. فقط CSV یا XLSX ساده بفرستید.",
    );
  }
  if (kind === "csv") {
    return parseCsvBuffer(args.buffer, args.templateKey, args.fileName);
  }
  return parseXlsxBuffer(args.buffer, args.templateKey, args.fileName);
}
