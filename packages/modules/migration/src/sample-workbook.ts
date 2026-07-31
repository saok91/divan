/**
 * Sample workbook generation from the authoritative launch template catalogue
 * (Story 9.1 / FR-37 / FR-52).
 *
 * Formula-safe write mirrors `@divan/reporting` `writeFormulaSafeXlsx`
 * (tab-prefix + numFmt='@') without importing reporting — avoids a cycle
 * (reporting already depends on migration `hasFormulaControlPrefix`).
 */

import ExcelJS from "exceljs";

import { MigrationError } from "./errors";
import { hasFormulaControlPrefix } from "./parse-workbook";
import {
  getLaunchImportTemplate,
  type LaunchImportTemplate,
} from "./templates";

/** Same neutralization prefix as reporting formula-safe export (CWE-1236). */
export const SAMPLE_FORMULA_SAFE_TAB_PREFIX = "\t";

export type SampleWorkbookResult = {
  templateKey: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
  purposeFa: string;
  /** Provisional catalogue version/status for thin FR-52 lifecycle. */
  arMigrationStatus: LaunchImportTemplate["arMigrationStatus"];
};

/** Exported for selfcheck coverage of the formula-control neutralize branch. */
export function neutralizeSampleCellValue(value: string): string {
  if (value.length === 0) return "";
  const trimmed = value.replace(/^\s+/, "");
  if (hasFormulaControlPrefix(trimmed) || hasFormulaControlPrefix(value)) {
    const body = hasFormulaControlPrefix(value) ? value : trimmed;
    return `${SAMPLE_FORMULA_SAFE_TAB_PREFIX}${body}`;
  }
  return value;
}

/**
 * Generate a formula-safe XLSX sample from the same authoritative template
 * used by parse/validate — header order + one exampleValue row.
 */
export async function generateSampleWorkbook(
  templateKey: string,
): Promise<SampleWorkbookResult> {
  const template = getLaunchImportTemplate(templateKey);
  if (!template) {
    throw new MigrationError(
      "TEMPLATE_UNKNOWN",
      "کلید قالب واردسازی نامعتبر است.",
    );
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Divan";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("sample", {
    views: [{ rightToLeft: true }],
  });

  const headers = template.columns.map((c) =>
    neutralizeSampleCellValue(c.headerFa),
  );
  sheet.addRow(headers);

  const exampleValues = template.columns.map((c) =>
    neutralizeSampleCellValue(c.exampleValue),
  );
  const dataRow = sheet.addRow(exampleValues);
  // Force text format on all data cells — reduces Excel desktop coercion
  // (leading zeros / date-shaped strings) while keeping literals only.
  dataRow.eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell) => {
    cell.numFmt = "@";
  });

  // Literal cells only — never cell.formula / macros / external links.
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    templateKey: template.key,
    fileName: `${template.key}-sample.xlsx`,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
    purposeFa: template.purposeFa,
    arMigrationStatus: template.arMigrationStatus,
  };
}
