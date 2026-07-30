/**
 * Launch Artifact change-control domain selfcheck (Story 7.7 / FR-55).
 * Pure gates always run; DB paths run when DATABASE_URL is set.
 * Run: pnpm --filter @divan/audit-envelope selfcheck:launch-artifact
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), "../../../.env") });
loadEnv();

import {
  LAUNCH_ARTIFACT_IDS,
  LaunchArtifactError,
  NON_WAIVERABLE_GATE_CODES,
  approveRebaseline,
  approveVersion,
  assertArtifactsUsable,
  assertWaiverAllowed,
  createVersion,
  isLaunchArtifactId,
  isNonWaiverableGate,
  isWaiverExpired,
  issueWaiver,
  listArtifacts,
  openConflict,
  requireRebaseline,
  resolveConflict,
  resolveControllingVersion,
  seedLaunchArtifactRegister,
} from "./launch-artifact";

assert.equal(LAUNCH_ARTIFACT_IDS.length, 11);
assert.ok(isLaunchArtifactId("AR-DATA"));
assert.ok(!isLaunchArtifactId("AR-FAKE"));

for (const code of NON_WAIVERABLE_GATE_CODES) {
  assert.ok(isNonWaiverableGate(code));
}

assert.equal(isWaiverExpired(null), true);
assert.equal(isWaiverExpired(""), true);
assert.equal(isWaiverExpired("not-a-date"), true);
assert.equal(isWaiverExpired("2000-01-01T00:00:00.000Z"), true);
assert.equal(isWaiverExpired("2999-01-01T00:00:00.000Z"), false);

const future = new Date(Date.now() + 86_400_000).toISOString();
const baseWaiver = {
  ownerAccountId: "owner-1",
  independentApproverAccountId: "approver-1",
  requesterAccountId: "requester-1",
  scope: "trial",
  risk: "medium",
  compensatingControls: "manual review",
  expiry: future,
};

assert.doesNotThrow(() => assertWaiverAllowed("metric_tolerance", baseWaiver));

assert.throws(
  () => assertWaiverAllowed("default_deny", baseWaiver),
  (err: unknown) =>
    err instanceof LaunchArtifactError && err.code === "WAIVER_NON_WAIVERABLE",
);

assert.throws(
  () => assertWaiverAllowed("integrity", baseWaiver),
  (err: unknown) =>
    err instanceof LaunchArtifactError && err.code === "WAIVER_NON_WAIVERABLE",
);

assert.throws(
  () =>
    assertWaiverAllowed(null, {
      ...baseWaiver,
      independentApproverAccountId: "owner-1",
    }),
  (err: unknown) =>
    err instanceof LaunchArtifactError &&
    err.code === "WAIVER_APPROVER_NOT_INDEPENDENT",
);

assert.throws(
  () => assertWaiverAllowed(null, { ...baseWaiver, scope: "" }),
  (err: unknown) =>
    err instanceof LaunchArtifactError && err.code === "WAIVER_INVALID",
);

assert.throws(
  () =>
    assertWaiverAllowed(null, {
      ...baseWaiver,
      expiry: "2000-01-01T00:00:00.000Z",
    }),
  (err: unknown) =>
    err instanceof LaunchArtifactError && err.code === "WAIVER_EXPIRED",
);

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.log(
    "launch-artifact selfcheck: pure gates ok (DATABASE_URL unset — skip DB)",
  );
  process.exit(0);
}

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: dbUrl });

try {
  await pool.query("SELECT 1");
} catch {
  await pool.end().catch(() => undefined);
  console.log(
    "launch-artifact selfcheck: pure gates ok (DATABASE unreachable — skip DB)",
  );
  process.exit(0);
}

try {
  await seedLaunchArtifactRegister(pool);
  const artifacts = await listArtifacts(pool);
  assert.equal(artifacts.length, 11);

  const arData = await resolveControllingVersion(pool, "AR-DATA");
  assert.equal(arData.artifactId, "AR-DATA");
  assert.ok(arData.versionLabel.includes("ar-data-partial-freeze"));

  const arReporting = await resolveControllingVersion(pool, "AR-REPORTING");
  assert.ok(arReporting.versionLabel.length > 0);

  const draft = await createVersion(pool, {
    artifactId: "AR-NFR",
    versionLabel: `selfcheck-${randomUUID().slice(0, 8)}`,
    scopeSummary: "selfcheck draft",
    actorAccountId: "selfcheck-actor",
  });
  assert.equal(draft.status, "draft");

  const approved = await approveVersion(pool, {
    versionId: draft.id,
    actorAccountId: "selfcheck-approver",
  });
  assert.equal(approved.status, "approved");

  const waiver = await issueWaiver(pool, {
    artifactId: "AR-SECONDARY",
    targetGateCode: "metric_tolerance",
    waiver: {
      ...baseWaiver,
      requesterAccountId: "selfcheck-actor",
    },
  });
  assert.equal(waiver.status, "open");

  try {
    await issueWaiver(pool, {
      artifactId: "AR-SECONDARY",
      targetGateCode: "default_deny",
      waiver: {
        ...baseWaiver,
        requesterAccountId: "selfcheck-actor",
      },
    });
    assert.fail("expected non-waiverable reject");
  } catch (err) {
    assert.ok(
      err instanceof LaunchArtifactError &&
        err.code === "WAIVER_NON_WAIVERABLE",
    );
  }

  const conflict = await openConflict(pool, {
    artifactIds: ["AR-DATA", "AR-REPORTING"],
    summary: `selfcheck conflict ${randomUUID().slice(0, 8)}`,
    actorAccountId: "selfcheck-actor",
  });
  assert.equal(conflict.status, "open");

  const blocked = await assertArtifactsUsable(pool, [
    "AR-DATA",
    "AR-REPORTING",
  ]);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.code, "CONFLICT_UNRESOLVED");
  }

  await resolveConflict(pool, {
    conflictId: conflict.id,
    resolutionVersionIds: [arData.versionId, arReporting.versionId],
    actorAccountId: "selfcheck-actor",
    jointApproverAccountId: "selfcheck-joint",
  });

  const rebaseline = await requireRebaseline(pool, {
    affectedArtifactIds: ["AR-ACCESS"],
    changeSummary: "selfcheck material change",
    impactAssessment: "impact assessed",
    requiredRegressionRefs: ["acceptance-provisional"],
    buildRef: "selfcheck-build",
    requesterAccountId: "selfcheck-requester",
  });
  assert.equal(rebaseline.status, "required");

  const reblocked = await assertArtifactsUsable(pool, ["AR-ACCESS"]);
  assert.equal(reblocked.ok, false);
  if (!reblocked.ok) {
    assert.equal(reblocked.code, "REBASELINE_REQUIRED");
  }

  const approvedRb = await approveRebaseline(pool, {
    rebaselineId: rebaseline.id,
    independentApproverAccountId: "selfcheck-approver",
    actorAccountId: "selfcheck-actor",
    buildRef: "selfcheck-build-approved",
  });
  assert.equal(approvedRb.status, "approved");
  assert.ok(approvedRb.buildRef);
  assert.ok(approvedRb.controllingVersions.length >= 1);

  const usable = await assertArtifactsUsable(pool, ["AR-DATA"]);
  assert.equal(usable.ok, true);

  console.log("launch-artifact selfcheck: ok");
} finally {
  await pool.end();
}
