/**
 * FR-51 minimum baseline inventory harness (Story 7.4 / AC #5).
 * Inventories coverage hooks for eight families — does not invent a parallel store.
 * Run: pnpm --filter @divan/audit-envelope selfcheck:audit-trust-baseline
 */

import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FR51_BASELINE_FAMILIES,
  type BaselineCoverageRow,
} from "./audit-trust";

/**
 * Inventory of existing envelope / inference / investigation / break-glass /
 * access-admin evidence hooks. Extend when real gaps appear — do not invent
 * parallel audit SoT.
 */
export function buildFr51BaselineInventory(): BaselineCoverageRow[] {
  return [
    {
      family: "highly_sensitive",
      covered: true,
      hookLabel: "authorizeOrThrow + DEV_DEMO sensitive categories / DEMO_SENSITIVE_TUPLE",
      assertsActor: true,
      assertsPurpose: true,
      assertsScope: true,
      assertsVolume: false,
      assertsOutcome: true,
      omitsUnnecessaryValues: true,
      assertsDeniedWhereApplicable: true,
    },
    {
      family: "reveal_unmask",
      covered: true,
      hookLabel: "omitUnauthorizedCategories + category-gated field reveal",
      assertsActor: true,
      assertsPurpose: true,
      assertsScope: true,
      assertsVolume: false,
      assertsOutcome: true,
      omitsUnnecessaryValues: true,
      assertsDeniedWhereApplicable: true,
    },
    {
      family: "bulk_retrieval",
      covered: true,
      hookLabel: "recordInferenceBulkAccessEvent (volume + outcome minimized)",
      assertsActor: true,
      assertsPurpose: true,
      assertsScope: true,
      assertsVolume: true,
      assertsOutcome: true,
      omitsUnnecessaryValues: true,
      assertsDeniedWhereApplicable: true,
    },
    {
      family: "historical_access",
      covered: true,
      hookLabel: "authorizeOrThrow evaluationMode as_of + access event scope",
      assertsActor: true,
      assertsPurpose: true,
      assertsScope: true,
      assertsVolume: false,
      assertsOutcome: true,
      omitsUnnecessaryValues: true,
      assertsDeniedWhereApplicable: true,
    },
    {
      family: "audit_access",
      covered: true,
      hookLabel: "investigation search/retrieve + secondary soft-deny evidence",
      assertsActor: true,
      assertsPurpose: true,
      assertsScope: true,
      assertsVolume: false,
      assertsOutcome: true,
      omitsUnnecessaryValues: true,
      assertsDeniedWhereApplicable: true,
    },
    {
      family: "privileged_reads",
      covered: true,
      hookLabel: "break-glass privileged read elevation + access event",
      assertsActor: true,
      assertsPurpose: true,
      assertsScope: true,
      assertsVolume: false,
      assertsOutcome: true,
      omitsUnnecessaryValues: true,
      assertsDeniedWhereApplicable: true,
    },
    {
      family: "entitlement_changes",
      covered: true,
      hookLabel: "access-admin grant/revoke/recertify evidence paths",
      assertsActor: true,
      assertsPurpose: true,
      assertsScope: true,
      assertsVolume: false,
      assertsOutcome: true,
      omitsUnnecessaryValues: true,
      assertsDeniedWhereApplicable: true,
    },
    {
      family: "break_glass",
      covered: true,
      hookLabel: "break-glass activate/approve + toxic independence evidence",
      assertsActor: true,
      assertsPurpose: true,
      assertsScope: true,
      assertsVolume: false,
      assertsOutcome: true,
      omitsUnnecessaryValues: true,
      assertsDeniedWhereApplicable: true,
    },
  ];
}

export function assertFr51BaselineInventoryComplete(
  rows: BaselineCoverageRow[] = buildFr51BaselineInventory(),
): void {
  assert.equal(rows.length, FR51_BASELINE_FAMILIES.length);
  for (const family of FR51_BASELINE_FAMILIES) {
    const row = rows.find((r) => r.family === family);
    assert.ok(row, `missing baseline family: ${family}`);
    assert.equal(row.covered, true, `family not covered: ${family}`);
    assert.ok(row.hookLabel.trim().length > 0, `empty hookLabel: ${family}`);
    assert.equal(row.assertsActor, true);
    assert.equal(row.assertsPurpose, true);
    assert.equal(row.assertsScope, true);
    assert.equal(row.assertsOutcome, true);
    assert.equal(row.omitsUnnecessaryValues, true);
    assert.equal(
      row.assertsDeniedWhereApplicable,
      true,
      `deny-where-applicable missing: ${family}`,
    );
  }
  const bulk = rows.find((r) => r.family === "bulk_retrieval");
  assert.ok(bulk?.assertsVolume, "bulk_retrieval must assert volume");
  for (const row of rows) {
    if (row.family !== "bulk_retrieval") {
      assert.equal(
        row.assertsVolume,
        false,
        `${row.family}: volume only required for bulk_retrieval in MVP inventory`,
      );
    }
  }
}

function main() {
  assertFr51BaselineInventoryComplete();
  console.log("audit-trust-baseline.selfcheck: ok");
}

const isDirect =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirect) {
  main();
}
