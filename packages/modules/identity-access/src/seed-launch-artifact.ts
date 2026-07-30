/**
 * Provisional Launch Artifact Register PermissionSet seed (Story 7.7 / FR-55).
 * Lives in identity-access bootstrap to avoid BC inversion.
 * Permission string literals must stay aligned with
 * `@divan/audit-envelope` launch-artifact-permissions.ts — AR-ACCESS pending freeze.
 * Bound to hr.admin until AR-ACCESS freezes a product-owner coarse role.
 * SoD gap (documented): approve + manage on same hr.admin set — provisional.
 * SoD: do NOT auto-grant to audit.investigate / ops.health.read / audit.trust.review.
 */

import type { PrismaClient } from "@divan/db";

/** @provisional-pending-AR-ACCESS-freeze */
const LAUNCH_ARTIFACT_READ_PERMISSION = "launch.artifact.read";
/** @provisional-pending-AR-ACCESS-freeze */
const LAUNCH_ARTIFACT_MANAGE_PERMISSION = "launch.artifact.manage";
/** @provisional-pending-AR-ACCESS-freeze */
const LAUNCH_ARTIFACT_APPROVE_PERMISSION = "launch.artifact.approve";
/** @provisional-pending-AR-ACCESS-freeze */
const LAUNCH_ARTIFACT_WAIVER_PERMISSION = "launch.artifact.waiver";
/** @provisional-pending-AR-ACCESS-freeze */
const LAUNCH_ARTIFACT_REBASELINE_PERMISSION = "launch.artifact.rebaseline";

export const SEED_LAUNCH_ARTIFACT_PERMISSIONS = {
  permissionSetName: "launch-artifact-provisional",
  roleCode: "launch_artifact_owner_provisional",
  roleLabelFa: "مالک آرتیفکت پرتاب (موقت)",
} as const;

/**
 * Bind provisional launch.artifact.* permissions to hr.admin.
 * Idempotent. Coarse hr_admin nav alone must not bypass envelope.
 */
export async function seedLaunchArtifactPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissions = [
    LAUNCH_ARTIFACT_READ_PERMISSION,
    LAUNCH_ARTIFACT_MANAGE_PERMISSION,
    LAUNCH_ARTIFACT_APPROVE_PERMISSION,
    LAUNCH_ARTIFACT_WAIVER_PERMISSION,
    LAUNCH_ARTIFACT_REBASELINE_PERMISSION,
  ];

  const set = await db.permissionSet.upsert({
    where: { name: SEED_LAUNCH_ARTIFACT_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_LAUNCH_ARTIFACT_PERMISSIONS.permissionSetName,
      permissions,
    },
    update: {
      permissions,
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_LAUNCH_ARTIFACT_PERMISSIONS.roleCode },
    create: {
      code: SEED_LAUNCH_ARTIFACT_PERMISSIONS.roleCode,
      labelFa: SEED_LAUNCH_ARTIFACT_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_LAUNCH_ARTIFACT_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
  });

  const admin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  if (!admin) {
    console.warn(
      "[seed-launch-artifact] hr.admin account missing — PermissionSet created but unbound",
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
