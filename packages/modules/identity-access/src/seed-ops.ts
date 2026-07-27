/**
 * Provisional ops health PermissionSet seed (Story 7.2).
 * Lives in identity-access bootstrap to avoid BC inversion.
 * Permission keys imported from `@divan/audit-envelope` — AR-ACCESS pending freeze.
 */

import { OPS_HEALTH_READ_PERMISSION } from "@divan/audit-envelope";
import type { PrismaClient } from "@divan/db";

export const SEED_OPS_PERMISSIONS = {
  permissionSetName: "ops-health-provisional",
  roleCode: "ops_health_reader_provisional",
  roleLabelFa: "خواننده سلامت عملیات (موقت)",
} as const;

/**
 * Bind provisional ops.health.read to sys.admin.
 * Idempotent. Coarse system_admin nav alone must not bypass envelope.
 */
export async function seedOpsPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const set = await db.permissionSet.upsert({
    where: { name: SEED_OPS_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_OPS_PERMISSIONS.permissionSetName,
      permissions: [OPS_HEALTH_READ_PERMISSION],
    },
    update: {
      permissions: [OPS_HEALTH_READ_PERMISSION],
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_OPS_PERMISSIONS.roleCode },
    create: {
      code: SEED_OPS_PERMISSIONS.roleCode,
      labelFa: SEED_OPS_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_OPS_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
  });

  const admin = await db.internalAccount.findUnique({
    where: { username: "sys.admin" },
  });
  if (!admin) {
    console.warn(
      "[seed-ops] sys.admin account missing — PermissionSet created but unbound",
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
