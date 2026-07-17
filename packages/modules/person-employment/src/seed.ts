/**
 * Demo seed for Person + person.read/write PermissionSets (Story 3.1).
 * Invoked from identity-access seedDevAccounts after access-admin fixtures.
 */

import type { PrismaClient } from "@divan/db";

import {
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
} from "./errors";
import { createPerson } from "./person";

export const SEED_PERSON_IDENTITY = {
  permissionSetName: "person-identity",
  roleCode: "person_operator",
  roleLabelFa: "اپراتور پرسنل",
  demoPersonnelCode: "10001",
  demoGivenName: "سارا",
  demoFamilyName: "محمدی",
  demoMobilePhone: "09121234567",
} as const;

/**
 * Bind person.read / person.write into a PermissionSet + role for
 * hr.admin and hr.operator. Idempotent.
 */
export async function seedPersonPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissionSet = await db.permissionSet.upsert({
    where: { name: SEED_PERSON_IDENTITY.permissionSetName },
    create: {
      name: SEED_PERSON_IDENTITY.permissionSetName,
      permissions: [PERSON_READ_PERMISSION, PERSON_WRITE_PERMISSION],
    },
    update: {
      permissions: [PERSON_READ_PERMISSION, PERSON_WRITE_PERMISSION],
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_PERSON_IDENTITY.roleCode },
    create: {
      code: SEED_PERSON_IDENTITY.roleCode,
      labelFa: SEED_PERSON_IDENTITY.roleLabelFa,
      permissionSetId: permissionSet.id,
    },
    update: {
      labelFa: SEED_PERSON_IDENTITY.roleLabelFa,
      permissionSetId: permissionSet.id,
    },
  });

  for (const username of ["hr.admin", "hr.operator"] as const) {
    const account = await db.internalAccount.findUnique({
      where: { username },
    });
    if (!account) continue;

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
  }
}

/**
 * Ensure ≥1 demo Person exists (unique personnel code).
 */
export async function seedDemoPerson(
  db: PrismaClient,
): Promise<{ id: string; personnelCode: string }> {
  const existing = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  if (existing) {
    return { id: existing.id, personnelCode: existing.personnelCode };
  }

  const created = await createPerson(
    {
      personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode,
      givenName: SEED_PERSON_IDENTITY.demoGivenName,
      familyName: SEED_PERSON_IDENTITY.demoFamilyName,
      mobilePhone: SEED_PERSON_IDENTITY.demoMobilePhone,
    },
    { accountId: "seed", correlationId: "seed-person-3.1" },
    db,
  );
  return { id: created.id, personnelCode: created.personnelCode };
}

export async function seedPersonIdentityFixtures(
  db: PrismaClient,
): Promise<void> {
  await seedPersonPermissionFixtures(db);
  await seedDemoPerson(db);
}
