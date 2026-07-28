/**
 * Provisional audit trust PermissionSet seed (Story 7.4).
 * Lives in identity-access bootstrap to avoid BC inversion.
 * Permission keys imported from `@divan/audit-envelope` — AR-ACCESS pending freeze.
 *
 * SoD: bind to audit.reviewer — do NOT auto-grant trust.review to hr.admin / hr.operator.
 */

import {
  AUDIT_TRUST_READ_PERMISSION,
  AUDIT_TRUST_REVIEW_PERMISSION,
} from "@divan/audit-envelope";
import type { PrismaClient } from "@divan/db";

export const SEED_AUDIT_TRUST_PERMISSIONS = {
  permissionSetName: "audit-trust-provisional",
  roleCode: "audit_trust_reviewer_provisional",
  roleLabelFa: "بازبین اعتماد ممیزی (موقت)",
} as const;

/**
 * Bind provisional audit trust read/review to audit.reviewer.
 * Idempotent. Coarse role alone must not bypass envelope.
 */
export async function seedAuditTrustPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const set = await db.permissionSet.upsert({
    where: { name: SEED_AUDIT_TRUST_PERMISSIONS.permissionSetName },
    create: {
      name: SEED_AUDIT_TRUST_PERMISSIONS.permissionSetName,
      permissions: [
        AUDIT_TRUST_READ_PERMISSION,
        AUDIT_TRUST_REVIEW_PERMISSION,
      ],
    },
    update: {
      permissions: [
        AUDIT_TRUST_READ_PERMISSION,
        AUDIT_TRUST_REVIEW_PERMISSION,
      ],
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_AUDIT_TRUST_PERMISSIONS.roleCode },
    create: {
      code: SEED_AUDIT_TRUST_PERMISSIONS.roleCode,
      labelFa: SEED_AUDIT_TRUST_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
    update: {
      labelFa: SEED_AUDIT_TRUST_PERMISSIONS.roleLabelFa,
      permissionSetId: set.id,
    },
  });

  const reviewer = await db.internalAccount.findUnique({
    where: { username: "audit.reviewer" },
  });
  if (!reviewer) {
    console.warn(
      "[seed-audit-trust] audit.reviewer account missing — PermissionSet created but unbound",
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
