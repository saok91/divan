/**
 * Access-administration selfcheck (Story 2.3).
 * Run: pnpm --filter @divan/identity-access selfcheck:access-admin
 * Requires DATABASE_URL, migrated schema, and seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuditEnvelope,
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  MSG_ACCESS_DENIED_FA,
  emptyPolicyRegistry,
} from "@divan/audit-envelope";
import { createPgPool } from "@divan/db";
import { config as loadEnv } from "dotenv";

import {
  ACCESS_ADMINISTRATION_PERMISSION,
  ACCESS_ADMIN_DATA_CATEGORY,
  AccessAdminError,
  assertActorHasAccessAdministration,
  assertToxicCombinationAllowed,
  assignAccountAccessRoles,
  createAccessRole,
  createOrganizationalScope,
  EMPTY_ENTITLEMENTS_COPY_FA,
  getSessionContext,
  getIdentityDb,
  listEntitlements,
  MSG_ACCESS_ADMIN_REQUIRED_FA,
  MSG_ROLE_REQUIRES_PERMISSION_SET_FA,
  MSG_TOXIC_COMBINATION_FA,
  previewApproveGrant,
  seedAccessAdministrationFixtures,
  setAccountActiveStatus,
  setToxicCombinationRegistryForTests,
  toEnvelopeAuthzContext,
  updateAccountLink,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function main() {
  assert.equal(EMPTY_ENTITLEMENTS_COPY_FA, "تخصیص دسترسی‌ای ثبت نشده.");
  assert.equal(MSG_ACCESS_DENIED_FA, "دسترسی ندارید.");

  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getIdentityDb();
  await seedAccessAdministrationFixtures(db);

  const hrAdmin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  assert.ok(hrAdmin, "seeded hr.admin required");

  const session = await getSessionContext(hrAdmin.id);
  assert.ok(session);
  assert.ok(
    session.organizationalScopeIds.length > 0,
    "hr.admin scopes must hydrate from DB bindings",
  );

  // AC #2 — role without permission set rejected (lifecycle gate bypassed for this probe)
  await assert.rejects(
    () =>
      createAccessRole(
        {
          code: "orphan",
          labelFa: "یتیم",
          permissionSetId: "",
          viaLifecycleActivation: true,
        },
        { accountId: hrAdmin.id, correlationId: randomUUID() },
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof AccessAdminError);
      assert.equal(err.messageFa, MSG_ROLE_REQUIRES_PERMISSION_SET_FA);
      return true;
    },
  );

  // Toxic: self-approval blocked when matrix missing
  setToxicCombinationRegistryForTests([]);
  assert.throws(
    () =>
      assertToxicCombinationAllowed({
        actorAccountId: hrAdmin.id,
        subjectAccountId: hrAdmin.id,
        operation: "grant.approve",
      }),
    (err: unknown) => {
      assert.ok(err instanceof AccessAdminError);
      assert.equal(err.code, "TOXIC_COMBINATION");
      assert.equal(err.messageFa, MSG_TOXIC_COMBINATION_FA);
      return true;
    },
  );

  // Toxic: admin+approve-same-grant blocked when matrix missing
  assert.throws(
    () =>
      previewApproveGrant({
        actorAccountId: hrAdmin.id,
        subjectAccountId: "other-account",
        grantId: "g1",
        combinesPermissionAdminWithSameGrantApproval: true,
      }),
    AccessAdminError,
  );

  // Optional non-toxic demo path can be allowed via fixture rule
  setToxicCombinationRegistryForTests([
    { operation: "demo.non_toxic", effect: "allow" },
  ]);
  assert.doesNotThrow(() =>
    assertToxicCombinationAllowed({
      actorAccountId: hrAdmin.id,
      operation: "demo.non_toxic",
    }),
  );
  setToxicCombinationRegistryForTests([]);

  // Self role-assign blocked
  await assert.rejects(
    () =>
      assignAccountAccessRoles(
        { accountId: hrAdmin.id, accessRoleIds: [] },
        { accountId: hrAdmin.id, correlationId: randomUUID() },
        db,
      ),
    AccessAdminError,
  );

  // Self status / link blocked (fail-closed toxic)
  await assert.rejects(
    () =>
      setAccountActiveStatus(
        { accountId: hrAdmin.id, status: "inactive" },
        { accountId: hrAdmin.id, correlationId: randomUUID() },
        db,
      ),
    (err: unknown) => {
      assert.ok(err instanceof AccessAdminError);
      assert.equal(err.code, "TOXIC_COMBINATION");
      return true;
    },
  );

  // Operator without access.administration PermissionSet binding → deny
  const hrOperator = await db.internalAccount.findUnique({
    where: { username: "hr.operator" },
  });
  assert.ok(hrOperator, "seeded hr.operator required");
  await assert.rejects(
    () => assertActorHasAccessAdministration(hrOperator.id, db),
    (err: unknown) => {
      assert.ok(err instanceof AccessAdminError);
      assert.equal(err.messageFa, MSG_ACCESS_ADMIN_REQUIRED_FA);
      return true;
    },
  );

  // Account link never touches passwords — only externalDirectoryId
  const priorLink = hrAdmin.externalDirectoryId;
  try {
    const link = await updateAccountLink(
      { accountId: hrAdmin.id, externalDirectoryId: null },
      { accountId: "actor-other", correlationId: randomUUID() },
      db,
    );
    assert.equal(link.after.externalDirectoryId, null);
    const reloaded = await db.internalAccount.findUnique({
      where: { id: hrAdmin.id },
    });
    assert.ok(reloaded);
    assert.ok(reloaded.passwordHash, "seeded password hash must remain");
  } finally {
    await db.internalAccount.update({
      where: { id: hrAdmin.id },
      data: { externalDirectoryId: priorLink },
    });
  }
  const entitlements = await listEntitlements(db);
  assert.ok(entitlements.length > 0);

  // Envelope: access.administration allow for demo policy; coarse alone never key
  const pool = createPgPool(url);
  try {
    const envelope = createAuditEnvelope({
      pool,
      getPolicy: () => DEV_DEMO_POLICY,
      getCategories: () => DEV_DEMO_CATEGORIES,
    });

    const allowCorr = randomUUID();
    const allowed = await envelope.authorizeOrThrow({
      context: toEnvelopeAuthzContext(session),
      permission: ACCESS_ADMINISTRATION_PERMISSION,
      dataCategory: ACCESS_ADMIN_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:any",
      operation: "access.role.update",
      correlationId: allowCorr,
      sensitive: true,
      payload: { before: { x: 1 }, after: { x: 2 } },
    });
    assert.ok(allowed.decisionId);

    const rows = await pool.query(
      `SELECT result, payload, actor_account_id FROM kernel_events WHERE correlation_id = $1::uuid ORDER BY occurred_at`,
      [allowCorr],
    );
    assert.equal(rows.rows[0]?.result, "allow");
    assert.equal(rows.rows[0]?.actor_account_id, hrAdmin.id);
    assert.equal(rows.rows[0]?.payload?.after?.x, 2);

    // Coarse hr_admin without policy rule → deny
    const denyEnvelope = createAuditEnvelope({
      pool,
      getPolicy: () => emptyPolicyRegistry(),
      getCategories: () => DEV_DEMO_CATEGORIES,
    });
    await assert.rejects(
      () =>
        denyEnvelope.authorizeOrThrow({
          context: toEnvelopeAuthzContext(session),
          permission: ACCESS_ADMINISTRATION_PERMISSION,
          dataCategory: ACCESS_ADMIN_DATA_CATEGORY,
          action: "write",
          organizationalScope: "org:any",
          operation: "access.role.update",
          correlationId: randomUUID(),
          sensitive: true,
        }),
      (err: unknown) => {
        assert.ok(err && typeof err === "object" && "messageFa" in err);
        assert.equal(
          (err as { messageFa: string }).messageFa,
          MSG_ACCESS_DENIED_FA,
        );
        return true;
      },
    );

    // Scope create requires lifecycle approval (FR-46) — direct path gated
    await assert.rejects(
      () =>
        createOrganizationalScope(
          { labelFa: `محدوده خودآزمایی ${Date.now()}` },
          { accountId: hrAdmin.id, correlationId: randomUUID() },
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof AccessAdminError);
        assert.equal(
          err.messageFa,
          "ایجاد نقش/محدوده یا تخصیص حساس نیازمند تأیید مستقل است. از درخواست entitlement استفاده کنید.",
        );
        return true;
      },
    );

    // Lifecycle-approved create still works at module layer
    const scope = await createOrganizationalScope(
      {
        labelFa: `محدوده خودآزمایی ${Date.now()}`,
        viaLifecycleActivation: true,
      },
      { accountId: hrAdmin.id, correlationId: randomUUID() },
      db,
    );
    assert.ok(scope.entity.id);
    assert.equal(scope.before, null);
    assert.ok(scope.after.labelFa);
    await db.organizationalScope.delete({ where: { id: scope.entity.id } });

    console.log("access-admin.selfcheck: ok");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
