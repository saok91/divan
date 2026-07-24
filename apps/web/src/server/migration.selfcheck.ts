/**
 * Thin web assert for Story 6.1 migration wiring.
 * Run: pnpm --filter @divan/web selfcheck:migration
 *
 * Domain selfcheck owns parse/validate/preview. This file only asserts
 * operational copy + leave-guard helper + Import Batch report message
 * still unavailable (no fabrication).
 */
import assert from "node:assert/strict";

import { MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA } from "@divan/reporting";

import {
  leaveGuardImportPreviewMessage,
  operationalCopy,
} from "../../lib/operational-copy";

assert.equal(
  leaveGuardImportPreviewMessage("abc-123"),
  "پیش‌نمایش دسته abc-123 ذخیره نشده.",
);

assert.ok(operationalCopy.importLoadError);
assert.ok(operationalCopy.importFormulaReject);
assert.ok(operationalCopy.importClosePreview);
assert.ok(operationalCopy.importReopenPreview);
assert.ok(operationalCopy.importConfirmDismiss);
assert.ok(operationalCopy.importConfirmHint.includes("۶٫۲"));
assert.ok(operationalCopy.importBulkDayHint.includes("ورود گروهی"));

assert.equal(
  operationalCopy.reportImportBatchUnavailable,
  MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA,
);
assert.ok(
  !MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA.includes("۰ خطا"),
  "Import Batch must stay unavailable — no zero-error fabrication",
);

console.log("selfcheck:migration OK");
