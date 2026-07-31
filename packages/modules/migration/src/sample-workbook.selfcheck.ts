/**
 * Sample workbook selfcheck (Story 9.1 / 9.3).
 * Run: pnpm --filter @divan/migration selfcheck:sample-workbook
 *
 * Round-trip: generate → parseImportFile → validateImportMatrix → zero
 * structural errors; no formula cells; headers match template; entity
 * examples are business codes (not UUID-shaped). Covers every catalogue key.
 */
import assert from "node:assert/strict";

import ExcelJS from "exceljs";

import { MigrationError } from "./errors";
import {
  LAUNCH_IMPORT_TEMPLATE_KEYS,
  SAMPLE_FORMULA_SAFE_TAB_PREFIX,
  generateSampleWorkbook,
  getLaunchImportTemplate,
  neutralizeSampleCellValue,
  parseImportFile,
  validateImportMatrix,
} from "./index";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

assert.ok(
  LAUNCH_IMPORT_TEMPLATE_KEYS.length >= 3,
  "catalogue must include person + event + headcount templates",
);

for (const templateKey of LAUNCH_IMPORT_TEMPLATE_KEYS) {
  const template = getLaunchImportTemplate(templateKey);
  assert.ok(template, `launch template ${templateKey} must exist`);
  assert.ok(
    template.sections.length > 0,
    `${templateKey} must declare sections`,
  );

  const sample = await generateSampleWorkbook(templateKey);
  assert.equal(sample.templateKey, templateKey);
  assert.equal(sample.fileName, `${templateKey}-sample.xlsx`);
  assert.ok(sample.buffer.length > 0);
  assert.equal(sample.purposeFa, template.purposeFa);
  assert.equal(sample.arMigrationStatus, "provisional-pending-freeze");

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
      `example for ${templateKey}.${col.key} must round-trip`,
    );
  }

  const issues = validateImportMatrix(parsed);
  assert.equal(
    issues.filter((i) => i.severity === "error").length,
    0,
    `sample example row for ${templateKey} must have zero structural errors: ${JSON.stringify(issues)}`,
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(sample.buffer as unknown as ExcelJS.Buffer);
  for (const sheet of wb.worksheets) {
    sheet.eachRow((row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        assert.ok(
          !(v && typeof v === "object" && "formula" in v),
          `${templateKey}: sample workbook must not contain formula cells`,
        );
        if (rowNumber === 2) {
          assert.equal(
            cell.numFmt,
            "@",
            `${templateKey}: data cells must use text numFmt`,
          );
        }
      });
    });
  }

  for (const col of template.columns) {
    if (
      col.key.endsWith("Code") ||
      col.key === "personnelCode" ||
      col.key === "requirementCode"
    ) {
      assert.ok(col.exampleValue.length > 0, `${col.key} needs example`);
      assert.ok(
        !UUID_RE.test(col.exampleValue),
        `${templateKey}.${col.key} example must not be UUID-shaped`,
      );
      assert.ok(
        !/شناسه/.test(col.headerFa),
        `${templateKey}.${col.key} header must not say شناسه`,
      );
    }
  }
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

/** Unknown template fails closed with Persian MigrationError */
let unknownThrown: unknown = null;
try {
  await generateSampleWorkbook("invented_template_9_3");
} catch (err) {
  unknownThrown = err;
}
assert.ok(unknownThrown instanceof MigrationError);
assert.equal((unknownThrown as MigrationError).code, "TEMPLATE_UNKNOWN");
assert.match((unknownThrown as MigrationError).messageFa, /[\u0600-\u06FF]/);

console.log("selfcheck:sample-workbook OK");
