/**
 * Import preview selfcheck (Story 6.1).
 * Run: pnpm --filter @divan/migration selfcheck:import-preview
 *
 * Covers: template catalogue; formula/macro rejection; formula-control
 * literalization; row/column Persian issue shape; preview permission omit;
 * cancel clears draft; no event-store append; Import Batch report untouched
 * (asserted by not importing reporting activation helpers).
 * No DB required.
 */
import assert from "node:assert/strict";

import ExcelJS from "exceljs";

import {
  LAUNCH_IMPORT_TEMPLATE_KEYS,
  buildImportPreviewBatch,
  cancelImportPreviewBatch,
  clearImportPreviewDraftStore,
  confirmImportPreviewDraft,
  detectImportFileKind,
  formatImportIssueCite,
  getImportPreviewBatch,
  hasFormulaControlPrefix,
  literalizeCellValue,
  parseCsvBuffer,
  parseCsvText,
  parseImportFile,
  requireLaunchImportTemplateCatalogue,
  validateImportMatrix,
} from "./index";

clearImportPreviewDraftStore();

/** Catalogue completeness */
const catalogue = requireLaunchImportTemplateCatalogue();
assert.ok(catalogue.length >= 1);
assert.ok(LAUNCH_IMPORT_TEMPLATE_KEYS.includes("person_employment_start"));
for (const t of catalogue) {
  assert.equal(t.arMigrationStatus, "provisional-pending-freeze");
  assert.ok(t.columns.some((c) => c.required));
}

/** Formula-control literalization (FR-52) */
assert.equal(literalizeCellValue("=1+1"), "=1+1");
assert.equal(literalizeCellValue("+cmd"), "+cmd");
assert.equal(literalizeCellValue("-2"), "-2");
assert.equal(literalizeCellValue("@sum"), "@sum");
assert.equal(hasFormulaControlPrefix("=CMD"), true);
assert.equal(hasFormulaControlPrefix("hello"), false);
assert.equal(literalizeCellValue("  نام  "), "نام");

/** File kind reject macros */
assert.equal(detectImportFileKind("data.xlsm"), "macro");
assert.equal(detectImportFileKind("data.xls"), "macro");
assert.equal(detectImportFileKind("data.csv"), "csv");
assert.equal(detectImportFileKind("data.xlsx"), "xlsx");
assert.equal(detectImportFileKind("data.pdf"), "unknown");

/** Unclosed CSV quote fails closed */
let quoteThrown = false;
try {
  parseCsvText('a,b\n"unclosed,1\n');
} catch (err) {
  quoteThrown = true;
  assert.ok(err && typeof err === "object" && "code" in err);
  assert.equal((err as { code: string }).code, "PARSE_FAILED");
}
assert.equal(quoteThrown, true);

/** Date literalization — UTC Y-M-D */
assert.equal(
  literalizeCellValue(new Date(Date.UTC(2020, 0, 15))),
  "2020-01-15",
);
/** Happy-path CSV parse + validate */
const templateKey = "person_employment_start";
const headers = [
  "کد پرسنلی",
  "نام",
  "نام خانوادگی",
  "موبایل",
  "نام پدر",
  "تاریخ تولد",
  "جنسیت",
  "ملیت",
  "تاریخ شروع",
  "نوع همکاری",
  "شناسه تیم",
  "شناسه نقش سازمانی",
  "شناسه عنوان شغلی",
  "شناسه نردبان",
  "شناسه گرید",
  "شناسه ارشدیت",
];
const teamId = "11111111-1111-4111-8111-111111111111";
const roleId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const ladderId = "44444444-4444-4444-8444-444444444444";
const gradeId = "55555555-5555-4555-8555-555555555555";

function csvLine(cells: string[]): string {
  return cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(",");
}

const goodRow = [
  "P-100",
  "نیلوفر",
  "احمدی",
  "09121234567",
  "علی",
  "1990-01-15",
  "female",
  "IR",
  "2026-03-01",
  "employee",
  teamId,
  roleId,
  jobId,
  ladderId,
  gradeId,
  "",
];

