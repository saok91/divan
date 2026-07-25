/**
 * Provisional export PermissionSet seed (Story 6.5).
 * Lives in identity-access bootstrap (not @divan/reporting) to avoid BC inversion.
 * Permission string literals must stay aligned with
 * `@divan/reporting` export-permissions.ts — AR-ACCESS pending freeze.
 */

import type { PrismaClient } from "@divan/db";

/** @provisional-pending-AR-ACCESS-freeze — mirror reporting REPORT_EXPORT_PERMISSION */
const REPORT_EXPORT_PERMISSION = "report.export";
/** @provisional-pending-AR-ACCESS-freeze — mirror reporting PERSON_EXPORT_PERMISSION */
const PERSON_EXPORT_PERMISSION = "person.export";
/** @provisional-pending-AR-ACCESS-freeze — mirror reporting EXPORT_RETRIEVE_PERMISSION */
const EXPORT_RETRIEVE_PERMISSION = "export.retrieve";

export const SEED_EXPORT_PERMISSIONS = {
  permissionSetName: "export-governed-provisional",
  roleCode: "export_exporter_provisional",
  roleLabelFa: "صادرکننده خروجی حاکمیتی (موقت)",
} as const;

/**
 * Bind provisional export permissions. Idempotent.
 * Does not invent signed AR-ACCESS matrix — code-marked provisional only.
 * Category-export keys (e.g. compensation.export) intentionally unseeded — fail-closed omit.
 */
export async function seedExportPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const set = await db.permissionSet.upsert({
    where: { name: SEED_EXPORT_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_EXPORT_PERMISSIONS.permissionSetName,
      permissions: [
        REPORT_EXPORT_PERMISSION,
        PERSON_EXPORT_PERMISSION,
        EXPORT_RETRIEVE_PERMISSION,
      ],
    },
    update: {
      permissions: [
        REPORT_EXPORT_PERMISSION,
        PERSON_EXPORT_PERMISSION,
        EXPORT_RETRIEVE_PERMISSION,
      ],
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_EXPORT_PERMISSIONS.roleCode },
    create: {
      code: SEED_EXPORT_PERMISSIONS.roleCode,
      labelFa: SEED_EXPORT_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_EXPORT_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
  });

  const admin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  if (admin) {
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
  }
}
