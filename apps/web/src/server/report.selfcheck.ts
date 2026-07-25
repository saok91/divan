/**
 * Report filter + copy oracle selfcheck (Story 5.5).
 * Run: pnpm --filter @divan/web selfcheck:report
 *
 * Complements @divan/reporting selfcheck:report (catalogue / status filters).
 */
import assert from "node:assert/strict";

import { MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA } from "@divan/reporting";

import { operationalCopy } from "@/lib/operational-copy";

import { reportFilterSchema } from "./report";

assert.equal(operationalCopy.suppressedCohort, "داده قابل نمایش نیست");
assert.equal(
  operationalCopy.emptyReportScope,
  "در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.",
);
assert.equal(operationalCopy.reportLoadError, "بارگذاری گزارش ممکن نشد.");
assert.notEqual(
  operationalCopy.reportLoadError,
  operationalCopy.accessDeniedTitle,
);
assert.notEqual(
  operationalCopy.suppressedCohort,
  operationalCopy.emptyReportScope,
);
assert.notEqual(operationalCopy.suppressedCohort, "0");
assert.notEqual(
  operationalCopy.emptyReportScope,
  operationalCopy.emptySearch,
);
assert.notEqual(
  operationalCopy.reportImportBatchUnavailable,
  operationalCopy.emptyReportScope,
);
assert.ok(
  operationalCopy.reportImportBatchUnavailable.includes("Epic"),
  "Import Batch unavailable copy must mention Epic 6",
);
assert.equal(
  operationalCopy.reportImportBatchUnavailable,
  MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA,
  "Web Import Batch copy must match @divan/reporting constant",
);
assert.ok(
  operationalCopy.exportOpenPanel.length > 0 &&
    operationalCopy.exportCustodyBoundary.includes("محلی"),
  "Export panel copy must be live (Story 6.5) — not stub-only",
);
assert.ok(
  operationalCopy.exportCustodyAckLabel.length > 0,
  "Custody acknowledgement copy required",
);
/** Stub hint retired as primary affordance — may remain as deprecated pointer. */
assert.ok(
  !operationalCopy.reportExportStubHint.includes("۶٫۵") &&
    !operationalCopy.reportExportStubHint.includes("6.5"),
  "Stub hint must no longer defer to Story 6.5 as unfinished",
);

/** Snapshot report — range optional. */
const parsed = reportFilterSchema.safeParse({
  reportKey: "active_persons",
  evaluationMode: "current",
});
assert.equal(parsed.success, true);

/** Event report — range required. */
const needsRange = reportFilterSchema.safeParse({
  reportKey: "starts",
  evaluationMode: "current",
});
assert.equal(needsRange.success, false);

const withRange = reportFilterSchema.safeParse({
  reportKey: "starts",
  evaluationMode: "current",
  rangeStart: "2026-01-01",
  rangeEnd: "2026-07-24",
});
assert.equal(withRange.success, true);

/** Invalid / unknown report key rejected. */
const badKey = reportFilterSchema.safeParse({
  reportKey: "invented_cohort",
  rangeStart: "2026-01-01",
  rangeEnd: "2026-07-24",
});
assert.equal(badKey.success, false);

/** Inverted range rejected. */
const badRange = reportFilterSchema.safeParse({
  reportKey: "starts",
  rangeStart: "2026-07-24",
  rangeEnd: "2026-01-01",
});
assert.equal(badRange.success, false);

/** as_of without asOfDate rejected. */
const missingAsOf = reportFilterSchema.safeParse({
  reportKey: "active_persons",
  evaluationMode: "as_of",
});
assert.equal(missingAsOf.success, false);

/** as_of with valid asOfDate accepted (snapshot, no range). */
const okAsOf = reportFilterSchema.safeParse({
  reportKey: "import_batch_outcomes",
  evaluationMode: "as_of",
  asOfDate: "2026-07-01",
});
assert.equal(okAsOf.success, true);

console.log("web report selfcheck: ok");
