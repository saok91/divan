/**
 * Entitlement lifecycle selfcheck (Story 2.4 / FR-46).
 * Run: pnpm --filter @divan/identity-access selfcheck:entitlement-lifecycle
 * Requires DATABASE_URL, migrated schema, and seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  AccessAdminError,
  activateGrant,
  applyExpiryFailSafe,
  applyOverdueRecertificationFailSafe,
  applyProtectedEntryFailSafes,
  approveGrant,
  assertActorHasAccessAdministration,
  getIdentityDb,
  getSessionContext,
  listGrants,
  MSG_GRANT_INDEPENDENT_APPROVER_FA,
  MSG_GRANT_SELF_REQUEST_FA,
  MSG_LIFECYCLE_APPROVAL_REQUIRED_FA,
  MSG_TOXIC_COMBINATION_FA,
  MSG_TOXIC_OWN_GRANT_FA,
  previewApproveGrant,
  reauthorizeForQueuedOrArtifactWork,
  requestGrant,
  revokeGrant,
  seedAccessAdministrationFixtures,
  setAccountActiveStatus,
  setEntitlementLifecycleHooksForTests,
  setToxicCombinationRegistryForTests,
  waiveGrant,
  recertifyGrant,
  createOrganizationalScope,
  createAccessRole,
  assignAccountAccessRoles,
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
  setToxicCombinationRegistryForTests([]);
  setEntitlementLifecycleHooksForTests(null);

  const db = getIdentityDb();
  await seedAccessAdministrationFixtures(db);

  const hrAdmin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  assert.ok(hrAdmin, "seeded hr.admin required");

  const hrOperator = await db.internalAccount.findUnique({
    where: { username: "hr.operator" },
  });
  assert.ok(hrOperator, "seeded hr.operator required");

  const sysAdmin = await db.internalAccount.findUnique({
    where: { username: "sys.admin" },
  });
  assert.ok(sysAdmin, "seeded sys.admin required");

  const accessRole = await db.accessRole.findFirst({
    where: { code: "access_admin" },
  });
  assert.ok(accessRole);

  // Non-admin role for binding probes (must not imply access.administration)
  const demoSet = await db.permissionSet.upsert({
    where: { name: "demo-grant-lifecycle" },
    create: {
      name: "demo-grant-lifecycle",
      permissions: ["demo.grant.read"],
    },
    update: { permissions: ["demo.grant.read"] },
  });
  const demoRole = await db.accessRole.upsert({
    where: { code: "demo_grant_role" },
    create: {
      code: "demo_grant_role",
      labelFa: "نقش آزمایشی grant",
      permissionSetId: demoSet.id,
    },
    update: {
      labelFa: "نقش آزمایشی grant",
      permissionSetId: demoSet.id,
    },
  });

  // Bind access_admin to sys.admin temporarily for independent approve
  await db.accountAccessRole.upsert({
    where: {
      accountId_accessRoleId: {
        accountId: sysAdmin.id,
        accessRoleId: accessRole.id,
      },
    },
    create: {
      accountId: sysAdmin.id,
      accessRoleId: accessRole.id,
    },
    update: {},
  });

  const createdGrantIds: string[] = [];

  try {
    // Direct create gated
    await assert.rejects(
      () =>
        createOrganizationalScope(
          { labelFa: "باید مسدود شود" },
          actor(hrAdmin.id),
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_LIFECYCLE_APPROVAL_REQUIRED_FA);
        return true;
      },
    );
    await assert.rejects(
      () =>
        createAccessRole(
          {
            code: "blocked",
            labelFa: "مسدود",
            permissionSetId: accessRole.permissionSetId,
          },
          actor(hrAdmin.id),
          db,
        ),
      AccessAdminError,
    );

    // Operator without access.administration binding → deny
    await assert.rejects(
      () => assertActorHasAccessAdministration(hrOperator.id, db),
      AccessAdminError,
    );

    // Self-request sensitive blocked
    await assert.rejects(
      () =>
        requestGrant(
          {
            subjectAccountId: hrAdmin.id,
            kind: "sensitive",
            accessRoleId: demoRole.id,
          },
          actor(hrAdmin.id),
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_GRANT_SELF_REQUEST_FA);
        return true;
      },
    );

    // Request sensitive for operator
    const requested = await requestGrant(
      {
        subjectAccountId: hrOperator.id,
        kind: "sensitive",
        accessRoleId: demoRole.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
      actor(hrAdmin.id),
      db,
    );
    createdGrantIds.push(requested.entity.id);
    assert.equal(requested.entity.status, "requested");
    assert.equal(requested.before, null);

    // Self-approve blocked
    await assert.rejects(
      () => approveGrant({ grantId: requested.entity.id }, actor(hrAdmin.id), db),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_GRANT_INDEPENDENT_APPROVER_FA);
        return true;
      },
    );

    // Admin+approve-same-grant (preview path) blocked when matrix empty
    assert.throws(
      () =>
        previewApproveGrant({
          actorAccountId: hrAdmin.id,
          subjectAccountId: hrOperator.id,
          grantId: requested.entity.id,
          combinesPermissionAdminWithSameGrantApproval: true,
        }),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_TOXIC_COMBINATION_FA);
        return true;
      },
    );

    // Self-waive blocked
    await assert.rejects(
      () => waiveGrant({ grantId: requested.entity.id }, actor(hrAdmin.id), db),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.ok(
          err.messageFa === MSG_TOXIC_OWN_GRANT_FA ||
            err.messageFa === MSG_TOXIC_COMBINATION_FA,
        );
        return true;
      },
    );

    // Independent approve (sys.admin)
    const approved = await approveGrant(
      { grantId: requested.entity.id },
      actor(sysAdmin.id),
      db,
    );
    assert.equal(approved.entity.status, "approved");
    assert.equal(approved.entity.approverAccountId, sysAdmin.id);

    // Activate
    const activated = await activateGrant(
      {
        grantId: requested.entity.id,
        recertifyBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      actor(sysAdmin.id),
      db,
    );
    assert.equal(activated.entity.status, "active");

    const binding = await db.accountAccessRole.findUnique({
      where: {
        accountId_accessRoleId: {
          accountId: hrOperator.id,
          accessRoleId: demoRole.id,
        },
      },
    });
    assert.ok(binding, "activation must apply role binding");

    // Demo role must not unlock access.administration
    await assert.rejects(
      () => assertActorHasAccessAdministration(hrOperator.id, db),
      AccessAdminError,
    );

    // Expiry fail-safe
    await db.entitlementGrant.update({
      where: { id: requested.entity.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await applyExpiryFailSafe(new Date(), db, hrOperator.id);
    assert.ok(expired.length >= 1);
    assert.equal(expired[0]!.entity.status, "expired");

    const bindingAfterExpire = await db.accountAccessRole.findUnique({
      where: {
        accountId_accessRoleId: {
          accountId: hrOperator.id,
          accessRoleId: demoRole.id,
        },
      },
    });
    assert.equal(bindingAfterExpire, null);

    // Recert overdue → suspend (default)
    const g2 = await requestGrant(
      {
        subjectAccountId: hrOperator.id,
        kind: "global",
        accessRoleId: demoRole.id,
      },
      actor(hrAdmin.id),
      db,
    );
    createdGrantIds.push(g2.entity.id);
    await approveGrant({ grantId: g2.entity.id }, actor(sysAdmin.id), db);
    await activateGrant(
      {
        grantId: g2.entity.id,
        recertifyBy: new Date(Date.now() - 1000),
      },
      actor(sysAdmin.id),
      db,
    );
    const overdue = await applyOverdueRecertificationFailSafe(
      new Date(),
      db,
      hrOperator.id,
    );
    assert.ok(overdue.length >= 1);
    assert.equal(overdue[0]!.entity.status, "suspended");

    // Protected entry applies fail-safes
    await applyProtectedEntryFailSafes(hrOperator.id, new Date(), db);

    // Recertify restores (independent actor — not subject, not requester)
    await assert.rejects(
      () =>
        recertifyGrant({ grantId: g2.entity.id }, actor(hrOperator.id), db),
      AccessAdminError,
    );
    await assert.rejects(
      () => recertifyGrant({ grantId: g2.entity.id }, actor(hrAdmin.id), db),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_GRANT_INDEPENDENT_APPROVER_FA);
        return true;
      },
    );
    const recert = await recertifyGrant(
      {
        grantId: g2.entity.id,
        recertifyBy: new Date(Date.now() + 86_400_000),
      },
      actor(sysAdmin.id),
      db,
    );
    assert.equal(recert.entity.status, "active");

    // Privileged role cannot be direct-assigned without lifecycle
    await assert.rejects(
      () =>
        assignAccountAccessRoles(
          { accountId: hrOperator.id, accessRoleIds: [accessRole.id] },
          actor(hrAdmin.id),
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(err.messageFa, MSG_LIFECYCLE_APPROVAL_REQUIRED_FA);
        return true;
      },
    );

    // role_create activate is catalog-only (no subject bind)
    const createReq = await requestGrant(
      {
        subjectAccountId: hrAdmin.id,
        kind: "role_create",
        createPayload: {
          roleCode: `lc_${Date.now().toString(36)}`,
          roleLabelFa: "نقش کاتالوگ",
          permissionSetId: demoSet.id,
        },
      },
      actor(hrAdmin.id),
      db,
    );
    createdGrantIds.push(createReq.entity.id);
    await approveGrant({ grantId: createReq.entity.id }, actor(sysAdmin.id), db);
    const createAct = await activateGrant(
      { grantId: createReq.entity.id },
      actor(sysAdmin.id),
      db,
    );
    assert.equal(createAct.entity.status, "active");
    assert.ok(createAct.entity.accessRoleId);
    const selfBound = await db.accountAccessRole.findUnique({
      where: {
        accountId_accessRoleId: {
          accountId: hrAdmin.id,
          accessRoleId: createAct.entity.accessRoleId!,
        },
      },
    });
    assert.equal(selfBound, null, "role_create must not auto-bind requester");
    await db.accessRole.delete({
      where: { id: createAct.entity.accessRoleId! },
    });

    // Revoke → next session still loads but binding gone
    await revokeGrant(
      { grantId: g2.entity.id, reason: "selfcheck" },
      actor(sysAdmin.id),
      db,
    );
    const afterRevoke = await getGrantOrNull(g2.entity.id);
    assert.equal(afterRevoke?.status, "revoked");

    const reauth = await reauthorizeForQueuedOrArtifactWork(
      {
        accountId: hrOperator.id,
        requiredAccessRoleId: demoRole.id,
      },
      db,
    );
    assert.equal(reauth.allowed, false);
    assert.equal(reauth.reason, "role_binding_missing");

    // Deactivate account → grants revoked
    const g3 = await requestGrant(
      {
        subjectAccountId: hrOperator.id,
        kind: "bulk",
        accessRoleId: demoRole.id,
      },
      actor(hrAdmin.id),
      db,
    );
    createdGrantIds.push(g3.entity.id);
    await approveGrant({ grantId: g3.entity.id }, actor(sysAdmin.id), db);
    await activateGrant({ grantId: g3.entity.id }, actor(sysAdmin.id), db);

    await setAccountActiveStatus(
      { accountId: hrOperator.id, status: "inactive" },
      actor(hrAdmin.id),
      db,
    );
    const afterDisable = await db.entitlementGrant.findUnique({
      where: { id: g3.entity.id },
    });
    assert.equal(afterDisable?.status, "revoked");

    const sessionInactive = await getSessionContext(hrOperator.id, db);
    assert.equal(sessionInactive, null);

    // Restore operator for other selfchecks
    await db.internalAccount.update({
      where: { id: hrOperator.id },
      data: { status: "active" },
    });

    const listed = await listGrants({ subjectAccountId: hrOperator.id }, db);
    assert.ok(listed.length >= 1);

    console.log("entitlement-lifecycle.selfcheck: ok");
  } finally {
    // Cleanup grant rows created in this run
    if (createdGrantIds.length) {
      await db.entitlementGrant.deleteMany({
        where: { id: { in: createdGrantIds } },
      });
    }
    await db.accountAccessRole.deleteMany({
      where: {
        accountId: hrOperator.id,
        accessRoleId: demoRole.id,
      },
    });
    await db.accountAccessRole.deleteMany({
      where: {
        accountId: sysAdmin.id,
        accessRoleId: accessRole.id,
      },
    });
    // Ensure hr.admin still has access_admin binding
    await seedAccessAdministrationFixtures(db);
    setEntitlementLifecycleHooksForTests(null);
    setToxicCombinationRegistryForTests([]);
  }
}

async function getGrantOrNull(id: string) {
  const db = getIdentityDb();
  return db.entitlementGrant.findUnique({ where: { id } });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
