/**
 * Self-check for audit trust fail-safe domain (Story 7.4).
 * Pure domain checks always run; DB paths run when DATABASE_URL is set.
 * Run: pnpm --filter @divan/audit-envelope selfcheck:audit-trust
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPgPool } from "@divan/db";

import {
  AUDIT_TRUST_DATA_CATEGORY,
  AUDIT_TRUST_READ_PERMISSION,
  AUDIT_TRUST_REVIEW_PERMISSION,
  AuditTrustError,
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  MSG_AUDIT_APPEND_FAILED_FA,
  MSG_AUDIT_TRUST_CLEAR_BLOCKED_FA,
  MSG_AUDIT_TRUST_SELF_REVIEW_BLOCKED_FA,
  MSG_AUDIT_TRUST_SUSPENDED_FA,
  assertAuditTrustSelfReviewAllowed,
  assertClearWriterSuspendAllowed,
  auditTrustDtoContainsForbiddenKeys,
  evaluateAuthorization,
  isAuditTrustApiDistinctCode,
  isCategoryGrantable,
  isNonMonotonicOccurredAt,
  loadAuditTrustProvisionalConfig,
  observeClockSkew,
  type AuditTrustState,
} from "./index";
import {
  assertAuditTrustWriterAllowed,
  recordRequiredAppendFailure,
  runIntegrityVerification,
} from "./audit-trust-gate";
import {
  clearWriterSuspend,
  closeTrustIncident,
  getWriterState,
  listTrustIncidents,
  setWriterSuspended,
} from "./audit-trust-repo";
import { assertFr51BaselineInventoryComplete } from "./audit-trust-baseline.selfcheck";

const rootDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../..");
loadEnv({ path: resolve(rootDir, ".env") });

function mainPure() {
  assert.equal(AUDIT_TRUST_READ_PERMISSION, "audit.trust.read");
  assert.equal(AUDIT_TRUST_REVIEW_PERMISSION, "audit.trust.review");
  assert.equal(AUDIT_TRUST_DATA_CATEGORY, "audit.trust");
  assert.equal(isCategoryGrantable(DEV_DEMO_CATEGORIES, "health"), false);
  assert.equal(
    isCategoryGrantable(DEV_DEMO_CATEGORIES, AUDIT_TRUST_DATA_CATEGORY),
    true,
  );

  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: AUDIT_TRUST_READ_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
    }),
    "allow",
  );
  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: AUDIT_TRUST_REVIEW_PERMISSION,
      dataCategory: AUDIT_TRUST_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:selfcheck",
    }),
    "allow",
  );
  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: AUDIT_TRUST_READ_PERMISSION,
      dataCategory: "health",
      action: "read",
      organizationalScope: "org:selfcheck",
    }),
    "deny",
  );

  const cfg = loadAuditTrustProvisionalConfig({});
  assert.ok(cfg.maxClockSkewMs > 0);
  assert.ok(cfg.verificationWindowHours > 0);

  assert.throws(
    () =>
      loadAuditTrustProvisionalConfig({
        DIVAN_AUDIT_TRUST_ENFORCE: "1",
      }),
    (err: unknown) =>
      err instanceof AuditTrustError && err.code === "AUDIT_TRUST_CONFIG_MISSING",
  );

  const okSkew = observeClockSkew({
    appNow: new Date("2026-07-29T00:00:00.000Z"),
    dbNow: new Date("2026-07-29T00:00:30.000Z"),
    maxSkewMs: 120_000,
    correlationId: "c1",
  });
  assert.equal(okSkew.anomalous, false);

  const badSkew = observeClockSkew({
    appNow: new Date("2026-07-29T00:00:00.000Z"),
    dbNow: new Date("2026-07-29T01:00:00.000Z"),
    maxSkewMs: 120_000,
    correlationId: "c2",
  });
  assert.equal(badSkew.anomalous, true);

  assert.throws(
    () =>
      assertAuditTrustSelfReviewAllowed({
        reviewerAccountId: "acct-1",
        subjectAccountId: "acct-1",
        incidentKind: "append_fail",
      }),
    (err: unknown) =>
      err instanceof AuditTrustError &&
      err.code === "AUDIT_TRUST_SELF_REVIEW_BLOCKED" &&
      err.messageFa === MSG_AUDIT_TRUST_SELF_REVIEW_BLOCKED_FA,
  );

  assert.throws(
    () =>
      assertAuditTrustSelfReviewAllowed({
        reviewerAccountId: "acct-1",
        subjectAccountId: "acct-1",
        incidentKind: "clock_anomaly",
      }),
    (err: unknown) =>
      err instanceof AuditTrustError &&
      err.code === "AUDIT_TRUST_SELF_REVIEW_BLOCKED",
  );

  assertAuditTrustSelfReviewAllowed({
    reviewerAccountId: "reviewer",
    subjectAccountId: "other",
    incidentKind: "append_fail",
  });

  assert.equal(
    isNonMonotonicOccurredAt({
      previousOccurredAt: new Date("2026-07-29T00:00:00.000Z"),
      nextOccurredAt: new Date("2026-07-29T00:05:00.000Z"),
      toleranceMs: 120_000,
    }),
    false,
  );
  assert.equal(
    isNonMonotonicOccurredAt({
      previousOccurredAt: new Date("2026-07-29T00:05:00.000Z"),
      nextOccurredAt: new Date("2026-07-29T00:00:00.000Z"),
      toleranceMs: 120_000,
    }),
    true,
  );
  assert.equal(
    isNonMonotonicOccurredAt({
      previousOccurredAt: new Date("invalid"),
      nextOccurredAt: new Date("2026-07-29T00:00:00.000Z"),
      toleranceMs: 120_000,
    }),
    true,
  );

  assert.throws(
    () =>
      assertClearWriterSuspendAllowed({
        status: "suspended",
        clearRequiresReview: true,
        openIncidentCount: 2,
      }),
    (err: unknown) =>
      err instanceof AuditTrustError &&
      err.messageFa === MSG_AUDIT_TRUST_CLEAR_BLOCKED_FA,
  );
  assertClearWriterSuspendAllowed({
    status: "suspended",
    clearRequiresReview: true,
    openIncidentCount: 0,
  });

  assert.equal(isAuditTrustApiDistinctCode("AUDIT_APPEND_FAILED"), true);
  assert.equal(isAuditTrustApiDistinctCode("AUDIT_TRUST_SUSPENDED"), true);
  assert.equal(isAuditTrustApiDistinctCode("FORBIDDEN"), false);
  assert.ok(String(MSG_AUDIT_APPEND_FAILED_FA) !== "دسترسی ندارید.");
  assert.ok(String(MSG_AUDIT_TRUST_SUSPENDED_FA) !== "دسترسی ندارید.");

  const state: AuditTrustState = {
    status: "ok",
    clearRequiresReview: true,
    openIncidentCount: 0,
  };
  assert.equal(auditTrustDtoContainsForbiddenKeys(state), false);
  assert.equal(
    auditTrustDtoContainsForbiddenKeys({ ...state, personId: "leak" }),
    true,
  );

  assertFr51BaselineInventoryComplete();
  console.log("audit-trust.selfcheck (pure): ok");
}

async function mainDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("audit-trust.selfcheck (db): skipped (no DATABASE_URL)");
    return;
  }

  const pool = createPgPool(url);
  try {
    // Ensure schema exists (017 applied)
    await pool.query(`SELECT 1 FROM audit_trust.writer_state LIMIT 1`);
  } catch {
    console.log(
      "audit-trust.selfcheck (db): skipped (audit_trust schema missing — run pnpm db:sql:apply)",
    );
    await pool.end();
    return;
  }

  const correlationId = randomUUID();
  try {
    async function closeOpenAndClear(clearedBy: string): Promise<void> {
      const open = await listTrustIncidents(pool, {
        statusIn: ["open", "assigned", "acknowledged"],
        limit: 200,
      });
      for (const incident of open) {
        await closeTrustIncident(pool, {
          incidentId: incident.id,
          closedBy: clearedBy,
        });
      }
      await clearWriterSuspend(pool, {
        clearedBy,
        correlationId: randomUUID(),
      });
    }

    await closeOpenAndClear("selfcheck");

    await assertAuditTrustWriterAllowed(pool, {
      correlationId,
      permission: "demo.selfcheck.read",
    });

    await setWriterSuspended(pool, {
      reason: "selfcheck_suspend",
      suspendedBy: "selfcheck",
      correlationId,
    });

    await assert.rejects(
      () =>
        assertAuditTrustWriterAllowed(pool, {
          correlationId,
          permission: "demo.selfcheck.read",
        }),
      (err: unknown) =>
        err instanceof AuditTrustError && err.code === "AUDIT_TRUST_SUSPENDED",
    );

    // Control-plane may proceed while suspended (same gate authorizeOrThrow uses)
    await assertAuditTrustWriterAllowed(pool, {
      correlationId,
      permission: AUDIT_TRUST_READ_PERMISSION,
    });

    await closeOpenAndClear("selfcheck");

    await recordRequiredAppendFailure(pool, {
      correlationId: randomUUID(),
      actorAccountId: "selfcheck-actor",
    });
    const afterFail = await getWriterState(pool);
    assert.equal(afterFail.status, "suspended");
    assert.ok((afterFail.openIncidentCount ?? 0) >= 1);

    // Cannot clear while incidents remain open (review required)
    await assert.rejects(
      () =>
        clearWriterSuspend(pool, {
          clearedBy: "selfcheck",
          correlationId: randomUUID(),
        }),
      (err: unknown) =>
        err instanceof AuditTrustError &&
        err.messageFa === MSG_AUDIT_TRUST_CLEAR_BLOCKED_FA,
    );

    await closeOpenAndClear("selfcheck");

    const integrity = await runIntegrityVerification(pool, {
      actorAccountId: "selfcheck",
      correlationId: randomUUID(),
      throwOnFail: false,
    });
    assert.ok(integrity.outcome === "pass" || integrity.outcome === "fail");
    assert.equal(integrity.findings.hashChain, "deferred_not_claimed");
    assert.ok(
      Object.prototype.hasOwnProperty.call(integrity.findings, "sequenceAnomaly"),
    );

    await closeOpenAndClear("selfcheck");

    console.log("audit-trust.selfcheck (db): ok");
  } finally {
    await pool.end();
  }
}

async function main() {
  mainPure();
  await mainDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
