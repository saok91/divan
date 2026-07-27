/**
 * Provisional data lifecycle PermissionSet seed (Story 7.3).
 * Lives in identity-access bootstrap to avoid BC inversion.
 * Permission keys imported from `@divan/audit-envelope` — AR-ACCESS pending freeze.
 * Bound to hr.admin until AR-ACCESS freezes a Legal/Privacy coarse role.
 */

import {
  DATA_LIFECYCLE_DISPOSE_PERMISSION,
  DATA_LIFECYCLE_HOLD_PERMISSION,
  DATA_LIFECYCLE_READ_PERMISSION,
} from "@divan/audit-envelope";
import type { PrismaClient } from "@divan/db";

export const SEED_RETENTION_PERMISSIONS = {
  permissionSetName: "data-lifecycle-provisional",
  roleCode: "data_lifecycle_owner_provisional",
  roleLabelFa: "مالک چرخهٔ عمر داده (موقت)",
} as const;

/**
 * Bind provisional data.lifecycle.* permissions to hr.admin.
 * Idempotent. Coarse hr_admin nav alone must not bypass envelope.
 * Does not auto-grant to audit.investigate or ops.health.read (SoD).
 */
export async function seedRetentionPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissions = [
    DATA_LIFECYCLE_READ_PERMISSION,
    DATA_LIFECYCLE_HOLD_PERMISSION,
    DATA_LIFECYCLE_DISPOSE_PERMISSION,
  ];

  const set = await db.permissionSet.upsert({
    where: { name: SEED_RETENTION_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_RETENTION_PERMISSIONS.permissionSetName,
      permissions,
    },
    update: {
      permissions,
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_RETENTION_PERMISSIONS.roleCode },
    create: {
      code: SEED_RETENTION_PERMISSIONS.roleCode,
      labelFa: SEED_RETENTION_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_RETENTION_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
  });

  const admin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  if (!admin) {
    console.warn(
      "[seed-retention] hr.admin account missing — PermissionSet created but unbound",
    );
    return;
  }

  await db.accountAccessRole.upsert({
    where: {
      accountId_accessRoleId: {
        accountId: admin.id,
        accessRoleId: role.id,
      },
    },
    create: {
      accountId: admin.id,
      accessRoleId: role.id,
    },
    update: {},
  });

  // Membership for DEV_DEMO_POLICY organizationalScope org:selfcheck.
  let scope = await db.organizationalScope.findFirst({
    where: { code: "org:selfcheck" },
  });
  if (!scope) {
    scope = await db.organizationalScope.create({
      data: {
        labelFa: "محدودهٔ نمونه",
        code: "org:selfcheck",
        active: true,
      },
    });
  }
  await db.accountOrganizationalScope.upsert({
    where: {
      accountId_organizationalScopeId: {
        accountId: admin.id,
        organizationalScopeId: scope.id,
      },
    },
    create: {
      accountId: admin.id,
      organizationalScopeId: scope.id,
    },
    update: {},
  });
}
