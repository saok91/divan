/**
 * Authoritative evaluation snapshot domain selfcheck (Story 7.8 / FR-56).
 * Pure gates always run; DB paths run when DATABASE_URL is set.
 * Run: pnpm --filter @divan/audit-envelope selfcheck:evaluation-snapshot
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), "../../../.env") });
loadEnv();

import {
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  evaluateAuthorization,
  isCategoryGrantable,
} from "./index";
import {
  EvaluationSnapshotError,
  MSG_EVAL_SNAPSHOT_MISMATCH_FA,
  assertEvaluationFingerprintMatch,
  assertSameEvaluationSnapshot,
  beginEvaluationSnapshot,
  bindOperationToSnapshot,
  computeContentFingerprint,
  getEvaluationSnapshot,
  revalidateEvaluationSnapshot,
  stableStringify,
} from "./evaluation-snapshot";
import {
  EVALUATION_SNAPSHOT_DATA_CATEGORY,
  EVALUATION_SNAPSHOT_MANAGE_PERMISSION,
  EVALUATION_SNAPSHOT_READ_PERMISSION,
} from "./evaluation-snapshot-permissions";

// --- Pure: category + policy ---
assert.equal(
  isCategoryGrantable(DEV_DEMO_CATEGORIES, EVALUATION_SNAPSHOT_DATA_CATEGORY),
  true,
);
assert.equal(isCategoryGrantable(DEV_DEMO_CATEGORIES, "health"), false);

const allowRead = evaluateAuthorization(
  DEV_DEMO_POLICY,
  DEV_DEMO_CATEGORIES,
  {
    permission: EVALUATION_SNAPSHOT_READ_PERMISSION,
    dataCategory: EVALUATION_SNAPSHOT_DATA_CATEGORY,
    action: "read",
    organizationalScope: "org:selfcheck",
  },
);
assert.equal(allowRead, "allow");

const allowManage = evaluateAuthorization(
  DEV_DEMO_POLICY,
  DEV_DEMO_CATEGORIES,
  {
    permission: EVALUATION_SNAPSHOT_MANAGE_PERMISSION,
    dataCategory: EVALUATION_SNAPSHOT_DATA_CATEGORY,
    action: "write",
    organizationalScope: "org:selfcheck",
  },
);
assert.equal(allowManage, "allow");

// --- Pure: hash stability (must match export spirit) ---
const payload = {
  sourceSurface: "report",
  sourceKey: null,
  filters: { a: 1, b: 2 },
  fieldIds: ["z", "a"].sort(),
  asOf: "1404-01-01",
};
const fp1 = computeContentFingerprint(payload);
const fp2 = computeContentFingerprint({
  asOf: "1404-01-01",
  fieldIds: ["a", "z"],
  filters: { b: 2, a: 1 },
  sourceKey: null,
  sourceSurface: "report",
});
assert.equal(fp1, fp2);
assert.equal(fp1.length, 64);
assert.ok(stableStringify({ b: 1, a: 2 }).includes('"a"'));

// --- Pure: assert same / mismatch ---
assert.doesNotThrow(() =>
  assertSameEvaluationSnapshot(
    { id: "1", kind: "export", contentFingerprint: fp1 },
    { id: "1", kind: "export", contentFingerprint: fp1 },
  ),
);
assert.throws(
  () =>
    assertSameEvaluationSnapshot(
      { id: "1", kind: "export", contentFingerprint: fp1 },
      { id: "1", kind: "export", contentFingerprint: "deadbeef" },
    ),
  (err: unknown) =>
    err instanceof EvaluationSnapshotError &&
    err.code === "EVAL_SNAPSHOT_MISMATCH" &&
    err.messageFa === MSG_EVAL_SNAPSHOT_MISMATCH_FA,
);

assert.throws(
  () => assertEvaluationFingerprintMatch(fp1, "tampered"),
  (err: unknown) =>
    err instanceof EvaluationSnapshotError &&
    err.code === "EVAL_SNAPSHOT_MISMATCH",
);

assert.throws(
  () =>
    assertSameEvaluationSnapshot(
      { id: "1", kind: "pagination", contentFingerprint: fp1 },
      { id: "2", kind: "pagination", contentFingerprint: fp1 },
    ),
  (err: unknown) =>
    err instanceof EvaluationSnapshotError &&
    err.code === "EVAL_SNAPSHOT_VERSION_MIX",
);

// --- Pure: TX-local finalize bind (persist:false) ---
{
  const snap = await beginEvaluationSnapshot(null, {
    kind: "finalize",
    persist: false,
    payload: { personId: "p1", asOf: "1404-01-01" },
    attribution: {
      actorAccountId: "actor-1",
      permissionFingerprint: "fp-abc",
      asOf: "1404-01-01",
    },
    correlationId: randomUUID(),
    boundRefs: { personId: "p1" },
  });
  assert.equal(snap.kind, "finalize");
  assert.equal(snap.status, "active");
  assert.ok(snap.contentFingerprint.length === 64);
  const bound = await bindOperationToSnapshot(null, {
    snapshot: snap,
    operationRef: { entityType: "personnel_event", entityId: "e1" },
  });
  assert.equal(bound.operationRef.snapshotId, snap.id);
}

console.log("evaluation-snapshot pure gates: ok");

// --- DB path (optional) ---
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log(
    "evaluation-snapshot DB path: skipped (DATABASE_URL not set)",
  );
  process.exit(0);
}

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: url });

try {
  const probe = await pool.query(
    `SELECT to_regclass('governance.evaluation_snapshot') AS t`,
  );
  if (!probe.rows[0]?.t) {
    console.log(
      "evaluation-snapshot DB path: skipped (table missing — apply 021_*.sql)",
    );
    process.exit(0);
  }

  const correlationId = randomUUID();
  const actor = randomUUID();
  const snap = await beginEvaluationSnapshot(pool, {
    kind: "pagination",
    payload: { channel: "list", normalizedQuery: "", sortKey: "default" },
    attribution: { actorAccountId: actor, asOf: "1404-01-01" },
    correlationId,
    boundRefs: { memberIds: ["a", "b", "c"] },
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });

  const loaded = await getEvaluationSnapshot(pool, snap.id);
  assert.equal(loaded.contentFingerprint, snap.contentFingerprint);

  assert.doesNotThrow(() =>
    assertSameEvaluationSnapshot(snap, loaded),
  );

  const ok = await revalidateEvaluationSnapshot(pool, snap, {
    liveFingerprint: snap.contentFingerprint,
  });
  assert.equal("ok" in ok && ok.ok, true);

  const mismatch = await revalidateEvaluationSnapshot(pool, snap, {
    liveFingerprint: "0".repeat(64),
  });
  assert.equal("ok" in mismatch, false);
  if (!("ok" in mismatch)) {
    assert.equal(mismatch.code, "EVAL_SNAPSHOT_MISMATCH");
  }

  const permChanged = await revalidateEvaluationSnapshot(pool, snap, {
    permissionFingerprint: "other-fp",
  });
  // snap has null permission fingerprint — no change expected
  assert.equal("ok" in permChanged && permChanged.ok, true);

  const withPerm = await beginEvaluationSnapshot(pool, {
    kind: "import_execution",
    payload: { batchId: "b1", rowCount: 2 },
    attribution: {
      actorAccountId: actor,
      permissionFingerprint: "perm-1",
    },
    correlationId: randomUUID(),
    boundRefs: { batchId: "b1", overlapKeys: ["k1"] },
  });
  const permFail = await revalidateEvaluationSnapshot(pool, withPerm, {
    permissionFingerprint: "perm-2",
  });
  assert.equal("ok" in permFail, false);
  if (!("ok" in permFail)) {
    assert.equal(permFail.code, "EVAL_SNAPSHOT_PERMISSION_CHANGED");
  }

  await bindOperationToSnapshot(pool, {
    snapshot: snap,
    operationRef: { entityType: "personnel_list", page: 1 },
    markConsumed: true,
  });

  console.log("evaluation-snapshot DB path: ok");
} catch (err) {
  console.error("evaluation-snapshot DB path failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
