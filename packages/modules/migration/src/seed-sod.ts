/**
 * Provisional migration SoD PermissionSet seed (Story 6.2).
 * AR-MIGRATION / AR-ACCESS pending freeze — fail-closed wiring only.
 *
 * hr.admin → migration.approve
 * hr.operator → migration.execute
 * Same-actor upload≠approve and approve≠execute still rejected by domain
 * segregation checks. Call from bootstrap/selfcheck — not per web request.
 */

import type { PrismaClient } from "@divan/db";

import {
  MIGRATION_APPROVE_PERMISSION,
  MIGRATION_EXECUTE_PERMISSION,
} from "./sod";

export const SEED_MIGRATION_SOD = {
  approvePermissionSetName: "migration-approve-provisional",
  approveRoleCode: "migration_approver_provisional",
  approveRoleLabelFa: "تأییدکننده واردسازی (موقت)",
  executePermissionSetName: "migration-execute-provisional",
  executeRoleCode: "migration_executor_provisional",
  executeRoleLabelFa: "اجراکننده واردسازی (موقت)",
} as const;

/**
 * Bind provisional SoD permissions. Idempotent.
 * Does not invent signed AR-ACCESS matrix — code-marked provisional only.
 */
export async function seedMigrationSodPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const approveSet = await db.permissionSet.upsert({
    where: { name: SEED_MIGRATION_SOD.approvePermissionSetName },
    create: {
      name: SEED_MIGRATION_SOD.approvePermissionSetName,
      permissions: [MIGRATION_APPROVE_PERMISSION],
    },
    update: {
      permissions: [MIGRATION_APPROVE_PERMISSION],
    },
  });

  const executeSet = await db.permissionSet.upsert({
    where: { name: SEED_MIGRATION_SOD.executePermissionSetName },
    create: {
      name: SEED_MIGRATION_SOD.executePermissionSetName,
      permissions: [MIGRATION_EXECUTE_PERMISSION],
    },
    update: {
      permissions: [MIGRATION_EXECUTE_PERMISSION],
    },
  });

  const approveRole = await db.accessRole.upsert({
    where: { code: SEED_MIGRATION_SOD.approveRoleCode },
    create: {
      code: SEED_MIGRATION_SOD.approveRoleCode,
      labelFa: SEED_MIGRATION_SOD.approveRoleLabelFa,
      permissionSetId: approveSet.id,
    },
    update: {
      labelFa: SEED_MIGRATION_SOD.approveRoleLabelFa,
      permissionSetId: approveSet.id,
    },
  });

  const executeRole = await db.accessRole.upsert({
    where: { code: SEED_MIGRATION_SOD.executeRoleCode },
    create: {
      code: SEED_MIGRATION_SOD.executeRoleCode,
      labelFa: SEED_MIGRATION_SOD.executeRoleLabelFa,
      permissionSetId: executeSet.id,
    },
    update: {
      labelFa: SEED_MIGRATION_SOD.executeRoleLabelFa,
      permissionSetId: executeSet.id,
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
          accessRoleId: approveRole.id,
        },
      },
      create: {
        accountId: admin.id,
        accessRoleId: approveRole.id,
      },
      update: {},
    });
  }

  const operator = await db.internalAccount.findUnique({
    where: { username: "hr.operator" },
  });
  if (operator) {
    await db.accountAccessRole.upsert({
      where: {
        accountId_accessRoleId: {
          accountId: operator.id,
          accessRoleId: executeRole.id,
        },
      },
      create: {
        accountId: operator.id,
        accessRoleId: executeRole.id,
      },
      update: {},
    });
  }
}
