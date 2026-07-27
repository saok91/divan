/**
 * Provisional audit investigation PermissionSet seed (Story 7.1).
 * Lives in identity-access bootstrap to avoid BC inversion.
 * Permission keys imported from `@divan/audit-envelope` — AR-ACCESS pending freeze.
 */

import {
  AUDIT_EVIDENCE_REVIEW_PERMISSION,
  AUDIT_INVESTIGATE_PERMISSION,
} from "@divan/audit-envelope";
import type { PrismaClient } from "@divan/db";

export const SEED_AUDIT_PERMISSIONS = {
  permissionSetName: "audit-investigate-provisional",
  roleCode: "audit_investigator_provisional",
  roleLabelFa: "محقق ممیزی (موقت)",
} as const;

/**
 * Bind provisional audit investigation permissions to audit.reviewer.
 * Idempotent. Coarse role alone must not bypass envelope.
 * Does not grant export.retrieve — artifact bytes require separate export entitlement (SoD).
 */
export async function seedAuditPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const set = await db.permissionSet.upsert({
    where: { name: SEED_AUDIT_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_AUDIT_PERMISSIONS.permissionSetName,
      permissions: [
        AUDIT_INVESTIGATE_PERMISSION,
        AUDIT_EVIDENCE_REVIEW_PERMISSION,
      ],
    },
    update: {
      permissions: [
        AUDIT_INVESTIGATE_PERMISSION,
        AUDIT_EVIDENCE_REVIEW_PERMISSION,
      ],
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_AUDIT_PERMISSIONS.roleCode },
    create: {
      code: SEED_AUDIT_PERMISSIONS.roleCode,
      labelFa: SEED_AUDIT_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_AUDIT_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
  });

  const reviewer = await db.internalAccount.findUnique({
    where: { username: "audit.reviewer" },
  });
  if (!reviewer) {
    console.warn(
      "[seed-audit] audit.reviewer account missing — PermissionSet created but unbound",
    );
    return;
  }

  await db.accountAccessRole.upsert({
    where: {
      accountId_accessRoleId: {
        accountId: reviewer.id,
        accessRoleId: role.id,
      },
    },
    create: {
      accountId: reviewer.id,
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
        accountId: reviewer.id,
        organizationalScopeId: scope.id,
      },
    },
    create: {
      accountId: reviewer.id,
      organizationalScopeId: scope.id,
    },
    update: {},
  });
}