const csvGood = [csvLine(headers), csvLine(goodRow)].join("\n");
const parsedGood = await parseCsvBuffer(
  Buffer.from(csvGood, "utf8"),
  templateKey,
  "launch.csv",
);
assert.equal(parsedGood.rows.length, 1);
assert.equal(parsedGood.rows[0]!.personnelCode, "P-100");

const issuesGood = validateImportMatrix(parsedGood);
assert.equal(
  issuesGood.filter((i) => i.severity === "error").length,
  0,
  "happy path should have no errors",
);

/** Missing required → Persian row/column cite */
const badRow = [...goodRow];
badRow[0] = ""; // personnelCode
const csvBad = [csvLine(headers), csvLine(badRow)].join("\n");
const parsedBad = await parseCsvBuffer(
  Buffer.from(csvBad, "utf8"),
  templateKey,
  "bad.csv",
);
const issuesBad = validateImportMatrix(parsedBad);
assert.ok(issuesBad.some((i) => i.severity === "error" && i.column === "personnelCode"));
const cite = formatImportIssueCite(issuesBad[0]!);
assert.ok(cite.includes("ردیف"));
assert.ok(cite.includes("ستون"));

/** Template mismatch fail-closed */
let mismatchThrown = false;
try {
  await parseCsvBuffer(
    Buffer.from("foo,bar\n1,2\n", "utf8"),
    templateKey,
    "mismatch.csv",
  );
} catch (err) {
  mismatchThrown = true;
  assert.ok(err && typeof err === "object" && "messageFa" in err);
}
assert.equal(mismatchThrown, true);

/** Unknown template */
let unknownThrown = false;
try {
  await parseCsvBuffer(
    Buffer.from(csvGood, "utf8"),
    "invented_template",
    "x.csv",
  );
} catch (err) {
  unknownThrown = true;
  assert.ok(err && typeof err === "object" && "code" in err);
}
assert.equal(unknownThrown, true);

/** .xlsm rejected by parseImportFile */
let xlsmThrown = false;
try {
  await parseImportFile({
    buffer: Buffer.from("PK"),
    fileName: "evil.xlsm",
    templateKey,
  });
} catch {
  xlsmThrown = true;
}
assert.equal(xlsmThrown, true);

/** XLSX with formula cell rejected */
const wb = new ExcelJS.Workbook();
const sheet = wb.addWorksheet("Sheet1");
sheet.addRow(headers);
const formulaRow = sheet.addRow(goodRow);
formulaRow.getCell(1).value = { formula: "1+1", result: 2 } as ExcelJS.CellValue;
const xlsxBuf = Buffer.from(await wb.xlsx.writeBuffer());
let formulaThrown = false;
try {
  await parseImportFile({
    buffer: xlsxBuf,
    fileName: "formula.xlsx",
    templateKey,
  });
} catch (err) {
  formulaThrown = true;
  assert.ok(err && typeof err === "object" && "messageFa" in err);
  const fa = String((err as { messageFa: string }).messageFa);
  assert.ok(fa.includes("فرمول") || fa.includes("رد"));
}
assert.equal(formulaThrown, true);

/** Plain XLSX happy path + literal = prefix in cell */
const wb2 = new ExcelJS.Workbook();
const sh2 = wb2.addWorksheet("Data");
sh2.addRow(headers);
const lit = [...goodRow];
lit[1] = "=نیلوفر"; // givenName with formula-control prefix — literal, not formula cell
sh2.addRow(lit);
const xlsxOk = Buffer.from(await wb2.xlsx.writeBuffer());
const parsedX = await parseImportFile({
  buffer: xlsxOk,
  fileName: "ok.xlsx",
  templateKey,
});
assert.equal(parsedX.rows[0]!.givenName, "=نیلوفر");

