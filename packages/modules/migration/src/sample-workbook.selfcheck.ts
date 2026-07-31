/**
 * Sample workbook selfcheck (Story 9.1).
 * Run: pnpm --filter @divan/migration selfcheck:sample-workbook
 *
 * Round-trip: generate → parseImportFile → validateImportMatrix → zero
 * structural errors; no formula cells; headers match template; entity
 * examples are business codes (not UUID-shaped).
 */
import assert from "node:assert/strict";

import ExcelJS from "exceljs";

import { MigrationError } from "./errors";
import {
  SAMPLE_FORMULA_SAFE_TAB_PREFIX,
  generateSampleWorkbook,
  getLaunchImportTemplate,
  neutralizeSampleCellValue,
  parseImportFile,
  validateImportMatrix,
} from "./index";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const templateKey = "person_employment_start";
const template = getLaunchImportTemplate(templateKey);
assert.ok(template, "launch template must exist");

const sample = await generateSampleWorkbook(templateKey);
assert.equal(sample.templateKey, templateKey);
assert.equal(sample.fileName, `${templateKey}-sample.xlsx`);
assert.ok(sample.buffer.length > 0);
assert.equal(sample.purposeFa, template.purposeFa);
assert.equal(sample.arMigrationStatus, "provisional-pending-freeze");

/** Headers + example row round-trip */
const parsed = await parseImportFile({
  buffer: sample.buffer,
  fileName: sample.fileName,
  templateKey,
});
assert.deepEqual(
  parsed.headers,
  template.columns.map((c) => c.headerFa),
);
assert.equal(parsed.rows.length, 1);
for (const col of template.columns) {
  assert.equal(
    parsed.rows[0]![col.key],
    col.exampleValue,
    `example for ${col.key} must round-trip`,
  );
}

const issues = validateImportMatrix(parsed);
assert.equal(
  issues.filter((i) => i.severity === "error").length,
  0,
  `sample example row must have zero structural errors: ${JSON.stringify(issues)}`,
);

/** No formula cells; all data cells forced to text numFmt */
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(sample.buffer as unknown as ExcelJS.Buffer);
for (const sheet of wb.worksheets) {
  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      assert.ok(
        !(v && typeof v === "object" && "formula" in v),
        "sample workbook must not contain formula cells",
      );
      if (rowNumber === 2) {
        assert.equal(cell.numFmt, "@", "data cells must use text numFmt");
      }
    });
  });
}

/** Formula-control neutralize branch (CWE-1236 / FR-52) */
assert.equal(
  neutralizeSampleCellValue("=1+1"),
  `${SAMPLE_FORMULA_SAFE_TAB_PREFIX}=1+1`,
);
assert.equal(
  neutralizeSampleCellValue("+cmd"),
  `${SAMPLE_FORMULA_SAFE_TAB_PREFIX}+cmd`,
);
assert.equal(
  neutralizeSampleCellValue("-1"),
  `${SAMPLE_FORMULA_SAFE_TAB_PREFIX}-1`,
);
assert.equal(
  neutralizeSampleCellValue("@sum"),
  `${SAMPLE_FORMULA_SAFE_TAB_PREFIX}@sum`,
);
assert.equal(neutralizeSampleCellValue("safe"), "safe");

/** Entity columns: business codes, never UUID-shaped examples */
const entityKeys = [
  "teamCode",
  "organizationalRoleCode",
  "jobTitleCode",
  "ladderCode",
  "gradeCode",
  "seniorityCode",
] as const;
for (const key of entityKeys) {
  const col = template.columns.find((c) => c.key === key);
  assert.ok(col, `${key} column required`);
  assert.ok(col.exampleValue.length > 0, `${key} needs documented example`);
  assert.ok(
    !UUID_RE.test(col.exampleValue),
    `${key} example must not be UUID-shaped`,
  );
  assert.ok(!/شناسه/.test(col.headerFa), `${key} header must not say شناسه`);
}

/** Unknown template fails closed with Persian MigrationError */
let unknownThrown: unknown = null;
try {
  await generateSampleWorkbook("invented_template_9_1");
} catch (err) {
  unknownThrown = err;
}
assert.ok(unknownThrown instanceof MigrationError);
assert.equal((unknownThrown as MigrationError).code, "TEMPLATE_UNKNOWN");
assert.match((unknownThrown as MigrationError).messageFa, /[\u0600-\u06FF]/);

console.log("selfcheck:sample-workbook OK");
