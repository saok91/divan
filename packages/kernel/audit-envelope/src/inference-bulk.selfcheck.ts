/**
 * Self-check for InferenceBulkPort (Story 2.7 / FR-48).
 * Run: pnpm --filter @divan/audit-envelope selfcheck:inference-bulk
 *       pnpm selfcheck:inference-bulk
 *
 * DEMO hooks only — AR-ACCESS / AR-REPORTING own production numbers.
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPgPool } from "@divan/db";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

import {
  AuthorizationError,
  DEMO_INFERENCE_BULK_HOOKS,
  DISABLED_INFERENCE_BULK_HOOKS,
  MSG_SUPPRESSED_COHORT_FA,
  clearInferenceBulkWindowsForTests,
  evaluateInferenceBulk,
  loadInferenceBulkHooks,
  recordInferenceBulkAccessEvent,
  setInferenceBulkHooksForTests,
  symmetricDifferenceSize,
  toGovernedRetrievalPayload,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

function resetDemoHooks() {
  clearInferenceBulkWindowsForTests();
  setInferenceBulkHooksForTests({ ...DEMO_INFERENCE_BULK_HOOKS });
}

async function main() {
  resetDemoHooks();

  // --- Fail-closed when hooks disabled ---
  setInferenceBulkHooksForTests({ ...DISABLED_INFERENCE_BULK_HOOKS });
  const disabled = evaluateInferenceBulk({
    channel: "count",
    actorId: "actor:disabled",
    authorizedSubjectIds: ["a", "b", "c", "d"],
  });
  assert.equal(disabled.decision, "deny");
  assert.equal(disabled.reason, "inference_bulk_hooks_disabled");
  resetDemoHooks();

  // --- True empty ≠ suppress ---
  const empty = evaluateInferenceBulk({
    channel: "count",
    actorId: "actor:empty",
    authorizedSubjectIds: [],
  });
  assert.equal(empty.decision, "empty");
  assert.equal(empty.outcome, "empty");
  const emptyPayload = toGovernedRetrievalPayload(empty, []);
  assert.equal(emptyPayload.outcome, "empty");
  assert.equal(emptyPayload.volume, 0);

  // --- Small cohort → suppress (not 0) ---
  const small = evaluateInferenceBulk({
    channel: "count",
    actorId: "actor:small",
    authorizedSubjectIds: ["p1", "p2"],
  });
  assert.equal(small.decision, "suppress");
  assert.equal(small.messageFa, MSG_SUPPRESSED_COHORT_FA);
  const suppressPayload = toGovernedRetrievalPayload(small, ["p1", "p2"]);
  assert.equal(suppressPayload.outcome, "suppressed");
  assert.equal(suppressPayload.volume, null);
  assert.equal(suppressPayload.subjectIds, null);
  assert.notEqual(suppressPayload.volume, 0);

  // --- Same suppress treatment shape for export channel ---
  const smallExport = evaluateInferenceBulk({
    channel: "export",
    actorId: "actor:small-export",
    authorizedSubjectIds: ["p1", "p2"],
  });
  assert.equal(smallExport.decision, "suppress");
  assert.equal(smallExport.messageFa, MSG_SUPPRESSED_COHORT_FA);

  // --- Allow when at/above cohort and below bulk threshold ---
  const allowed = evaluateInferenceBulk({
    channel: "dashboard",
    actorId: "actor:allow",
    authorizedSubjectIds: ["a", "b", "c"],
    bulkApprovalPresent: true,
  });
  assert.equal(allowed.decision, "allow");
  assert.equal(allowed.volumeAuthorized, 3);

  // Count vs list same plane
  const listOk = evaluateInferenceBulk({
    channel: "list",
    actorId: "actor:list",
    authorizedSubjectIds: ["a", "b", "c"],
    bulkApprovalPresent: true,
    recordFingerprint: false,
  });
  assert.equal(listOk.decision, "allow");

  // --- Differencing: Q1, Q2 each ≥ threshold but |Δ| < threshold ---
  assert.equal(
    symmetricDifferenceSize(["a", "b", "c"], ["a", "b", "d"]),
    2,
  );
  clearInferenceBulkWindowsForTests();
  const q1 = evaluateInferenceBulk({
    channel: "report",
    actorId: "actor:diff",
    authorizedSubjectIds: ["a", "b", "c"],
    bulkApprovalPresent: true,
  });
  assert.equal(q1.decision, "allow");
  const q2 = evaluateInferenceBulk({
    channel: "report",
    actorId: "actor:diff",
    authorizedSubjectIds: ["a", "b", "d"],
    bulkApprovalPresent: true,
  });
  assert.equal(q2.decision, "suppress");
  assert.equal(q2.reason, "differencing_isolation");

  // --- Volume per request overrun ---
  clearInferenceBulkWindowsForTests();
  const ids = Array.from({ length: 11 }, (_, i) => `v${i}`);
  const volReq = evaluateInferenceBulk({
    channel: "search",
    actorId: "actor:vol-req",
    authorizedSubjectIds: ids,
    bulkApprovalPresent: true,
  });
  assert.equal(volReq.decision, "deny");
  assert.equal(volReq.reason, "max_volume_per_request");

  // --- Volume window overrun ---
  clearInferenceBulkWindowsForTests();
  setInferenceBulkHooksForTests({
    ...DEMO_INFERENCE_BULK_HOOKS,
    maxVolumePerRequest: 10,
    maxVolumePerWindow: 5,
    bulkApprovalVolumeThreshold: 100,
  });
  const w1 = evaluateInferenceBulk({
    channel: "count",
    actorId: "actor:vol-win",
    authorizedSubjectIds: ["a", "b", "c"],
    bulkApprovalPresent: true,
  });
  assert.equal(w1.decision, "allow");
  const w2 = evaluateInferenceBulk({
    channel: "count",
    actorId: "actor:vol-win",
    authorizedSubjectIds: ["d", "e", "f"],
    bulkApprovalPresent: true,
  });
  assert.equal(w2.decision, "deny");
  assert.equal(w2.reason, "max_volume_per_window");
  resetDemoHooks();

  // --- Field cumulative without bulk approval ---
  clearInferenceBulkWindowsForTests();
  setInferenceBulkHooksForTests({
    ...DEMO_INFERENCE_BULK_HOOKS,
    maxFieldCumulative: 2,
    bulkApprovalVolumeThreshold: 100,
  });
  const f1 = evaluateInferenceBulk({
    channel: "export",
    actorId: "actor:fields",
    authorizedSubjectIds: ["a", "b", "c"],
    fields: ["f1", "f2", "f3"],
    bulkApprovalPresent: false,
  });
  assert.equal(f1.decision, "require_bulk_approval");
  const f2 = evaluateInferenceBulk({
    channel: "export",
    actorId: "actor:fields-ok",
    authorizedSubjectIds: ["a", "b", "c"],
    fields: ["f1", "f2", "f3"],
    bulkApprovalPresent: true,
  });
  assert.equal(f2.decision, "allow");
  resetDemoHooks();

  // --- Bulk/sensitive without approval ---
  clearInferenceBulkWindowsForTests();
  const needBulk = evaluateInferenceBulk({
    channel: "dashboard",
    actorId: "actor:bulk",
    authorizedSubjectIds: ["a", "b", "c", "d", "e"],
    bulkApprovalPresent: false,
  });
  assert.equal(needBulk.decision, "require_bulk_approval");

  const withBulk = evaluateInferenceBulk({
    channel: "dashboard",
    actorId: "actor:bulk-ok",
    authorizedSubjectIds: ["a", "b", "c", "d", "e"],
    bulkApprovalPresent: true,
  });
  assert.equal(withBulk.decision, "allow");

  // Sensitive aggregate without approval
  const sens = evaluateInferenceBulk({
    channel: "report",
    actorId: "actor:sens",
    authorizedSubjectIds: ["a", "b", "c"],
    sensitivity: true,
    bulkApprovalPresent: false,
  });
  assert.equal(sens.decision, "require_bulk_approval");

  // --- Identity channels exempt from cohort (profile/timeline single-subject OK) ---
  const profileOne = evaluateInferenceBulk({
    channel: "profile",
    actorId: "actor:profile",
    purpose: "break_glass",
    authorizedSubjectIds: ["only-one"],
    bulkApprovalPresent: true,
  });
  assert.equal(profileOne.decision, "allow");

  // --- BG cannot bypass aggregate cohort / volume (count still suppresses) ---
  const bgAgg = evaluateInferenceBulk({
    channel: "count",
    actorId: "actor:bg-agg",
    purpose: "break_glass",
    authorizedSubjectIds: ["only-one"],
    bulkApprovalPresent: true,
  });
  assert.equal(bgAgg.decision, "suppress");
  assert.equal(bgAgg.reason, "minimum_cohort_size");

  // BG cannot bypass volume window either
  clearInferenceBulkWindowsForTests();
  setInferenceBulkHooksForTests({
    ...DEMO_INFERENCE_BULK_HOOKS,
    maxVolumePerRequest: 10,
    maxVolumePerWindow: 2,
    bulkApprovalVolumeThreshold: 100,
  });
  const bgVol = evaluateInferenceBulk({
    channel: "profile",
    actorId: "actor:bg-vol",
    purpose: "break_glass",
    authorizedSubjectIds: ["a", "b", "c"],
    bulkApprovalPresent: true,
  });
  assert.equal(bgVol.decision, "deny");
  assert.equal(bgVol.reason, "max_volume_per_window");
  resetDemoHooks();

  // --- Duplicate subject ids do not pad cohort ---
  const padded = evaluateInferenceBulk({
    channel: "count",
    actorId: "actor:pad",
    authorizedSubjectIds: ["a", "a", "a"],
    bulkApprovalPresent: true,
  });
  assert.equal(padded.decision, "suppress");
  assert.equal(padded.volumeAuthorized, 1);

  // --- Non-allow decisions still charge volume window ---
  clearInferenceBulkWindowsForTests();
  setInferenceBulkHooksForTests({
    ...DEMO_INFERENCE_BULK_HOOKS,
    maxVolumePerRequest: 10,
    maxVolumePerWindow: 4,
    bulkApprovalVolumeThreshold: 100,
  });
  const charge1 = evaluateInferenceBulk({
    channel: "count",
    actorId: "actor:charge",
    authorizedSubjectIds: ["p1", "p2"],
    bulkApprovalPresent: true,
  });
  assert.equal(charge1.decision, "suppress");
  const charge2 = evaluateInferenceBulk({
    channel: "count",
    actorId: "actor:charge",
    authorizedSubjectIds: ["a", "b", "c"],
    bulkApprovalPresent: true,
  });
  assert.equal(charge2.decision, "deny");
  assert.equal(charge2.reason, "max_volume_per_window");
  resetDemoHooks();

  // --- Drill-down parent_suppressed oracle (kernel contract) ---
  // Parent aggregate below cohort → suppress; child must not be treated as allow.
  const parentSuppressed = evaluateInferenceBulk({
    channel: "search",
    actorId: "actor:drill",
    authorizedSubjectIds: ["p1", "p2"],
    bulkApprovalPresent: true,
    recordFingerprint: false,
  });
  assert.equal(parentSuppressed.decision, "suppress");
  assert.equal(parentSuppressed.reason, "minimum_cohort_size");
  const parentPayload = toGovernedRetrievalPayload(parentSuppressed, []);
  assert.equal(parentPayload.outcome, "suppressed");
  assert.equal(parentPayload.subjectIds, null);
  // Child alone would also suppress on search (not identity channel)
  const childAlone = evaluateInferenceBulk({
    channel: "search",
    actorId: "actor:drill-child",
    authorizedSubjectIds: ["p1"],
    bulkApprovalPresent: true,
  });
  assert.equal(childAlone.decision, "suppress");
  assert.notEqual(childAlone.decision, "allow");

  // --- Payload distinction empty vs suppress ---
  assert.notEqual(
    toGovernedRetrievalPayload(empty, []).outcome,
    toGovernedRetrievalPayload(small, ["p1", "p2"]).outcome,
  );

  // --- Access evidence with volume + outcome; append failure path ---
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required for evidence probe");
  const pool = createPgPool(url);
  try {
    const correlationId = randomUUID();
    const recorded = await recordInferenceBulkAccessEvent({
      pool,
      correlationId,
      actorAccountId: "account:selfcheck-inference",
      operation: "selfcheck.inference_bulk",
      channel: "count",
      purpose: "selfcheck",
      organizationalScope: "org:selfcheck",
      evaluation: small,
    });
    assert.ok(recorded.decisionId);

    // Simulate append failure via closed pool
    await pool.end();
    await assert.rejects(
      () =>
        recordInferenceBulkAccessEvent({
          pool,
          correlationId: randomUUID(),
          actorAccountId: "account:selfcheck-inference",
          operation: "selfcheck.inference_bulk.fail",
          channel: "count",
          evaluation: small,
        }),
      (err: unknown) =>
        err instanceof AuthorizationError &&
        err.code === "AUDIT_APPEND_FAILED",
    );
  } finally {
    try {
      await pool.end();
    } catch {
      /* already ended */
    }
  }

  // loadInferenceBulkHooks production fail-closed
  const prodHooks = loadInferenceBulkHooks({
    NODE_ENV: "production",
  } as NodeJS.ProcessEnv);
  assert.equal(prodHooks.enabled, false);

  const demoFlag = loadInferenceBulkHooks({
    NODE_ENV: "production",
    AUDIT_INFERENCE_BULK_ENABLED: "true",
  } as NodeJS.ProcessEnv);
  assert.equal(demoFlag.enabled, true);

  setInferenceBulkHooksForTests(null);
  clearInferenceBulkWindowsForTests();

  console.log("inference-bulk.selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
