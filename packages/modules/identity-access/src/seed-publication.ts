/**
 * Provisional decision-publication PermissionSet seed (Story 7.6 / FR-54).
 * Lives in identity-access bootstrap (not @divan/reporting) to avoid BC inversion.
 * Permission string literals must stay aligned with
 * `@divan/reporting` decision-publication-permissions.ts — AR-ACCESS pending freeze.
 * Bound to hr.admin until AR-ACCESS freezes a publisher coarse role.
 * SoD: do NOT auto-grant to audit.investigate / ops.health.read / audit.trust.review.
 */

import type { PrismaClient } from "@divan/db";

/** @provisional-pending-AR-ACCESS-freeze — mirror REPORT_PUBLICATION_READ_PERMISSION */
const REPORT_PUBLICATION_READ_PERMISSION = "report.publication.read";
/** @provisional-pending-AR-ACCESS-freeze — mirror REPORT_PUBLICATION_PUBLISH_PERMISSION */
const REPORT_PUBLICATION_PUBLISH_PERMISSION = "report.publication.publish";
/** @provisional-pending-AR-ACCESS-freeze — mirror REPORT_PUBLICATION_SUPERSEDE_PERMISSION */
const REPORT_PUBLICATION_SUPERSEDE_PERMISSION = "report.publication.supersede";
/** @provisional-pending-AR-ACCESS-freeze — mirror REPORT_PUBLICATION_MANAGE_PERMISSION */
const REPORT_PUBLICATION_MANAGE_PERMISSION = "report.publication.manage";

export const SEED_PUBLICATION_PERMISSIONS = {
  permissionSetName: "report-publication-provisional",
  roleCode: "report_publication_publisher_provisional",
  roleLabelFa: "ناشر گزارش تصمیم (موقت)",
} as const;

/**
 * Bind provisional report.publication.* permissions to hr.admin.
 * Idempotent. Coarse hr_admin nav alone must not bypass envelope.
 */
export async function seedPublicationPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissions = [
    REPORT_PUBLICATION_READ_PERMISSION,
    REPORT_PUBLICATION_PUBLISH_PERMISSION,
    REPORT_PUBLICATION_SUPERSEDE_PERMISSION,
    REPORT_PUBLICATION_MANAGE_PERMISSION,
  ];

  const set = await db.permissionSet.upsert({
    where: { name: SEED_PUBLICATION_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_PUBLICATION_PERMISSIONS.permissionSetName,
      permissions,
    },
    update: {
      permissions,
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_PUBLICATION_PERMISSIONS.roleCode },
    create: {
      code: SEED_PUBLICATION_PERMISSIONS.roleCode,
      labelFa: SEED_PUBLICATION_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_PUBLICATION_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
  });

  const admin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  if (!admin) {
    console.warn(
      "[seed-publication] hr.admin account missing — PermissionSet created but unbound",
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
