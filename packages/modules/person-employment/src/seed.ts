/**
 * Demo seed for Person + Employment projections (Stories 3.1–3.2).
 * Invoked from identity-access seedDevAccounts after access-admin fixtures.
 */

import type { PrismaClient } from "@divan/db";

import {
  applyEmploymentProjection,
  listEmploymentsForPerson,
} from "./employment";
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

/** Adjacent half-open intervals for demo Person 10001. */
export const SEED_EMPLOYMENT_LIFECYCLE = {
  historicalStart: "2020-01-01",
  /** Exclusive end of historical = start of active (back-to-back OK). */
  historicalEndExclusive: "2024-01-01",
  activeStart: "2024-01-01",
  collaborationHistorical: "contractor",
  collaborationActive: "employee",
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

function isAdjacentDemoSeedPair(
  rows: Awaited<ReturnType<typeof listEmploymentsForPerson>>,
): boolean {
  const hist = rows.find(
    (e) =>
      e.startDate === SEED_EMPLOYMENT_LIFECYCLE.historicalStart &&
      e.endDateExclusive === SEED_EMPLOYMENT_LIFECYCLE.historicalEndExclusive,
  );
  const open = rows.find(
    (e) =>
      e.startDate === SEED_EMPLOYMENT_LIFECYCLE.activeStart &&
      e.endDateExclusive === null,
  );
  return Boolean(
    hist && open && hist.endDateExclusive === open.startDate,
  );
}

/**
 * Seed closed historical + open active Employments for demo Person (adjacent).
 * Idempotent when the adjacent seed pair is already present; repairs wrong shape.
 */
export async function seedDemoEmployments(
  db: PrismaClient,
): Promise<{ personId: string; employmentIds: string[] }> {
  const person = await seedDemoPerson(db);
  const existing = await listEmploymentsForPerson(person.id, db);
  if (existing.length >= 2 && isAdjacentDemoSeedPair(existing)) {
    return {
      personId: person.id,
      employmentIds: existing.map((e) => e.id),
    };
  }

  // Clear partial or wrong-shape seed, then write clean adjacent pair.
  if (existing.length > 0) {
    await db.employment.deleteMany({ where: { personId: person.id } });
  }

  const historical = await applyEmploymentProjection(
    {
      personId: person.id,
      startDate: SEED_EMPLOYMENT_LIFECYCLE.historicalStart,
      endDateExclusive: SEED_EMPLOYMENT_LIFECYCLE.historicalEndExclusive,
      collaborationType: SEED_EMPLOYMENT_LIFECYCLE.collaborationHistorical,
      terminationReason: "contract_ended",
    },
    db,
  );
  const active = await applyEmploymentProjection(
    {
      personId: person.id,
      startDate: SEED_EMPLOYMENT_LIFECYCLE.activeStart,
      endDateExclusive: null,
      collaborationType: SEED_EMPLOYMENT_LIFECYCLE.collaborationActive,
    },
    db,
  );

  return {
    personId: person.id,
    employmentIds: [historical.id, active.id],
  };
}

export async function seedPersonIdentityFixtures(
  db: PrismaClient,
): Promise<void> {
  await seedPersonPermissionFixtures(db);
  await seedDemoPerson(db);
}

/** Person identity + Employment lifecycle fixtures (Stories 3.1–3.2). */
export async function seedEmploymentLifecycleFixtures(
  db: PrismaClient,
): Promise<void> {
  await seedPersonIdentityFixtures(db);
  await seedDemoEmployments(db);
}
