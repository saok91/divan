/**
 * Provisional evaluation snapshot PermissionSet seed (Story 7.8 / FR-56).
 * Lives in identity-access bootstrap to avoid BC inversion.
 * Permission string literals must stay aligned with
 * `@divan/audit-envelope` evaluation-snapshot-permissions.ts — AR-ACCESS pending freeze.
 * Bound to hr.admin (architecture/product stand-in).
 * SoD gap (documented): read + manage on same hr.admin set — provisional.
 * SoD: do NOT auto-grant to audit.investigate / ops.health.read / audit.trust.review /
 * launch.artifact.* / report.publication.*.
 */

import type { PrismaClient } from "@divan/db";

/** @provisional-pending-AR-ACCESS-freeze */
const EVALUATION_SNAPSHOT_READ_PERMISSION = "evaluation.snapshot.read";
/** @provisional-pending-AR-ACCESS-freeze */
const EVALUATION_SNAPSHOT_MANAGE_PERMISSION = "evaluation.snapshot.manage";

export const SEED_EVALUATION_SNAPSHOT_PERMISSIONS = {
  permissionSetName: "evaluation-snapshot-provisional",
  roleCode: "evaluation_snapshot_owner_provisional",
  roleLabelFa: "مالک اسنپ‌شات ارزیابی (موقت)",
} as const;

/**
 * Bind provisional evaluation.snapshot.* permissions to hr.admin.
 * Idempotent. Coarse hr_admin nav alone must not bypass envelope.
 */
export async function seedEvaluationSnapshotPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissions = [
    EVALUATION_SNAPSHOT_READ_PERMISSION,
    EVALUATION_SNAPSHOT_MANAGE_PERMISSION,
  ];

  const set = await db.permissionSet.upsert({
    where: { name: SEED_EVALUATION_SNAPSHOT_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_EVALUATION_SNAPSHOT_PERMISSIONS.permissionSetName,
      permissions,
    },
    update: {
      permissions,
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_EVALUATION_SNAPSHOT_PERMISSIONS.roleCode },
    create: {
      code: SEED_EVALUATION_SNAPSHOT_PERMISSIONS.roleCode,
      labelFa: SEED_EVALUATION_SNAPSHOT_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_EVALUATION_SNAPSHOT_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
  });

  const admin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  if (!admin) {
    console.warn(
      "[seed-evaluation-snapshot] hr.admin account missing — PermissionSet created but unbound",
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
