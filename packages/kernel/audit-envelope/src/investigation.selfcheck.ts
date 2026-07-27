/**
 * Self-check for audit investigation domain helpers (Story 7.1).
 * Run: pnpm --filter @divan/audit-envelope selfcheck:investigation
 */
import assert from "node:assert/strict";

import {
  AUDIT_EVIDENCE_DATA_CATEGORY,
  AUDIT_INVESTIGATE_PERMISSION,
  AuditInvestigationError,
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  MSG_AUDIT_EMPTY_FILTER_FA,
  MSG_AUDIT_SELF_REVIEW_BLOCKED_FA,
  assertAuditEvidenceSelfReviewAllowed,
  buildAuditInvestigationHonesty,
  evaluateAuthorization,
  isCategoryGrantable,
  isExportArtifactEvidence,
  isMigrationRelatedEvidence,
} from "./index";

function main() {
  assert.equal(MSG_AUDIT_EMPTY_FILTER_FA, "رویدادی با این فیلتر نیست.");

  assert.equal(
    isCategoryGrantable(DEV_DEMO_CATEGORIES, AUDIT_EVIDENCE_DATA_CATEGORY),
    true,
  );

  const allow = evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
    permission: AUDIT_INVESTIGATE_PERMISSION,
    dataCategory: AUDIT_EVIDENCE_DATA_CATEGORY,
    action: "read",
    organizationalScope: "org:selfcheck",
  });
  assert.equal(allow, "allow");

  const denyWrongAction = evaluateAuthorization(
    DEV_DEMO_POLICY,
    DEV_DEMO_CATEGORIES,
    {
      permission: AUDIT_INVESTIGATE_PERMISSION,
      dataCategory: AUDIT_EVIDENCE_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
    },
  );
  assert.equal(denyWrongAction, "deny");

  assert.equal(
    isMigrationRelatedEvidence({
      operation: "migration.reconcile.run",
      entityType: "migration_batch",
    }),
    true,
  );
  assert.equal(
    isMigrationRelatedEvidence({
      operation: "demo.selfcheck.read",
      entityType: null,
    }),
    false,
  );

  assert.equal(
    isExportArtifactEvidence({
      entityType: "export_artifact",
      entityId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    }),
    true,
  );
  assert.equal(
    isExportArtifactEvidence({
      entityType: "export_artifact",
      entityId: "not-a-uuid",
    }),
    false,
  );
  assert.equal(
    isExportArtifactEvidence({ entityType: "person", entityId: "x" }),
    false,
  );

  assert.doesNotThrow(() =>
    assertAuditEvidenceSelfReviewAllowed({
      reviewerAccountId: "reviewer-1",
      subjectAccountId: "actor-2",
      requesterAccountId: "actor-3",
    }),
  );

  assert.throws(
    () =>
      assertAuditEvidenceSelfReviewAllowed({
        reviewerAccountId: "reviewer-1",
      }),
    (err: unknown) =>
      err instanceof AuditInvestigationError &&
      err.code === "AUDIT_SELF_REVIEW_BLOCKED" &&
      err.details?.reason === "missing_toxic_party",
  );

  assert.throws(
    () =>
      assertAuditEvidenceSelfReviewAllowed({
        reviewerAccountId: "same-actor",
        subjectAccountId: "same-actor",
      }),
    (err: unknown) =>
      err instanceof AuditInvestigationError &&
      err.code === "AUDIT_SELF_REVIEW_BLOCKED" &&
      err.messageFa === MSG_AUDIT_SELF_REVIEW_BLOCKED_FA,
  );

  const honesty = buildAuditInvestigationHonesty({
    populationDisclosureFa: "fixture disclosure",
  });
  assert.ok(honesty.migrationEvidenceHonestyFa.length >= 2);
  assert.ok(honesty.authAttemptNotPrimarySoTFa.length > 10);
  assert.equal(honesty.populationDisclosureFa, "fixture disclosure");

  console.log("investigation selfcheck: ok");
}

main();
