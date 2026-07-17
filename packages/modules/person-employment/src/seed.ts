/**
 * Demo seed for Person + Employment + Data Dictionary + Org units (Stories 3.1–3.5).
 * Invoked from identity-access seedDevAccounts after access-admin fixtures.
 */

import type { PrismaClient } from "@divan/db";

import { seedDataDictionary } from "./data-dictionary";
import {
  applyEmploymentProjection,
  listEmploymentsForPerson,
} from "./employment";
import {
  ORGANIZATION_READ_PERMISSION,
  ORGANIZATION_WRITE_PERMISSION,
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
} from "./errors";
import { createOrgUnit } from "./org-unit";
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

/** Demo org hierarchy LE → BU → Dept → Teams (Story 3.5). */
export const SEED_ORGANIZATION_HIERARCHY = {
  permissionSetName: "organization-hierarchy",
  roleCode: "organization_operator",
  roleLabelFa: "اپراتور ساختار سازمان",
  legalEntity: {
    code: "LE-DEMO",
    nameFa: "شرکت نمونه دیوان",
    startDate: "2018-01-01",
  },
  businessUnit: {
    code: "BU-DEMO",
    nameFa: "واحد کسب‌وکار فناوری",
    startDate: "2019-01-01",
  },
  department: {
    code: "DEPT-DEMO",
    nameFa: "دپارتمان منابع انسانی",
    startDate: "2020-01-01",
  },
  /** Closed historical team — retained for as-of history. */
  teamHistorical: {
    code: "TEAM-HIST",
    nameFa: "تیم جذب (تاریخی)",
    startDate: "2020-01-01",
    endDateExclusive: "2023-01-01",
  },
  teamActive: {
    code: "TEAM-DEMO",
    nameFa: "تیم جذب و نگهداشت",
    startDate: "2023-01-01",
  },
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
 * Requires Data Dictionary approve fields enabled first.
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
  await seedDataDictionary(db);
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

/** Data Dictionary + Person identity fixtures (Story 3.3). */
export async function seedDataDictionaryFixtures(
  db: PrismaClient,
): Promise<void> {
  await seedPersonIdentityFixtures(db);
}

/**
 * Bind organization.read / organization.write for hr.admin (demo/dev).
 * Idempotent. Do not invent AR-ACCESS production matrices.
 */
export async function seedOrganizationPermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissionSet = await db.permissionSet.upsert({
    where: { name: SEED_ORGANIZATION_HIERARCHY.permissionSetName },
    create: {
      name: SEED_ORGANIZATION_HIERARCHY.permissionSetName,
      permissions: [
        ORGANIZATION_READ_PERMISSION,
        ORGANIZATION_WRITE_PERMISSION,
      ],
    },
    update: {
      permissions: [
        ORGANIZATION_READ_PERMISSION,
        ORGANIZATION_WRITE_PERMISSION,
      ],
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_ORGANIZATION_HIERARCHY.roleCode },
    create: {
      code: SEED_ORGANIZATION_HIERARCHY.roleCode,
      labelFa: SEED_ORGANIZATION_HIERARCHY.roleLabelFa,
      permissionSetId: permissionSet.id,
    },
    update: {
      labelFa: SEED_ORGANIZATION_HIERARCHY.roleLabelFa,
      permissionSetId: permissionSet.id,
    },
  });

  for (const username of ["hr.admin"] as const) {
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

async function ensureOrgUnitByCode(
  db: PrismaClient,
  input: Parameters<typeof createOrgUnit>[0],
): Promise<{ id: string; code: string }> {
  const existing = await db.organizationalUnit.findUnique({
    where: { code: input.code },
  });
  if (existing) {
    return { id: existing.id, code: existing.code };
  }
  const created = await createOrgUnit(input, db);
  return { id: created.id, code: created.code };
}

/**
 * Minimal demo hierarchy: 1 LE → 1 BU → 1 Dept → historical Team + active Team.
 * Idempotent by stable codes. Org has no Person FK.
 */
export async function seedDemoOrganizationHierarchy(
  db: PrismaClient,
): Promise<{ legalEntityId: string; teamIds: string[] }> {
  const seed = SEED_ORGANIZATION_HIERARCHY;
  const le = await ensureOrgUnitByCode(db, {
    code: seed.legalEntity.code,
    nameFa: seed.legalEntity.nameFa,
    unitType: "LEGAL_ENTITY",
    parentId: null,
    startDate: seed.legalEntity.startDate,
  });
  const bu = await ensureOrgUnitByCode(db, {
    code: seed.businessUnit.code,
    nameFa: seed.businessUnit.nameFa,
    unitType: "BUSINESS_UNIT",
    parentId: le.id,
    startDate: seed.businessUnit.startDate,
  });
  const dept = await ensureOrgUnitByCode(db, {
    code: seed.department.code,
    nameFa: seed.department.nameFa,
    unitType: "DEPARTMENT",
    parentId: bu.id,
    startDate: seed.department.startDate,
  });
  const hist = await ensureOrgUnitByCode(db, {
    code: seed.teamHistorical.code,
    nameFa: seed.teamHistorical.nameFa,
    unitType: "TEAM",
    parentId: dept.id,
    startDate: seed.teamHistorical.startDate,
    endDateExclusive: seed.teamHistorical.endDateExclusive,
  });
  const team = await ensureOrgUnitByCode(db, {
    code: seed.teamActive.code,
    nameFa: seed.teamActive.nameFa,
    unitType: "TEAM",
    parentId: dept.id,
    startDate: seed.teamActive.startDate,
  });

  return { legalEntityId: le.id, teamIds: [hist.id, team.id] };
}

/** Organization permissions + demo hierarchy (Story 3.5). */
export async function seedOrganizationHierarchyFixtures(
  db: PrismaClient,
): Promise<void> {
  await seedOrganizationPermissionFixtures(db);
  await seedDemoOrganizationHierarchy(db);
}
