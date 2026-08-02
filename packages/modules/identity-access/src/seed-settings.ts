/**
 * Provisional settings.read + settings.write PermissionSet seed (Story 10.2–10.3).
 * Lives in identity-access bootstrap to avoid BC inversion.
 * Permission keys imported from `@divan/audit-envelope` — AR-ACCESS pending freeze.
 */

import {
  SETTINGS_READ_PERMISSION,
  SETTINGS_WRITE_PERMISSION,
} from "@divan/audit-envelope";
import type { PrismaClient } from "@divan/db";

export const SEED_SETTINGS_PERMISSIONS = {
  permissionSetName: "settings-access-provisional",
  /** Pre-10.3 name — migrated on seed for existing DBs. */
  legacyPermissionSetName: "settings-read-provisional",
  roleCode: "settings_admin_provisional",
  legacyRoleCode: "settings_reader_provisional",
  roleLabelFa: "مدیر تنظیمات (موقت)",
} as const;

const SETTINGS_PERMISSIONS = [
  SETTINGS_READ_PERMISSION,
  SETTINGS_WRITE_PERMISSION,
] as const;

const TARGET_USERNAMES = ["hr.admin", "sys.admin"] as const;

/**
 * Bind provisional settings.read + settings.write to hr.admin and sys.admin.
 * Idempotent. Same PermissionSet — no second SoD role. Coarse nav alone must not bypass envelope.
 */
export async function seedSettingsPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  let set = await db.permissionSet.findUnique({
    where: { name: SEED_SETTINGS_PERMISSIONS.permissionSetName },
  });
  if (!set) {
    const legacy = await db.permissionSet.findUnique({
      where: { name: SEED_SETTINGS_PERMISSIONS.legacyPermissionSetName },
    });
    if (legacy) {
      set = await db.permissionSet.update({
        where: { id: legacy.id },
        data: {
          name: SEED_SETTINGS_PERMISSIONS.permissionSetName,
          permissions: [...SETTINGS_PERMISSIONS],
        },
      });
    } else {
      set = await db.permissionSet.create({
        data: {
          name: SEED_SETTINGS_PERMISSIONS.permissionSetName,
          permissions: [...SETTINGS_PERMISSIONS],
        },
      });
    }
  } else {
    set = await db.permissionSet.update({
      where: { id: set.id },
      data: { permissions: [...SETTINGS_PERMISSIONS] },
    });
  }

  let role = await db.accessRole.findUnique({
    where: { code: SEED_SETTINGS_PERMISSIONS.roleCode },
  });
  if (!role) {
    const legacyRole = await db.accessRole.findUnique({
      where: { code: SEED_SETTINGS_PERMISSIONS.legacyRoleCode },
    });
    if (legacyRole) {
      role = await db.accessRole.update({
        where: { id: legacyRole.id },
        data: {
          code: SEED_SETTINGS_PERMISSIONS.roleCode,
          labelFa: SEED_SETTINGS_PERMISSIONS.roleLabelFa,
          permissionSetId: set.id,
        },
      });
    } else {
      role = await db.accessRole.create({
        data: {
          code: SEED_SETTINGS_PERMISSIONS.roleCode,
          labelFa: SEED_SETTINGS_PERMISSIONS.roleLabelFa,
          permissionSetId: set.id,
        },
      });
    }
  } else {
    role = await db.accessRole.update({
      where: { id: role.id },
      data: {
        labelFa: SEED_SETTINGS_PERMISSIONS.roleLabelFa,
        permissionSetId: set.id,
      },
    });
  }

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
