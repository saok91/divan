/**
 * Web retention router selfcheck (Story 7.3).
 * Static source asserts — no DB required.
 * Run: pnpm --filter @divan/web selfcheck:retention
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DATA_LIFECYCLE_DATA_CATEGORY,
  DATA_LIFECYCLE_DISPOSE_PERMISSION,
  DATA_LIFECYCLE_HOLD_PERMISSION,
  DATA_LIFECYCLE_READ_PERMISSION,
  MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
  MSG_LIFECYCLE_DENIED_FA,
  MSG_LIFECYCLE_METADATA_INCOMPLETE_FA,
} from "@divan/audit-envelope";

import { operationalCopy } from "../../lib/operational-copy";

const here = dirname(fileURLToPath(import.meta.url));
const rootSrc = readFileSync(join(here, "root.ts"), "utf8");
const retentionSrc = readFileSync(join(here, "retention.ts"), "utf8");
const exportSrc = readFileSync(join(here, "export-artifact.ts"), "utf8");
const pageSrc = readFileSync(
  join(here, "../../app/(app)/personnel/(tabs)/dictionary/page.tsx"),
  "utf8",
);
const panelSrc = readFileSync(
  join(here, "../../components/personnel/personnel-lifecycle-panel.tsx"),
  "utf8",
);

assert.equal(DATA_LIFECYCLE_READ_PERMISSION, "data.lifecycle.read");
assert.equal(DATA_LIFECYCLE_HOLD_PERMISSION, "data.lifecycle.hold");
assert.equal(DATA_LIFECYCLE_DISPOSE_PERMISSION, "data.lifecycle.dispose");
assert.equal(DATA_LIFECYCLE_DATA_CATEGORY, "data.lifecycle");
assert.equal(operationalCopy.lifecycleDenied, MSG_LIFECYCLE_DENIED_FA);
assert.equal(
  operationalCopy.lifecycleBlockedByHold,
  MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
);
assert.equal(
  operationalCopy.lifecycleMetadataIncomplete,
  MSG_LIFECYCLE_METADATA_INCOMPLETE_FA,
);
assert.ok(
  operationalCopy.lifecycleExportTtlNotRetention.includes("AR-DATA") ||
    operationalCopy.lifecycleExportTtlNotRetention.includes("۴"),
);

assert.match(rootSrc, /retention:\s*retentionRouter/);
assert.match(retentionSrc, /listHolds:\s*governedProcedure/);
assert.match(retentionSrc, /placeHold:\s*governedProcedure/);
assert.match(retentionSrc, /releaseHold:\s*governedProcedure/);
assert.match(retentionSrc, /runDisposal:\s*governedProcedure/);
assert.match(retentionSrc, /reason:\s*z\.string\(\)\.min\(1\)/);
assert.match(retentionSrc, /HOLD_NOT_FOUND/);
assert.match(retentionSrc, /DISPOSAL_SCOPE_INCOMPLETE/);
assert.match(retentionSrc, /getRun:\s*governedProcedure/);
assert.match(retentionSrc, /permission_set_missing/);
assert.match(retentionSrc, /DATA_LIFECYCLE_DATA_CATEGORY/);
assert.doesNotMatch(retentionSrc, /error\.message(?!Fa)/);

assert.match(exportSrc, /dispose:\s*governedProcedure/);
assert.match(exportSrc, /disposeExportArtifact/);
assert.match(exportSrc, /DataLifecycleError/);

assert.match(pageSrc, /PersonnelLifecyclePanel/);
assert.match(panelSrc, /lifecycleHeading/);
assert.match(panelSrc, /lifecycleDisposeSubjectsRequired/);
assert.match(panelSrc, /Skeleton/);
assert.doesNotMatch(panelSrc, /PlaceholderPage/);
assert.doesNotMatch(pageSrc, /\bhealth\b.*category/);

console.log("retention selfcheck: ok");
