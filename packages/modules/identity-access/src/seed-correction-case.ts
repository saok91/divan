/**
 * Provisional correction-case PermissionSet seed (Story 7.5 / FR-53).
 * Lives in identity-access bootstrap to avoid BC inversion.
 * Permission keys imported from `@divan/audit-envelope` — AR-ACCESS pending freeze.
 * Bound to hr.admin until AR-ACCESS freezes a Legal/Privacy coarse role.
 * SoD: do NOT auto-grant to audit.investigate / ops.health.read / audit.trust.review.
 */

import {
  CORRECTION_CASE_CLOSE_PERMISSION,
  CORRECTION_CASE_DECIDE_PERMISSION,
  CORRECTION_CASE_READ_PERMISSION,
  CORRECTION_CASE_WRITE_PERMISSION,
} from "@divan/audit-envelope";
import type { PrismaClient } from "@divan/db";

export const SEED_CORRECTION_CASE_PERMISSIONS = {
  permissionSetName: "correction-case-provisional",
  roleCode: "correction_case_owner_provisional",
  roleLabelFa: "مالک پرونده اصلاح (موقت)",
} as const;

/**
 * Bind provisional correction.case.* permissions to hr.admin.
 * Idempotent. Coarse hr_admin nav alone must not bypass envelope.
 */
export async function seedCorrectionCasePermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissions = [
    CORRECTION_CASE_READ_PERMISSION,
    CORRECTION_CASE_WRITE_PERMISSION,
    CORRECTION_CASE_DECIDE_PERMISSION,
    CORRECTION_CASE_CLOSE_PERMISSION,
  ];

  const set = await db.permissionSet.upsert({
    where: { name: SEED_CORRECTION_CASE_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_CORRECTION_CASE_PERMISSIONS.permissionSetName,
      permissions,
    },
    update: {
      permissions,
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_CORRECTION_CASE_PERMISSIONS.roleCode },
    create: {
      code: SEED_CORRECTION_CASE_PERMISSIONS.roleCode,
      labelFa: SEED_CORRECTION_CASE_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_CORRECTION_CASE_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
  });

  const admin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  if (!admin) {
    console.warn(
      "[seed-correction-case] hr.admin account missing — PermissionSet created but unbound",
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
