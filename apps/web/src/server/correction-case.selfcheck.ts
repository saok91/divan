/**
 * Web correction-case router selfcheck (Story 7.5).
 * Static source asserts — no DB required.
 * Run: pnpm --filter @divan/web selfcheck:correction-case
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CORRECTION_CASE_CLOSE_PERMISSION,
  CORRECTION_CASE_DATA_CATEGORY,
  CORRECTION_CASE_DECIDE_PERMISSION,
  CORRECTION_CASE_READ_PERMISSION,
  CORRECTION_CASE_WRITE_PERMISSION,
  MSG_CORRECTION_CASE_DENIED_FA,
} from "@divan/audit-envelope";

import { operationalCopy } from "../../lib/operational-copy";

const here = dirname(fileURLToPath(import.meta.url));
const rootSrc = readFileSync(join(here, "root.ts"), "utf8");
const routerSrc = readFileSync(join(here, "correction-case.ts"), "utf8");
const pageSrc = readFileSync(
  join(here, "../../app/(app)/correction-cases/page.tsx"),
  "utf8",
);
const panelSrc = readFileSync(
  join(here, "../../components/correction-cases/correction-cases-panel.tsx"),
  "utf8",
);

assert.equal(CORRECTION_CASE_READ_PERMISSION, "correction.case.read");
assert.equal(CORRECTION_CASE_WRITE_PERMISSION, "correction.case.write");
assert.equal(CORRECTION_CASE_DECIDE_PERMISSION, "correction.case.decide");
assert.equal(CORRECTION_CASE_CLOSE_PERMISSION, "correction.case.close");
assert.equal(CORRECTION_CASE_DATA_CATEGORY, "correction.case");
assert.equal(operationalCopy.correctionCaseDenied, MSG_CORRECTION_CASE_DENIED_FA);
assert.ok(operationalCopy.correctionCaseBreachedBadge.includes("مهلت"));
assert.ok(
  operationalCopy.correctionCasePendingPublicationHonesty.includes("۷٫۶") ||
    operationalCopy.correctionCasePendingPublicationHonesty.includes("انتشار"),
);

assert.match(rootSrc, /correctionCase:\s*correctionCaseRouter/);
assert.match(routerSrc, /list:\s*governedProcedure/);
assert.match(routerSrc, /open:\s*governedProcedure/);
assert.match(routerSrc, /decide:\s*governedProcedure/);
assert.match(routerSrc, /close:\s*governedProcedure/);
assert.match(routerSrc, /uploadAttachment:\s*governedProcedure/);
assert.match(routerSrc, /downloadAttachment:\s*governedProcedure/);
assert.match(routerSrc, /linkOutcome:\s*governedProcedure/);
assert.match(routerSrc, /addEvidenceRef:\s*governedProcedure/);
assert.match(routerSrc, /escalateOverdue:\s*governedProcedure/);
assert.match(routerSrc, /permission_set_missing/);
assert.match(routerSrc, /CORRECTION_CASE_DATA_CATEGORY/);
assert.match(routerSrc, /soft-deny/);
assert.match(routerSrc, /loadCorrectionCaseAttachmentPolicy/);
assert.match(routerSrc, /mode:\s*z\.enum\(\["download",\s*"preview"\]\)/);
// Trust suspend (7.4): all governed writes/reads use sensitive:true — writer gate honors suspend.
assert.equal(
  (routerSrc.match(/sensitive:\s*true/g) ?? []).length >= 10,
  true,
);
assert.doesNotMatch(routerSrc, /error\.message(?!Fa)/);

assert.match(pageSrc, /CorrectionCasesPanel/);
assert.match(pageSrc, /assertPageAccess/);
assert.doesNotMatch(pageSrc, /PlaceholderPage/);
assert.match(panelSrc, /correctionCaseHeading/);
assert.match(panelSrc, /correctionCaseBreachedBadge/);
assert.match(panelSrc, /correctionCasePreview/);
assert.match(panelSrc, /correctionCaseAddEvidence/);
assert.match(panelSrc, /correctionCaseCapabilitiesError/);
assert.match(panelSrc, /Skeleton/);
assert.match(panelSrc, /GovernedDataTable/);
assert.doesNotMatch(panelSrc, /PlaceholderPage/);
assert.doesNotMatch(panelSrc, /\bGDPR\b/);
assert.doesNotMatch(panelSrc, /self-service/i);

console.log("correction-case selfcheck: ok");
