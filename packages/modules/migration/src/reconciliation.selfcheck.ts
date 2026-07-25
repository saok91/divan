/**
 * Reconciliation + production gate selfcheck (Story 6.4 / FR-40 / LG-1).
 * Run: pnpm --filter @divan/migration selfcheck:reconciliation
 *
 * Pure gate matrix always runs. Optional DB path when DATABASE_URL + schema up.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  MSG_SOD_SAME_SIGNER_FA,
  MigrationError,
  assertProductionReconciliationGate,
  assertReconcileSignSegregation,
  buildSyntheticSignedRun,
  computeReconciliationEvidenceHash,
  verifyProductionGateOnRun,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

/** Same-actor dual-sign rejected when segregation on */
let sodThrown = false;
try {
  assertReconcileSignSegregation({
    firstSignerAccountId: "a1",
    secondSignerAccountId: "a1",
    segregationOn: true,
  });
} catch (err) {
  sodThrown = true;
  assert.ok(err instanceof MigrationError);
  assert.equal(err.code, "SOD_VIOLATION");
  assert.equal(err.messageFa, MSG_SOD_SAME_SIGNER_FA);
}
assert.equal(sodThrown, true);

assertReconcileSignSegregation({
  firstSignerAccountId: "a1",
  secondSignerAccountId: "a2",
  segregationOn: true,
});

const batchId = randomUUID();

/** Happy path — dual signatures + matching controls → gate passes */
{
  const run = buildSyntheticSignedRun({ batchId });
  const result = verifyProductionGateOnRun(run, batchId);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.evidenceHash, computeReconciliationEvidenceHash(run));
  }
}

/** Missing run id / empty → deny (mirrors execute without signed run) */
{
  const empty = buildSyntheticSignedRun({ batchId, missingSignature: true });
  empty.status = "in-progress";
  const result = verifyProductionGateOnRun(empty, batchId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "RECONCILIATION_UNSIGNED");
}

/** Open critical → deny */
{
  const run = buildSyntheticSignedRun({ batchId, openCritical: true });
  const result = verifyProductionGateOnRun(run, batchId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "CRITICAL_DEFECT_OPEN");
}

/** Missing required control → deny */
{
  const run = buildSyntheticSignedRun({ batchId, missingControl: true });
  // Recompute hash after missing control so stale isn't the failure mode
  const hash = computeReconciliationEvidenceHash(run);
  run.evidenceHash = hash;
  for (const s of run.signatures) s.evidenceHash = hash;
  const result = verifyProductionGateOnRun(run, batchId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "CONTROL_MISSING");
}

/** Stale hash after control edit without re-sign → deny */
{
  const run = buildSyntheticSignedRun({ batchId, staleHash: true });
  const result = verifyProductionGateOnRun(run, batchId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "RECONCILIATION_STALE");
}

/** Unavailable domain (open) → deny */
{
  const run = buildSyntheticSignedRun({ batchId, unavailableOpen: true });
  const hash = computeReconciliationEvidenceHash(run);
  run.evidenceHash = hash;
  for (const s of run.signatures) s.evidenceHash = hash;
  const result = verifyProductionGateOnRun(run, batchId);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.code === "CRITICAL_DEFECT_OPEN" ||
        result.code === "RECONCILIATION_INCOMPLETE",
    );
  }
}

/** Waived unavailable still hard-blocks production */
{
  const run = buildSyntheticSignedRun({ batchId, waivedUnavailable: true });
  const hash = computeReconciliationEvidenceHash(run);
  run.evidenceHash = hash;
  for (const s of run.signatures) s.evidenceHash = hash;
  const result = verifyProductionGateOnRun(run, batchId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "RECONCILIATION_INCOMPLETE");
}

/** Expired FR-55 waiver → deny */
{
  const run = buildSyntheticSignedRun({ batchId, expiredWaiver: true });
  const hash = computeReconciliationEvidenceHash(run);
  run.evidenceHash = hash;
  for (const s of run.signatures) s.evidenceHash = hash;
  const result = verifyProductionGateOnRun(run, batchId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "RECONCILIATION_STALE");
}

/** Trial tier cannot unlock production */
{
  const run = buildSyntheticSignedRun({ batchId, tier: "trial" });
  const hash = computeReconciliationEvidenceHash(run);
  run.evidenceHash = hash;
  for (const s of run.signatures) s.evidenceHash = hash;
  const result = verifyProductionGateOnRun(run, batchId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "RECONCILIATION_REQUIRED");
}

/** Wrong batch linkage → deny */
{
  const run = buildSyntheticSignedRun({ batchId });
  const result = verifyProductionGateOnRun(run, randomUUID());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "RECONCILIATION_REQUIRED");
}

/** Free-string token rejected by assertProductionReconciliationGate (needs pool mock) */
{
  // Unit: UUID shape rejection without DB
  const fakePool = {
    query: async () => {
      throw new Error("should not query for invalid token");
    },
  } as unknown as import("@divan/db").Pool;

  let rejected = false;
  try {
    await assertProductionReconciliationGate(fakePool, {
      batchId,
      reconciliationRunId: "any-non-empty-token",
    });
  } catch (err) {
    rejected = true;
    assert.ok(err instanceof MigrationError);
    assert.equal(err.code, "RECONCILIATION_UNSIGNED");
  }
  assert.equal(rejected, true);

  let blankRejected = false;
  try {
    await assertProductionReconciliationGate(fakePool, {
      batchId,
      reconciliationRunId: "",
    });
  } catch (err) {
    blankRejected = true;
    assert.ok(err instanceof MigrationError);
    assert.equal(err.code, "RECONCILIATION_REQUIRED");
  }
  assert.equal(blankRejected, true);
}

function isPgUnavailable(err: unknown): boolean {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const msg = err instanceof Error ? err.message : String(err);
  const full = `${code} ${msg} ${String(err)}`;
  return (
    full.includes("ECONNREFUSED") ||
    full.includes("does not exist") ||
    full.includes("reconciliation_run")
  );
}

/** Optional DB smoke — skip honestly when PG down */
async function optionalDbPath(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log(
      "selfcheck:reconciliation DB skip — DATABASE_URL unset (pure gate OK)",
    );
    return;
  }
  try {
    const { createPgPool } = await import("@divan/db");
    const pool = createPgPool(url);
    try {
      await pool.query(
        `SELECT 1 FROM migration_staging.reconciliation_run LIMIT 0`,
      );
    } catch (err) {
      if (isPgUnavailable(err)) {
        console.log(
          "selfcheck:reconciliation DB skip — schema/PG unavailable (pure gate OK)",
        );
        await pool.end().catch(() => undefined);
        return;
      }
      throw err;
    }

    // Empty UUID that does not exist → RECONCILIATION_REQUIRED
    let missing = false;
    try {
      await assertProductionReconciliationGate(pool, {
        batchId: randomUUID(),
        reconciliationRunId: randomUUID(),
      });
    } catch (err) {
      missing = true;
      assert.ok(err instanceof MigrationError);
      assert.equal(err.code, "RECONCILIATION_REQUIRED");
    }
    assert.equal(missing, true);

    await pool.end();
    console.log("selfcheck:reconciliation DB smoke OK");
  } catch (err) {
    if (isPgUnavailable(err)) {
      console.log(
        "selfcheck:reconciliation DB skip — ECONNREFUSED (pure gate OK)",
      );
      return;
    }
    throw err;
  }
}

await optionalDbPath();

console.log("selfcheck:reconciliation OK");
