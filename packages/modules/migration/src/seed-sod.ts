/**
 * Provisional migration SoD PermissionSet seed (Stories 6.2 + 6.4).
 * AR-MIGRATION / AR-ACCESS pending freeze — fail-closed wiring only.
 *
 * hr.admin → migration.approve + migration.reconcile + migration.sign
 * hr.operator → migration.execute
 * Same-actor segregation still enforced by domain checks.
 * Call from bootstrap/selfcheck — not per web request.
 */

import type { PrismaClient } from "@divan/db";

import {
  MIGRATION_APPROVE_PERMISSION,
  MIGRATION_EXECUTE_PERMISSION,
  MIGRATION_RECONCILE_PERMISSION,
  MIGRATION_SIGN_PERMISSION,
} from "./sod";

export const SEED_MIGRATION_SOD = {
  approvePermissionSetName: "migration-approve-provisional",
  approveRoleCode: "migration_approver_provisional",
  approveRoleLabelFa: "تأییدکننده واردسازی (موقت)",
  executePermissionSetName: "migration-execute-provisional",
  executeRoleCode: "migration_executor_provisional",
  executeRoleLabelFa: "اجراکننده واردسازی (موقت)",
  reconcilePermissionSetName: "migration-reconcile-provisional",
  reconcileRoleCode: "migration_reconciler_provisional",
  reconcileRoleLabelFa: "تطبیق‌کننده واردسازی (موقت)",
  signPermissionSetName: "migration-sign-provisional",
  signRoleCode: "migration_signer_provisional",
  signRoleLabelFa: "امضاکننده تطبیق واردسازی (موقت)",
} as const;

/**
 * Bind provisional SoD permissions. Idempotent.
 * Does not invent signed AR-ACCESS matrix — code-marked provisional only.
 *
 * Permission choice (Dev Agent Record):
 * - migration.reconcile — create/compare/controls/disposition
 * - migration.sign — dual role signatures (Migration Lead / HR Data Owner)
 * Mirrors approve/execute split; both seeded on hr.admin for bootstrap.
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

  const reconcileSet = await db.permissionSet.upsert({
    where: { name: SEED_MIGRATION_SOD.reconcilePermissionSetName },
    create: {
      name: SEED_MIGRATION_SOD.reconcilePermissionSetName,
      permissions: [MIGRATION_RECONCILE_PERMISSION],
    },
    update: {
      permissions: [MIGRATION_RECONCILE_PERMISSION],
    },
  });

  const signSet = await db.permissionSet.upsert({
    where: { name: SEED_MIGRATION_SOD.signPermissionSetName },
    create: {
      name: SEED_MIGRATION_SOD.signPermissionSetName,
      permissions: [MIGRATION_SIGN_PERMISSION],
    },
    update: {
      permissions: [MIGRATION_SIGN_PERMISSION],
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

  const reconcileRole = await db.accessRole.upsert({
    where: { code: SEED_MIGRATION_SOD.reconcileRoleCode },
    create: {
      code: SEED_MIGRATION_SOD.reconcileRoleCode,
      labelFa: SEED_MIGRATION_SOD.reconcileRoleLabelFa,
      permissionSetId: reconcileSet.id,
    },
    update: {
      labelFa: SEED_MIGRATION_SOD.reconcileRoleLabelFa,
      permissionSetId: reconcileSet.id,
    },
  });

  const signRole = await db.accessRole.upsert({
    where: { code: SEED_MIGRATION_SOD.signRoleCode },
    create: {
      code: SEED_MIGRATION_SOD.signRoleCode,
      labelFa: SEED_MIGRATION_SOD.signRoleLabelFa,
      permissionSetId: signSet.id,
    },
    update: {
      labelFa: SEED_MIGRATION_SOD.signRoleLabelFa,
      permissionSetId: signSet.id,
    },
  });

  const admin = await db.internalAccount.findUnique({
    where: { username: "hr.admin" },
  });
  if (admin) {
    for (const role of [approveRole, reconcileRole, signRole]) {
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
