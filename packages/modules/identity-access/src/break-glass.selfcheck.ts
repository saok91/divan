/**
 * Break-glass privileged access selfcheck (Story 2.5 / FR-46).
 * Run: pnpm --filter @divan/identity-access selfcheck:break-glass
 * Requires DATABASE_URL, migrated schema, and seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  ACCESS_ADMINISTRATION_PERMISSION,
  AccessAdminError,
  activateGrant,
  applyExpiryFailSafe,
  applyProtectedEntryFailSafes,
  approveGrant,
  assertActorHasAccessAdministration,
  assertActorHasBreakGlassPrivilegedRead,
  assertBreakGlassElevationLimits,
  completeBreakGlassPostUseReview,
  getActiveBreakGlassForAccount,
  getIdentityDb,
  getSessionContext,
  MSG_BREAK_GLASS_ADMIN_DENIED_FA,
  MSG_BREAK_GLASS_EXPORT_DENIED_FA,
  MSG_BREAK_GLASS_INCIDENT_REQUIRED_FA,
  MSG_BREAK_GLASS_REVIEW_TOXIC_FA,
  MSG_BREAK_GLASS_SELF_REQUEST_FA,
  MSG_BREAK_GLASS_ROLE_LIFECYCLE_ONLY_FA,
  requestBreakGlassGrant,
  requestGrant,
  revokeGrant,
  SEED_BREAK_GLASS,
  seedAccessAdministrationFixtures,
  seedBreakGlassFixtures,
  setBreakGlassHooksForTests,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

function actor(accountId: string) {
  return { accountId, correlationId: randomUUID() };
}

async function main() {
  const db = getIdentityDb();
  const createdGrantIds: string[] = [];

  try {
    await seedAccessAdministrationFixtures(db);
    await seedBreakGlassFixtures(db);
    setBreakGlassHooksForTests(null);

    const hrAdmin = await db.internalAccount.findUniqueOrThrow({
      where: { username: "hr.admin" },
    });
    const hrOperator = await db.internalAccount.findUniqueOrThrow({
      where: { username: "hr.operator" },
    });
    const sysAdmin = await db.internalAccount.findUniqueOrThrow({
      where: { username: "sys.admin" },
    });
    const auditReviewer = await db.internalAccount.findUniqueOrThrow({
      where: { username: "audit.reviewer" },
    });

    // Dual-admin: bind access_admin to sys.admin for independent approve
    const accessAdminRole = await db.accessRole.findUniqueOrThrow({
      where: { code: "access_admin" },
    });
    await db.accountAccessRole.upsert({
      where: {
        accountId_accessRoleId: {
          accountId: sysAdmin.id,
          accessRoleId: accessAdminRole.id,
        },
      },
      create: {
        accountId: sysAdmin.id,
        accessRoleId: accessAdminRole.id,
      },
      update: {},
    });
    await db.accountAccessRole.upsert({
      where: {
        accountId_accessRoleId: {
          accountId: auditReviewer.id,
          accessRoleId: accessAdminRole.id,
        },
      },
      create: {
        accountId: auditReviewer.id,
        accessRoleId: accessAdminRole.id,
      },
      update: {},
    });

    const bgRole = await db.accessRole.findUniqueOrThrow({
      where: { code: SEED_BREAK_GLASS.roleCode },
    });

    // --- Validation: missing incident / purpose / expiresAt ---
    await assert.rejects(
      () =>
        requestGrant(
          {
            subjectAccountId: hrOperator.id,
            kind: "break_glass",
            accessRoleId: bgRole.id,
            expiresAt: new Date(Date.now() + 60_000),
          },
          actor(hrAdmin.id),
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_BREAK_GLASS_INCIDENT_REQUIRED_FA);
        return true;
      },
    );

    await assert.rejects(
      () =>
        requestBreakGlassGrant(
          {
            subjectAccountId: hrOperator.id,
            incidentId: "INC-1",
            purpose: "selfcheck",
            expiresAt: new Date(Date.now() + 60_000),
          },
          actor(hrOperator.id),
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_BREAK_GLASS_SELF_REQUEST_FA);
        return true;
      },
    );

    // Privileged read without grant → deny
    await assert.rejects(
      () => assertActorHasBreakGlassPrivilegedRead(hrOperator.id, db),
      AccessAdminError,
    );

    // --- Happy path: request → independent approve → activate ---
    const requested = await requestBreakGlassGrant(
      {
        subjectAccountId: hrOperator.id,
        incidentId: "INC-SELFCHECK-25",
        purpose: "selfcheck elevation",
        expiresAt: new Date(Date.now() + 120_000),
      },
      actor(hrAdmin.id),
      db,
    );
    createdGrantIds.push(requested.entity.id);
    assert.equal(requested.entity.kind, "break_glass");
    assert.equal(requested.entity.status, "requested");
    assert.equal(requested.entity.incidentId, "INC-SELFCHECK-25");
    assert.equal(requested.entity.postUseReviewStatus, "pending");
    assert.ok(requested.entity.expiresAt);

    // Self-approve blocked
    await assert.rejects(
      () =>
        approveGrant(
          { grantId: requested.entity.id },
          actor(hrAdmin.id),
          db,
        ),
      AccessAdminError,
    );

    const approved = await approveGrant(
      { grantId: requested.entity.id },
      actor(sysAdmin.id),
      db,
    );
    assert.equal(approved.entity.status, "approved");

    const activated = await activateGrant(
      { grantId: requested.entity.id },
      actor(sysAdmin.id),
      db,
    );
    assert.equal(activated.entity.status, "active");

    const binding = await db.accountAccessRole.findUnique({
      where: {
        accountId_accessRoleId: {
          accountId: hrOperator.id,
          accessRoleId: bgRole.id,
        },
      },
    });
    assert.ok(binding, "minimal HR-read binding applied");

    // Banner hydration
    const bg = await getActiveBreakGlassForAccount(hrOperator.id, db);
    assert.equal(bg.active, true);
    if (bg.active) {
      assert.ok(bg.expiresAt);
      assert.equal(bg.incidentId, "INC-SELFCHECK-25");
      assert.equal(bg.grantId, requested.entity.id);
    }

    const session = await getSessionContext(hrOperator.id, db);
    assert.ok(session);
    assert.equal(session!.breakGlass.active, true);
    assert.ok(session!.breakGlass.expiresAt);

    // Privileged read allowed under elevation
    await assertActorHasBreakGlassPrivilegedRead(hrOperator.id, db);

    // Export / access-admin denied under active break-glass
    await assert.rejects(
      () => assertBreakGlassElevationLimits(hrOperator.id, "export", db),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_BREAK_GLASS_EXPORT_DENIED_FA);
        return true;
      },
    );
    await assert.rejects(
      () =>
        assertBreakGlassElevationLimits(
          hrOperator.id,
          "access.administration",
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_BREAK_GLASS_ADMIN_DENIED_FA);
        return true;
      },
    );

    // Reject elevation that includes access.administration
    const adminSet = await db.permissionSet.findFirstOrThrow({
      where: { permissions: { has: ACCESS_ADMINISTRATION_PERMISSION } },
    });
    const badRole = await db.accessRole.create({
      data: {
        code: `bg_bad_${randomUUID().slice(0, 8)}`,
        labelFa: "نقش بد",
        permissionSetId: adminSet.id,
      },
    });
    await assert.rejects(
      () =>
        requestBreakGlassGrant(
          {
            subjectAccountId: hrOperator.id,
            incidentId: "INC-BAD",
            purpose: "should fail",
            expiresAt: new Date(Date.now() + 60_000),
            accessRoleId: badRole.id,
          },
          actor(hrAdmin.id),
          db,
        ),
      AccessAdminError,
    );
    await db.accessRole.delete({ where: { id: badRole.id } });

    // Self-review blocked (subject / requester / approver)
    await assert.rejects(
      () =>
        completeBreakGlassPostUseReview(
          { grantId: requested.entity.id },
          actor(hrOperator.id),
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_BREAK_GLASS_REVIEW_TOXIC_FA);
        return true;
      },
    );
    await assert.rejects(
      () =>
        completeBreakGlassPostUseReview(
          { grantId: requested.entity.id },
          actor(hrAdmin.id),
          db,
        ),
      AccessAdminError,
    );
    await assert.rejects(
      () =>
        completeBreakGlassPostUseReview(
          { grantId: requested.entity.id },
          actor(sysAdmin.id),
          db,
        ),
      AccessAdminError,
    );

    // Independent post-use review
    const reviewed = await completeBreakGlassPostUseReview(
      { grantId: requested.entity.id },
      actor(auditReviewer.id),
      db,
    );
    assert.equal(reviewed.entity.postUseReviewStatus, "completed");
    assert.equal(reviewed.entity.postUseReviewerAccountId, auditReviewer.id);

    // Expire → elevation gone; banner not live
    await db.entitlementGrant.update({
      where: { id: requested.entity.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await applyExpiryFailSafe(new Date(), db, hrOperator.id);
    assert.ok(expired.some((r) => r.entity.id === requested.entity.id));

    const bgAfter = await getActiveBreakGlassForAccount(hrOperator.id, db);
    assert.equal(bgAfter.active, false);

    await assert.rejects(
      () => assertActorHasBreakGlassPrivilegedRead(hrOperator.id, db),
      AccessAdminError,
    );

    // Second grant: revoke path
    const g2 = await requestBreakGlassGrant(
      {
        subjectAccountId: hrOperator.id,
        incidentId: "INC-REVOKE",
        purpose: "revoke path",
        expiresAt: new Date(Date.now() + 120_000),
      },
      actor(hrAdmin.id),
      db,
    );
    createdGrantIds.push(g2.entity.id);
    await approveGrant({ grantId: g2.entity.id }, actor(sysAdmin.id), db);
    await activateGrant({ grantId: g2.entity.id }, actor(sysAdmin.id), db);
    await revokeGrant(
      { grantId: g2.entity.id, reason: "selfcheck_revoke" },
      actor(sysAdmin.id),
      db,
    );
    await applyProtectedEntryFailSafes(hrOperator.id, new Date(), db);
    const sessionRevoked = await getSessionContext(hrOperator.id, db);
    assert.equal(sessionRevoked!.breakGlass.active, false);
    await assert.rejects(
      () => assertActorHasBreakGlassPrivilegedRead(hrOperator.id, db),
      AccessAdminError,
    );

    // Ordinary standard must not bind break-glass elevation role
    await assert.rejects(
      () =>
        requestGrant(
          {
            subjectAccountId: hrOperator.id,
            kind: "standard",
            accessRoleId: bgRole.id,
          },
          actor(hrAdmin.id),
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_BREAK_GLASS_ROLE_LIFECYCLE_ONLY_FA);
        return true;
      },
    );

    // Standing access.administration still works when no active BG on actor
    await assertActorHasAccessAdministration(hrAdmin.id, db);

    console.log("break-glass.selfcheck: OK");
  } finally {
    setBreakGlassHooksForTests(null);
    for (const id of createdGrantIds) {
      await db.entitlementGrant.delete({ where: { id } }).catch(() => undefined);
    }
  }
}

main().catch((err) => {
  console.error("break-glass.selfcheck FAILED", err);
  process.exitCode = 1;
});