/** Preview permission omit — strip a column key */
const actorA = "actor-a-selfcheck";
const actorB = "actor-b-selfcheck";
const preview = buildImportPreviewBatch(parsedGood, {
  permittedDataCategories: new Set(["identity.person"]),
  omittedColumnKeys: new Set(["mobilePhone"]),
  createdByAccountId: actorA,
});
assert.equal(preview.executionAllowed, false);
assert.equal(preview.eventStoreAppended, false);
assert.ok(!preview.visibleColumns.some((c) => c.key === "mobilePhone"));
assert.ok(!("mobilePhone" in preview.rows[0]!.values));
assert.ok(preview.visibleColumns.some((c) => c.key === "personnelCode"));

/** Omit must strip issue cites for hidden columns */
const mobileBlank = [...goodRow];
mobileBlank[3] = "";
const csvMobileBlank = [csvLine(headers), csvLine(mobileBlank)].join("\n");
const parsedMobileBlank = await parseCsvBuffer(
  Buffer.from(csvMobileBlank, "utf8"),
  templateKey,
  "mobile-blank.csv",
);
assert.ok(
  validateImportMatrix(parsedMobileBlank).some(
    (i) => i.column === "mobilePhone",
  ),
);
const previewOmitMobile = buildImportPreviewBatch(parsedMobileBlank, {
  permittedDataCategories: new Set(["identity.person"]),
  omittedColumnKeys: new Set(["mobilePhone"]),
  createdByAccountId: actorA,
});
assert.ok(!previewOmitMobile.issues.some((i) => i.column === "mobilePhone"));
assert.ok(
  !previewOmitMobile.issueCitesFa.some((c) => c.includes("موبایل")),
);
cancelImportPreviewBatch(previewOmitMobile.previewBatchId, actorA);

const fetched = getImportPreviewBatch(preview.previewBatchId, {
  actorAccountId: actorA,
});
assert.equal(fetched.previewBatchId, preview.previewBatchId);

/** Ownership — foreign actor denied */
let foreignDenied = false;
try {
  getImportPreviewBatch(preview.previewBatchId, { actorAccountId: actorB });
} catch (err) {
  foreignDenied = true;
  assert.ok(err && typeof err === "object" && "code" in err);
  assert.equal((err as { code: string }).code, "PERMISSION_DENIED");
}
assert.equal(foreignDenied, true);

/** Confirm idempotent then cancel by owner */
const confirmed = confirmImportPreviewDraft(preview.previewBatchId, actorA);
assert.equal(confirmed.status, "confirmed-draft");
const confirmedAgain = confirmImportPreviewDraft(preview.previewBatchId, actorA);
assert.equal(confirmedAgain.status, "confirmed-draft");

/** Cancel clears dirty draft */
cancelImportPreviewBatch(preview.previewBatchId, actorA);
let cancelMiss = false;
try {
  getImportPreviewBatch(preview.previewBatchId, { actorAccountId: actorA });
} catch {
  cancelMiss = true;
}
assert.equal(cancelMiss, true);

/** Narrow category omit — empty permitted set → no columns */
const previewOmitAll = buildImportPreviewBatch(parsedGood, {
  permittedDataCategories: new Set(),
  createdByAccountId: actorA,
});
assert.equal(previewOmitAll.visibleColumns.length, 0);
assert.equal(Object.keys(previewOmitAll.rows[0]!.values).length, 0);
assert.equal(previewOmitAll.eventStoreAppended, false);
cancelImportPreviewBatch(previewOmitAll.previewBatchId, actorA);

/** Unknown extension → FILE_TYPE_REJECTED (not MACRO) */
let unknownType = false;
try {
  await parseImportFile({
    buffer: Buffer.from("not-a-spreadsheet"),
    fileName: "data.bin",
    templateKey,
  });
} catch (err) {
  unknownType = true;
  assert.ok(err && typeof err === "object" && "code" in err);
  assert.equal((err as { code: string }).code, "FILE_TYPE_REJECTED");
}
assert.equal(unknownType, true);

console.log("selfcheck:import-preview OK");
