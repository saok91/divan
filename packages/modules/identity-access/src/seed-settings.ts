/**
 * Provisional settings.read PermissionSet seed (Story 10.2).
 * Lives in identity-access bootstrap to avoid BC inversion.
 * Permission keys imported from `@divan/audit-envelope` — AR-ACCESS pending freeze.
 */

import { SETTINGS_READ_PERMISSION } from "@divan/audit-envelope";
import type { PrismaClient } from "@divan/db";

export const SEED_SETTINGS_PERMISSIONS = {
  permissionSetName: "settings-read-provisional",
  roleCode: "settings_reader_provisional",
  roleLabelFa: "خواننده تنظیمات (موقت)",
} as const;

const TARGET_USERNAMES = ["hr.admin", "sys.admin"] as const;

/**
 * Bind provisional settings.read to hr.admin and sys.admin.
 * Idempotent. Coarse nav alone must not bypass envelope.
 */
export async function seedSettingsPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const set = await db.permissionSet.upsert({
    where: { name: SEED_SETTINGS_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_SETTINGS_PERMISSIONS.permissionSetName,
      permissions: [SETTINGS_READ_PERMISSION],
    },
    update: {
      permissions: [SETTINGS_READ_PERMISSION],
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_SETTINGS_PERMISSIONS.roleCode },
    create: {
      code: SEED_SETTINGS_PERMISSIONS.roleCode,
      labelFa: SEED_SETTINGS_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_SETTINGS_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
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

  for (const username of TARGET_USERNAMES) {
    const account = await db.internalAccount.findUnique({
      where: { username },
    });
    if (!account) {
      console.warn(
        `[seed-settings] ${username} account missing — PermissionSet created but unbound for this user`,
      );
      continue;
    }

    await db.accountAccessRole.upsert({
      where: {
        accountId_accessRoleId: {
          accountId: account.id,
          accessRoleId: role.id,
        },
      },
      create: {
        accountId: account.id,
        accessRoleId: role.id,
      },
      update: {},
    });

    await db.accountOrganizationalScope.upsert({
      where: {
        accountId_organizationalScopeId: {
          accountId: account.id,
          organizationalScopeId: scope.id,
        },
      },
      create: {
        accountId: account.id,
        organizationalScopeId: scope.id,
      },
      update: {},
    });
  }
}
