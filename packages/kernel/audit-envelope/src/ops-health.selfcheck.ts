/**
 * Self-check for ops health domain helpers (Story 7.2).
 * Run: pnpm --filter @divan/audit-envelope selfcheck:ops-health
 */
import assert from "node:assert/strict";

import {
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  MSG_OPS_HEALTH_DENIED_FA,
  OPS_HEALTH_READ_PERMISSION,
  OPS_PLATFORM_DATA_CATEGORY,
  OpsHealthError,
  evaluateAuthorization,
  getBackupEvidenceHook,
  isCategoryGrantable,
  opsHealthDtoContainsForbiddenKeys,
  type OpsHealthSnapshot,
} from "./index";

function main() {
  assert.equal(MSG_OPS_HEALTH_DENIED_FA, "دسترسی ندارید.");
  assert.equal(OPS_HEALTH_READ_PERMISSION, "ops.health.read");
  assert.equal(OPS_PLATFORM_DATA_CATEGORY, "ops.platform");

  // Person health category must remain disabled; ops uses ops.platform.
  assert.equal(isCategoryGrantable(DEV_DEMO_CATEGORIES, "health"), false);
  assert.equal(
    isCategoryGrantable(DEV_DEMO_CATEGORIES, OPS_PLATFORM_DATA_CATEGORY),
    true,
  );

  const allow = evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
    permission: OPS_HEALTH_READ_PERMISSION,
    dataCategory: OPS_PLATFORM_DATA_CATEGORY,
    action: "read",
    organizationalScope: "org:selfcheck",
  });
  assert.equal(allow, "allow");

  const denyWrongAction = evaluateAuthorization(
    DEV_DEMO_POLICY,
    DEV_DEMO_CATEGORIES,
    {
      permission: OPS_HEALTH_READ_PERMISSION,
      dataCategory: OPS_PLATFORM_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
    },
  );
  assert.equal(denyWrongAction, "deny");

  const denyWrongCategory = evaluateAuthorization(
    DEV_DEMO_POLICY,
    DEV_DEMO_CATEGORIES,
    {
      permission: OPS_HEALTH_READ_PERMISSION,
      dataCategory: "health",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
  );
  assert.equal(denyWrongCategory, "deny");

  const snapshot: OpsHealthSnapshot = {
    identity: { status: "not_configured", detailFa: "seeded" },
    service: { status: "ok" },
    recalculation: {
      status: "degraded",
      pendingCount: 1,
      failedCount: 0,
      staleCount: 0,
      correlationId: "recalc:opaque:g1",
    },
    import: { status: "ok", pendingCount: 0, failedCount: 0 },
    backup: { status: "not_configured" },
    dependencies: { status: "degraded" },
    correlationId: "corr-1",
  };
  assert.equal(opsHealthDtoContainsForbiddenKeys(snapshot), false);

  const leaky = {
    ...snapshot,
    recalculation: { ...snapshot.recalculation, personId: "uuid-leak" },
  };
  assert.equal(opsHealthDtoContainsForbiddenKeys(leaky), true);

  const leakyJobKey = {
    ...snapshot,
    recalculation: {
      ...snapshot.recalculation,
      correlationId: "recalc:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:g1",
    },
  };
  assert.equal(opsHealthDtoContainsForbiddenKeys(leakyJobKey), true);

  const denied = new OpsHealthError("OPS_HEALTH_DENIED", MSG_OPS_HEALTH_DENIED_FA);
  assert.equal(denied.messageFa, "دسترسی ندارید.");

  const hookEmpty = getBackupEvidenceHook({});
  assert.equal(hookEmpty.status, "not_configured");

  const hookOk = getBackupEvidenceHook({
    DIVAN_BACKUP_EVIDENCE_AT: "2026-07-01T12:00:00.000Z",
  });
  assert.equal(hookOk.status, "evidence_recorded");
  assert.ok(hookOk.lastEvidenceAt);

  console.log("ops-health selfcheck: ok");
}

main();
