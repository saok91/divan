/**
 * Formula-safe CSV / XLSX emission (Story 6.5 / FR-52 / CWE-1236).
 *
 * Neutralization strategy (documented):
 * - Detect formula-control chars via `@divan/migration` `hasFormulaControlPrefix`
 *   (same set as import: `= + - @` tab CR), after stripping leading whitespace.
 * - CSV: wrap every field in double quotes; for formula-control cells, prefix with
 *   tab (`\t`) *inside* the quotes (Excel-resistant; OWASP CSV injection).
 * - XLSX: write plain string/number values only via ExcelJS — never `cell.formula`,
 *   no defined names / macros / external links.
 * - Headers are neutralized the same way as cell values.
 * - Prefer reversible text treatment (tab prefix) over deletion of user data.
 */

import { hasFormulaControlPrefix } from "@divan/migration";
import ExcelJS from "exceljs";

export type ExportColumn = {
  id: string;
  headerFa: string;
};

export type ExportCellValue = string | number | null;

export type ExportRow = {
  id: string;
  cells: Record<string, ExportCellValue>;
};

/** Prefix used inside CSV quotes for formula-control neutralization. */
export const FORMULA_SAFE_TAB_PREFIX = "\t";

/**
 * Neutralize a cell for spreadsheet consumers.
 * Numbers pass through; null → empty string; formula-control strings get tab prefix.
 * Leading whitespace is stripped before prefix detection (trim-then-inject defenses).
 */
export function neutralizeExportCellValue(value: ExportCellValue): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  if (value.length === 0) return "";
  const trimmed = value.replace(/^\s+/, "");
  if (hasFormulaControlPrefix(trimmed) || hasFormulaControlPrefix(value)) {
    // Preserve original text after a leading tab; use trimmed for risk detection.
    const body = hasFormulaControlPrefix(value) ? value : trimmed;
    return `${FORMULA_SAFE_TAB_PREFIX}${body}`;
  }
  return value;
}

function escapeCsvField(raw: string): string {
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Build UTF-8 CSV bytes (no BOM — house BOM-safe rule for artifacts too).
 * All fields quoted; formula-control cells tab-prefixed inside quotes.
 */
export function writeFormulaSafeCsv(
  columns: readonly ExportColumn[],
  rows: readonly ExportRow[],
): Buffer {
  const lines: string[] = [];
  lines.push(
    columns.map((c) => escapeCsvField(neutralizeExportCellValue(c.headerFa))).join(","),
  );
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => escapeCsvField(neutralizeExportCellValue(row.cells[c.id] ?? null)))
        .join(","),
    );
  }
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

/**
 * Build XLSX bytes with literal values only — never formulas/macros/links.
 */
export async function writeFormulaSafeXlsx(
  columns: readonly ExportColumn[],
  rows: readonly ExportRow[],
  opts?: { sheetName?: string },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  // Do not set creator / company with sensitive content.
  workbook.creator = "Divan";
  workbook.created = new Date();
  const sheetName = (opts?.sheetName ?? "export").slice(0, 31) || "export";
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true }],
  });

  sheet.addRow(columns.map((c) => neutralizeExportCellValue(c.headerFa)));
  for (const row of rows) {
    const values = columns.map((c) => {
      const raw = row.cells[c.id] ?? null;
      if (raw == null) return "";
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      const neutralized = neutralizeExportCellValue(
        typeof raw === "number" ? String(raw) : raw,
      );
      return neutralized;
    });
    const excelRow = sheet.addRow(values);
    // Force formula-looking strings to stay text (ExcelJS may otherwise coerce).
    excelRow.eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell) => {
      if (
        typeof cell.value === "string" &&
        hasFormulaControlPrefix(cell.value.replace(/^\t/, "").replace(/^\s+/, ""))
      ) {
        cell.numFmt = "@";
      }
    });
  }

  // No defined names, no VBA, no external links.
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** Inspect CSV/XLSX text payload for a raw (non-neutralized) leading `=` or `@`. */
export function csvContainsUnquotedFormulaRisk(csvUtf8: string): boolean {
  const lines = csvUtf8.split(/\r?\n/).filter((l) => l.length > 0);
  for (const line of lines) {
    // Naive scan of quoted fields — after unescape, leading char must not be bare formula.
    const fields = line.match(/"(?:[^"]|"")*"/g) ?? [];
    for (const field of fields) {
      const inner = field.slice(1, -1).replace(/""/g, '"');
      const riskBody = inner.replace(/^\t/, "").replace(/^\s+/, "");
      if (
        hasFormulaControlPrefix(riskBody) &&
        !inner.startsWith(FORMULA_SAFE_TAB_PREFIX)
      ) {
        return true;
      }
    }
  }
  return false;
}
