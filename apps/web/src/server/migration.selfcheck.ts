/**
 * Thin web assert for Stories 6.1–6.2 migration wiring.
 * Run: pnpm --filter @divan/web selfcheck:migration
 *
 * Domain selfchecks own parse/validate/preview/cutover. This file asserts
 * operational copy + leave-guard helpers + Import Batch report message
 * honesty (unavailable message preserved; no zero-error fabrication).
 */
import assert from "node:assert/strict";

import { MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA } from "@divan/reporting";

import {
  importConcurrentBatchMessage,
  leaveGuardImportPreviewMessage,
  leaveGuardImportStagingMessage,
  operationalCopy,
} from "../../lib/operational-copy";

assert.equal(
  leaveGuardImportPreviewMessage("abc-123"),
  "پیش‌نمایش دسته abc-123 ذخیره نشده.",
);
assert.ok(leaveGuardImportStagingMessage("batch-1").includes("batch-1"));

assert.ok(operationalCopy.importLoadError);
assert.ok(operationalCopy.importFormulaReject);
assert.ok(operationalCopy.importClosePreview);
assert.ok(operationalCopy.importReopenPreview);
assert.ok(operationalCopy.importConfirmDismiss);
assert.ok(operationalCopy.importApproveAction);
assert.ok(operationalCopy.importExecuteAction);
assert.ok(operationalCopy.importExecuteConfirmTitle);
assert.ok(operationalCopy.importExecuteConsequence);
assert.ok(operationalCopy.importConcurrentBatch.includes("دسته دیگری"));
assert.ok(operationalCopy.importContentsReadOnly);
assert.ok(operationalCopy.importSampleDownload);
assert.ok(operationalCopy.importCatalogueTitle);
assert.ok(operationalCopy.importTemplateAccessRequired.includes("{permission}"));
assert.ok(operationalCopy.importBulkCatalogueHint.includes("ورود داده"));
assert.ok(operationalCopy.importSampleClassificationFa.length > 0);

assert.ok(operationalCopy.reconWorkspaceTitle);
assert.ok(operationalCopy.reconProductionBlocked);
assert.ok(operationalCopy.reconNotProductionReady);
assert.ok(operationalCopy.reconProductionExecute);
assert.ok(operationalCopy.reconSignMigrationLead);
assert.ok(operationalCopy.reconTrialExecuteOnly);
assert.ok(operationalCopy.reconTrialExecuteStatus);
assert.ok(operationalCopy.reconControlsJsonRequired);
assert.ok(operationalCopy.reconWaiverFieldsRequired);
assert.ok(operationalCopy.reconIndependentApproverPlaceholder);

const concurrent = importConcurrentBatchMessage({
  ownerDisplayName: "مالک",
  correlationId: "cid-1",
});
assert.ok(concurrent.includes("دسته دیگری در حال اجراست"));
assert.ok(concurrent.includes("مالک"));
assert.ok(concurrent.includes("cid-1"));

assert.equal(
  operationalCopy.reportImportBatchUnavailable,
  MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA,
);
assert.ok(
  !MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA.includes("۰ خطا"),
  "Import Batch must stay unavailable — no zero-error fabrication",
);

console.log("selfcheck:migration OK");
