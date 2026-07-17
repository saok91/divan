/**
 * Demo seed for Person + Employment + Data Dictionary + Org + Job refs + Primary + Secondary + Management (3.1–3.9).
 * Invoked from identity-access seedDevAccounts after access-admin fixtures.
 */

import type { PrismaClient } from "@divan/db";

import { seedDataDictionary } from "./data-dictionary";
import {
  applyEmploymentProjection,
  listEmploymentsForPerson,
} from "./employment";
import {
  JOB_REFERENCE_READ_PERMISSION,
  JOB_REFERENCE_WRITE_PERMISSION,
  ORGANIZATION_READ_PERMISSION,
  ORGANIZATION_WRITE_PERMISSION,
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
} from "./errors";
import {
  createGrade,
  createJobTitle,
  createLadder,
  createOrganizationalRole,
  createSeniority,
} from "./job-reference";
import { createOrgUnit } from "./org-unit";
import { createPerson } from "./person";
import {
  applyPrimaryAssignmentProjection,
  assertPrimaryCoverageForActiveEmployment,
  ensurePrimaryAssignmentHooksRegistered,
  listPrimaryAssignmentsForEmployment,
} from "./primary-assignment";
import {
  applySecondaryAssignmentProjection,
  ensureSecondaryAssignmentHooksRegistered,
  listSecondaryAssignmentsForEmployment,
} from "./secondary-assignment";

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

/** Demo job references: Ladder + Grades (incl. half-grade), Role, Title, Seniority (Story 3.6). */
export const SEED_JOB_REFERENCES = {
  permissionSetName: "job-reference",
  roleCode: "job_reference_operator",
  roleLabelFa: "اپراتور مراجع شغلی",
  ladder: {
    code: "LAD-DEMO",
    nameFa: "لدر تخصصی نمونه",
    startDate: "2019-01-01",
  },
  gradeLow: {
    code: "G-12",
    nameFa: "گرید ۱۲",
    rank: "12.0",
    startDate: "2019-01-01",
  },
  /** Half-grade — proves Decimal(4,1) storage. */
  gradeHalf: {
    code: "G-12.5",
    nameFa: "گرید ۱۲٫۵",
    rank: "12.5",
    startDate: "2019-01-01",
  },
  gradeHigh: {
    code: "G-13",
    nameFa: "گرید ۱۳",
    rank: "13.0",
    startDate: "2019-01-01",
  },
  /** Closed historical seniority — retained for as-of history. */
  seniorityHistorical: {
    code: "SEN-HIST",
    nameFa: "ارشدیت تاریخی",
    startDate: "2018-01-01",
    endDateExclusive: "2022-01-01",
  },
  role: {
    code: "ROLE-HR-SPEC",
    nameFa: "کارشناس منابع انسانی",
    startDate: "2020-01-01",
  },
  jobTitle: {
    code: "JT-HR-SPEC",
    nameFa: "عنوان شغلی کارشناس منابع انسانی",
    startDate: "2020-01-01",
  },
  seniority: {
    code: "SEN-MID",
    nameFa: "میانی",
    startDate: "2020-01-01",
  },
} as const;

/**
 * Demo Primary Assignment covering open Employment (Story 3.7 / FR-11).
 * Interval aligns with active Employment; Team + job facts from org/job seeds.
 */
export const SEED_PRIMARY_ASSIGNMENT = {
  /** Optional closed Primary on historical Employment (back-to-back proof). */
  historicalStart: SEED_EMPLOYMENT_LIFECYCLE.historicalStart,
  historicalEndExclusive: SEED_EMPLOYMENT_LIFECYCLE.historicalEndExclusive,
  activeStart: SEED_EMPLOYMENT_LIFECYCLE.activeStart,
} as const;

/**
 * Demo Secondary Assignments on open Employment (Story 3.8 / FR-12).
 * Provisional inventory codes pending AR-SECONDARY approval.
 * No headcount consumption.
 */
export const SEED_SECONDARY_ASSIGNMENT = {
  /** Closed historical Secondary on open Employment (within Employment span). */
  historicalReasonType: "acting_manager",
  historicalStart: "2024-01-01",
  historicalEndExclusive: "2024-06-01",
  /** Open concurrent Secondary — Department target (not TEAM-only). */
  activeReasonType: "acting_manager",
  activeStart: "2024-06-01",
  /** Second concurrent Secondary — different reason/type (multi concurrent proof). */
  concurrentReasonType: "cross_dept_support",
  concurrentStart: "2024-09-01",
} as const;

/**
 * Demo management derivation fixtures (Story 3.9 / FR-13).
 * Middle-manager + member on TEAM-DEMO; optional senior on same Team
 * (scopes to Department parent). Role codes provisional until AR-ACCESS.
 */
export const SEED_MANAGEMENT_RELATIONSHIPS = {
  middleManagerRole: {
    code: "ROLE-MID-MGR",
    nameFa: "مدیر میانی",
    startDate: "2020-01-01",
  },
  seniorManagerRole: {
    code: "ROLE-SNR-MGR",
    nameFa: "مدیر ارشد",
    startDate: "2020-01-01",
  },
  /** Individual contributor Role for managed member (reuse HR specialist). */
  memberRoleCode: SEED_JOB_REFERENCES.role.code,
  middleManagerPerson: {
    personnelCode: "10002",
    givenName: "مینا",
    familyName: "مدیری",
    mobilePhone: "09121234502",
  },
  seniorManagerPerson: {
    personnelCode: "10003",
    givenName: "سیامک",
    familyName: "ارشدی",
    mobilePhone: "09121234503",
  },
  /** Aligns with open Employment / Primary active start. */
  activeStart: SEED_EMPLOYMENT_LIFECYCLE.activeStart,
  /**
   * Seed registry: middle-manager Person personnelCode → demo InternalAccount username.
   * Used only by selfcheck / optional dual-run — not a permanent Person↔Account FK.
   */
  demoManagerAccountUsername: "manager",
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

/**
 * Bind job_reference.read / job_reference.write for hr.admin.
 * Idempotent. Does not invent AR-ACCESS production matrices.
 */
export async function seedJobReferencePermissionFixtures(
  db: PrismaClient,
): Promise<void> {
  const permissionSet = await db.permissionSet.upsert({
    where: { name: SEED_JOB_REFERENCES.permissionSetName },
    create: {
      name: SEED_JOB_REFERENCES.permissionSetName,
      permissions: [
        JOB_REFERENCE_READ_PERMISSION,
        JOB_REFERENCE_WRITE_PERMISSION,
      ],
    },
    update: {
      permissions: [
        JOB_REFERENCE_READ_PERMISSION,
        JOB_REFERENCE_WRITE_PERMISSION,
      ],
    },
  });

  const role = await db.accessRole.upsert({
    where: { code: SEED_JOB_REFERENCES.roleCode },
    create: {
      code: SEED_JOB_REFERENCES.roleCode,
      labelFa: SEED_JOB_REFERENCES.roleLabelFa,
      permissionSetId: permissionSet.id,
    },
    update: {
      labelFa: SEED_JOB_REFERENCES.roleLabelFa,
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

async function ensureByCode<T extends { id: string; code: string }>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await find();
  if (existing) return existing;
  return create();
}

/**
 * Minimal demo job refs: 1 Ladder, ≥2 Grades incl. half-grade, Role, Title,
 * Seniority + 1 inactive historical Seniority. Idempotent by stable codes.
 * No Grade↔Seniority FK. No Assignment FKs.
 */
export async function seedDemoJobReferences(
  db: PrismaClient,
): Promise<{ ladderId: string; gradeIds: string[] }> {
  const seed = SEED_JOB_REFERENCES;

  const ladder = await ensureByCode(
    async () => {
      const row = await db.ladder.findUnique({
        where: { code: seed.ladder.code },
      });
      return row ? { id: row.id, code: row.code } : null;
    },
    async () => {
      const created = await createLadder(
        {
          code: seed.ladder.code,
          nameFa: seed.ladder.nameFa,
          startDate: seed.ladder.startDate,
        },
        db,
      );
      return { id: created.id, code: created.code };
    },
  );

  const gradeDefs = [seed.gradeLow, seed.gradeHalf, seed.gradeHigh] as const;
  const gradeIds: string[] = [];
  for (const g of gradeDefs) {
    const grade = await ensureByCode(
      async () => {
        const row = await db.grade.findUnique({
          where: {
            ladderId_code: { ladderId: ladder.id, code: g.code },
          },
        });
        return row ? { id: row.id, code: row.code } : null;
      },
      async () => {
        const created = await createGrade(
          {
            code: g.code,
            nameFa: g.nameFa,
            ladderId: ladder.id,
            rank: g.rank,
            startDate: g.startDate,
          },
          db,
        );
        return { id: created.id, code: created.code };
      },
    );
    gradeIds.push(grade.id);
  }

  await ensureByCode(
    async () => {
      const row = await db.organizationalRole.findUnique({
        where: { code: seed.role.code },
      });
      return row ? { id: row.id, code: row.code } : null;
    },
    async () => {
      const created = await createOrganizationalRole(
        {
          code: seed.role.code,
          nameFa: seed.role.nameFa,
          startDate: seed.role.startDate,
        },
        db,
      );
      return { id: created.id, code: created.code };
    },
  );

  await ensureByCode(
    async () => {
      const row = await db.jobTitle.findUnique({
        where: { code: seed.jobTitle.code },
      });
      return row ? { id: row.id, code: row.code } : null;
    },
    async () => {
      const created = await createJobTitle(
        {
          code: seed.jobTitle.code,
          nameFa: seed.jobTitle.nameFa,
          startDate: seed.jobTitle.startDate,
        },
        db,
      );
      return { id: created.id, code: created.code };
    },
  );

  await ensureByCode(
    async () => {
      const row = await db.seniority.findUnique({
        where: { code: seed.seniority.code },
      });
      return row ? { id: row.id, code: row.code } : null;
    },
    async () => {
      const created = await createSeniority(
        {
          code: seed.seniority.code,
          nameFa: seed.seniority.nameFa,
          startDate: seed.seniority.startDate,
        },
        db,
      );
      return { id: created.id, code: created.code };
    },
  );

  await ensureByCode(
    async () => {
      const row = await db.seniority.findUnique({
        where: { code: seed.seniorityHistorical.code },
      });
      return row ? { id: row.id, code: row.code } : null;
    },
    async () => {
      const created = await createSeniority(
        {
          code: seed.seniorityHistorical.code,
          nameFa: seed.seniorityHistorical.nameFa,
          startDate: seed.seniorityHistorical.startDate,
          endDateExclusive: seed.seniorityHistorical.endDateExclusive,
        },
        db,
      );
      return { id: created.id, code: created.code };
    },
  );

  return { ladderId: ladder.id, gradeIds };
}

/** Job-reference permissions + demo fixtures (Story 3.6). */
export async function seedJobReferenceFixtures(
  db: PrismaClient,
): Promise<void> {
  await seedJobReferencePermissionFixtures(db);
  await seedDemoJobReferences(db);
}

function isMatchingOpenPrimaryFixture(
  rows: Awaited<ReturnType<typeof listPrimaryAssignmentsForEmployment>>,
  expected: {
    employmentId: string;
    startDate: string;
    teamId: string;
    organizationalRoleId: string;
    jobTitleId: string;
    ladderId: string;
    gradeId: string;
    seniorityId: string | null;
  },
): boolean {
  return rows.some(
    (p) =>
      p.employmentId === expected.employmentId &&
      p.startDate === expected.startDate &&
      p.endDateExclusive === null &&
      p.teamId === expected.teamId &&
      p.organizationalRoleId === expected.organizationalRoleId &&
      p.jobTitleId === expected.jobTitleId &&
      p.ladderId === expected.ladderId &&
      p.gradeId === expected.gradeId &&
      (p.seniorityId ?? null) === expected.seniorityId,
  );
}

/**
 * Seed Primaries for demo Person: closed historical + open active covering
 * each Employment interval. Idempotent when shape matches. Registers hooks.
 */
export async function seedDemoPrimaryAssignments(
  db: PrismaClient,
): Promise<{ personId: string; primaryIds: string[] }> {
  ensurePrimaryAssignmentHooksRegistered();

  await seedEmploymentLifecycleFixtures(db);
  await seedOrganizationHierarchyFixtures(db);
  await seedJobReferenceFixtures(db);

  const person = await seedDemoPerson(db);
  const employments = await listEmploymentsForPerson(person.id, db);
  const histEmp = employments.find(
    (e) =>
      e.startDate === SEED_EMPLOYMENT_LIFECYCLE.historicalStart &&
      e.endDateExclusive === SEED_EMPLOYMENT_LIFECYCLE.historicalEndExclusive,
  );
  const openEmp = employments.find(
    (e) =>
      e.startDate === SEED_EMPLOYMENT_LIFECYCLE.activeStart &&
      e.endDateExclusive === null,
  );
  if (!histEmp || !openEmp) {
    throw new Error("seedDemoPrimaryAssignments: demo employments missing");
  }

  const team = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamActive.code },
  });
  const histTeam = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamHistorical.code },
  });
  const role = await db.organizationalRole.findUnique({
    where: { code: SEED_JOB_REFERENCES.role.code },
  });
  const title = await db.jobTitle.findUnique({
    where: { code: SEED_JOB_REFERENCES.jobTitle.code },
  });
  const ladder = await db.ladder.findUnique({
    where: { code: SEED_JOB_REFERENCES.ladder.code },
  });
  const grade = ladder
    ? await db.grade.findUnique({
        where: {
          ladderId_code: {
            ladderId: ladder.id,
            code: SEED_JOB_REFERENCES.gradeLow.code,
          },
        },
      })
    : null;
  const seniority = await db.seniority.findUnique({
    where: { code: SEED_JOB_REFERENCES.seniority.code },
  });

  if (!team || !histTeam || !role || !title || !ladder || !grade) {
    throw new Error("seedDemoPrimaryAssignments: org/job-ref fixtures missing");
  }

  const openPrimaries = await listPrimaryAssignmentsForEmployment(
    openEmp.id,
    db,
  );
  if (
    openPrimaries.length >= 1 &&
    isMatchingOpenPrimaryFixture(openPrimaries, {
      employmentId: openEmp.id,
      startDate: SEED_PRIMARY_ASSIGNMENT.activeStart,
      teamId: team.id,
      organizationalRoleId: role.id,
      jobTitleId: title.id,
      ladderId: ladder.id,
      gradeId: grade.id,
      seniorityId: seniority?.id ?? null,
    })
  ) {
    assertPrimaryCoverageForActiveEmployment(openEmp, openPrimaries);
    const histPrimaries = await listPrimaryAssignmentsForEmployment(
      histEmp.id,
      db,
    );
    if (histPrimaries.length === 0) {
      // Repair: ensure historical coverage exists.
    } else {
      assertPrimaryCoverageForActiveEmployment(histEmp, histPrimaries);
      return {
        personId: person.id,
        primaryIds: [
          ...histPrimaries.map((p) => p.id),
          ...openPrimaries.map((p) => p.id),
        ],
      };
    }
  }

  // Clear wrong-shape Primaries for both demo Employments, then rewrite.
  await db.primaryAssignment.deleteMany({
    where: { employmentId: { in: [histEmp.id, openEmp.id] } },
  });

  const historical = await applyPrimaryAssignmentProjection(
    {
      employmentId: histEmp.id,
      teamId: histTeam.id,
      organizationalRoleId: role.id,
      jobTitleId: title.id,
      ladderId: ladder.id,
      gradeId: grade.id,
      // Optional seniority omitted on historical — proves no Grade↔Seniority map.
      startDate: SEED_PRIMARY_ASSIGNMENT.historicalStart,
      endDateExclusive: SEED_PRIMARY_ASSIGNMENT.historicalEndExclusive,
    },
    db,
  );

  const active = await applyPrimaryAssignmentProjection(
    {
      employmentId: openEmp.id,
      teamId: team.id,
      organizationalRoleId: role.id,
      jobTitleId: title.id,
      ladderId: ladder.id,
      gradeId: grade.id,
      seniorityId: seniority?.id ?? null,
      startDate: SEED_PRIMARY_ASSIGNMENT.activeStart,
      endDateExclusive: null,
    },
    db,
  );

  assertPrimaryCoverageForActiveEmployment(histEmp, [historical]);
  assertPrimaryCoverageForActiveEmployment(openEmp, [active]);

  return {
    personId: person.id,
    primaryIds: [historical.id, active.id],
  };
}

/** Primary Assignment integrity fixtures (Story 3.7). */
export async function seedPrimaryAssignmentFixtures(
  db: PrismaClient,
): Promise<void> {
  await seedDemoPrimaryAssignments(db);
}

function isMatchingSecondaryFixture(
  rows: ReadonlyArray<{
    employmentId: string;
    orgUnitId: string;
    reasonType: string;
    startDate: string;
    endDateExclusive: string | null;
    organizationalRoleId: string | null;
    jobTitleId: string | null;
    ladderId: string | null;
    gradeId: string | null;
    seniorityId: string | null;
  }>,
  expected: {
    employmentId: string;
    orgUnitId: string;
    reasonType: string;
    startDate: string;
    endDateExclusive: string | null;
    organizationalRoleId: string | null;
    jobTitleId: string | null;
    ladderId: string | null;
    gradeId: string | null;
    seniorityId: string | null;
  },
): boolean {
  return rows.some(
    (s) =>
      s.employmentId === expected.employmentId &&
      s.orgUnitId === expected.orgUnitId &&
      s.reasonType === expected.reasonType &&
      s.startDate === expected.startDate &&
      s.endDateExclusive === expected.endDateExclusive &&
      (s.organizationalRoleId ?? null) === expected.organizationalRoleId &&
      (s.jobTitleId ?? null) === expected.jobTitleId &&
      (s.ladderId ?? null) === expected.ladderId &&
      (s.gradeId ?? null) === expected.gradeId &&
      (s.seniorityId ?? null) === expected.seniorityId,
  );
}

/**
 * Seed Secondaries for demo Person's open Employment:
 * closed historical + open acting_manager (Dept target) + concurrent cross_dept_support.
 * Idempotent when shape matches. Registers Secondary hooks.
 */
export async function seedDemoSecondaryAssignments(
  db: PrismaClient,
): Promise<{ personId: string; secondaryIds: string[] }> {
  ensureSecondaryAssignmentHooksRegistered();

  await seedPrimaryAssignmentFixtures(db);

  const person = await seedDemoPerson(db);
  const employments = await listEmploymentsForPerson(person.id, db);
  const openEmp = employments.find(
    (e) =>
      e.startDate === SEED_EMPLOYMENT_LIFECYCLE.activeStart &&
      e.endDateExclusive === null,
  );
  if (!openEmp) {
    throw new Error("seedDemoSecondaryAssignments: open employment missing");
  }

  const dept = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.department.code },
  });
  const bu = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.businessUnit.code },
  });
  const role = await db.organizationalRole.findUnique({
    where: { code: SEED_JOB_REFERENCES.role.code },
  });
  if (!dept || !bu) {
    throw new Error("seedDemoSecondaryAssignments: org fixtures missing");
  }

  const roleId = role?.id ?? null;
  const nullJobFacts = {
    organizationalRoleId: null as string | null,
    jobTitleId: null as string | null,
    ladderId: null as string | null,
    gradeId: null as string | null,
    seniorityId: null as string | null,
  };

  const existing = await listSecondaryAssignmentsForEmployment(openEmp.id, db);
  const shapeOk =
    existing.length === 3 &&
    isMatchingSecondaryFixture(existing, {
      employmentId: openEmp.id,
      orgUnitId: dept.id,
      reasonType: SEED_SECONDARY_ASSIGNMENT.historicalReasonType,
      startDate: SEED_SECONDARY_ASSIGNMENT.historicalStart,
      endDateExclusive: SEED_SECONDARY_ASSIGNMENT.historicalEndExclusive,
      ...nullJobFacts,
    }) &&
    isMatchingSecondaryFixture(existing, {
      employmentId: openEmp.id,
      orgUnitId: dept.id,
      reasonType: SEED_SECONDARY_ASSIGNMENT.activeReasonType,
      startDate: SEED_SECONDARY_ASSIGNMENT.activeStart,
      endDateExclusive: null,
      ...nullJobFacts,
      organizationalRoleId: roleId,
    }) &&
    isMatchingSecondaryFixture(existing, {
      employmentId: openEmp.id,
      orgUnitId: bu.id,
      reasonType: SEED_SECONDARY_ASSIGNMENT.concurrentReasonType,
      startDate: SEED_SECONDARY_ASSIGNMENT.concurrentStart,
      endDateExclusive: null,
      ...nullJobFacts,
    });

  if (shapeOk) {
    return {
      personId: person.id,
      secondaryIds: existing.map((s) => s.id),
    };
  }

  return db.$transaction(async (tx) => {
    const client = tx as unknown as PrismaClient;
    await client.secondaryAssignment.deleteMany({
      where: { employmentId: openEmp.id },
    });

    const historical = await applySecondaryAssignmentProjection(
      {
        personId: person.id,
        employmentId: openEmp.id,
        orgUnitId: dept.id,
        reasonType: SEED_SECONDARY_ASSIGNMENT.historicalReasonType,
        // Optional job facts omitted on historical.
        startDate: SEED_SECONDARY_ASSIGNMENT.historicalStart,
        endDateExclusive: SEED_SECONDARY_ASSIGNMENT.historicalEndExclusive,
      },
      client,
    );

    const active = await applySecondaryAssignmentProjection(
      {
        personId: person.id,
        employmentId: openEmp.id,
        orgUnitId: dept.id,
        reasonType: SEED_SECONDARY_ASSIGNMENT.activeReasonType,
        organizationalRoleId: roleId,
        startDate: SEED_SECONDARY_ASSIGNMENT.activeStart,
        endDateExclusive: null,
      },
      client,
    );

    const concurrent = await applySecondaryAssignmentProjection(
      {
        personId: person.id,
        employmentId: openEmp.id,
        orgUnitId: bu.id,
        reasonType: SEED_SECONDARY_ASSIGNMENT.concurrentReasonType,
        startDate: SEED_SECONDARY_ASSIGNMENT.concurrentStart,
        endDateExclusive: null,
      },
      client,
    );

    return {
      personId: person.id,
      secondaryIds: [historical.id, active.id, concurrent.id],
    };
  });
}

/** Secondary Assignment fidelity fixtures (Story 3.8). */
export async function seedSecondaryAssignmentFixtures(
  db: PrismaClient,
): Promise<void> {
  await seedDemoSecondaryAssignments(db);
}

async function ensureManagementRoles(db: PrismaClient): Promise<{
  middleRoleId: string;
  seniorRoleId: string;
}> {
  const mid = SEED_MANAGEMENT_RELATIONSHIPS.middleManagerRole;
  const snr = SEED_MANAGEMENT_RELATIONSHIPS.seniorManagerRole;

  const middle = await ensureByCode(
    async () => {
      const row = await db.organizationalRole.findUnique({
        where: { code: mid.code },
      });
      return row ? { id: row.id, code: row.code } : null;
    },
    async () => {
      const created = await createOrganizationalRole(
        {
          code: mid.code,
          nameFa: mid.nameFa,
          startDate: mid.startDate,
        },
        db,
      );
      return { id: created.id, code: created.code };
    },
  );

  const senior = await ensureByCode(
    async () => {
      const row = await db.organizationalRole.findUnique({
        where: { code: snr.code },
      });
      return row ? { id: row.id, code: row.code } : null;
    },
    async () => {
      const created = await createOrganizationalRole(
        {
          code: snr.code,
          nameFa: snr.nameFa,
          startDate: snr.startDate,
        },
        db,
      );
      return { id: created.id, code: created.code };
    },
  );

  return { middleRoleId: middle.id, seniorRoleId: senior.id };
}

async function ensurePersonWithOpenEmployment(
  db: PrismaClient,
  spec: {
    personnelCode: string;
    givenName: string;
    familyName: string;
    mobilePhone: string;
  },
): Promise<{ personId: string; employmentId: string }> {
  let person = await db.person.findUnique({
    where: { personnelCode: spec.personnelCode },
  });
  if (!person) {
    const created = await createPerson(
      {
        personnelCode: spec.personnelCode,
        givenName: spec.givenName,
        familyName: spec.familyName,
        mobilePhone: spec.mobilePhone,
      },
      { accountId: "seed", correlationId: "seed-management-3.9" },
      db,
    );
    person = await db.person.findUniqueOrThrow({ where: { id: created.id } });
  }

  const employments = await listEmploymentsForPerson(person.id, db);
  let open = employments.find(
    (e) =>
      e.startDate === SEED_MANAGEMENT_RELATIONSHIPS.activeStart &&
      e.endDateExclusive === null,
  );
  if (!open) {
    open = await applyEmploymentProjection(
      {
        personId: person.id,
        startDate: SEED_MANAGEMENT_RELATIONSHIPS.activeStart,
        endDateExclusive: null,
        collaborationType: SEED_EMPLOYMENT_LIFECYCLE.collaborationActive,
      },
      db,
    );
  }
  return { personId: person.id, employmentId: open.id };
}

/**
 * Seed middle-manager + senior-manager Persons with Primaries on TEAM-DEMO.
 * Demo Person 10001 remains the managed IC member (ROLE-HR-SPEC).
 * Idempotent when shape matches. Does not invent manager product APIs.
 */
export async function seedDemoManagementRelationships(
  db: PrismaClient,
): Promise<{
  middleManagerPersonId: string;
  seniorManagerPersonId: string;
  memberPersonId: string;
}> {
  ensurePrimaryAssignmentHooksRegistered();
  await seedDataDictionaryFixtures(db);
  await seedPrimaryAssignmentFixtures(db);
  await seedJobReferenceFixtures(db);

  const { middleRoleId, seniorRoleId } = await ensureManagementRoles(db);

  const team = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamActive.code },
  });
  const title = await db.jobTitle.findUnique({
    where: { code: SEED_JOB_REFERENCES.jobTitle.code },
  });
  const ladder = await db.ladder.findUnique({
    where: { code: SEED_JOB_REFERENCES.ladder.code },
  });
  const grade = ladder
    ? await db.grade.findUnique({
        where: {
          ladderId_code: {
            ladderId: ladder.id,
            code: SEED_JOB_REFERENCES.gradeLow.code,
          },
        },
      })
    : null;
  const seniority = await db.seniority.findUnique({
    where: { code: SEED_JOB_REFERENCES.seniority.code },
  });

  if (!team || !title || !ladder || !grade) {
    throw new Error(
      "seedDemoManagementRelationships: org/job-ref fixtures missing",
    );
  }

  const mid = await ensurePersonWithOpenEmployment(
    db,
    SEED_MANAGEMENT_RELATIONSHIPS.middleManagerPerson,
  );
  const snr = await ensurePersonWithOpenEmployment(
    db,
    SEED_MANAGEMENT_RELATIONSHIPS.seniorManagerPerson,
  );

  const member = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  if (!member) {
    throw new Error(
      "seedDemoManagementRelationships: demo member person missing",
    );
  }

  async function ensureManagerPrimary(
    employmentId: string,
    organizationalRoleId: string,
  ): Promise<void> {
    const existing = await listPrimaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    const match = existing.find(
      (p) =>
        p.endDateExclusive === null &&
        p.startDate === SEED_MANAGEMENT_RELATIONSHIPS.activeStart &&
        p.teamId === team!.id &&
        p.organizationalRoleId === organizationalRoleId,
    );
    if (match) return;

    // Clear wrong-shape Primaries for this Employment, then rewrite (atomic).
    await db.$transaction(async (tx) => {
      const client = tx as unknown as PrismaClient;
      await client.primaryAssignment.deleteMany({ where: { employmentId } });
      await applyPrimaryAssignmentProjection(
        {
          employmentId,
          teamId: team!.id,
          organizationalRoleId,
          jobTitleId: title!.id,
          ladderId: ladder!.id,
          gradeId: grade!.id,
          seniorityId: seniority?.id ?? null,
          startDate: SEED_MANAGEMENT_RELATIONSHIPS.activeStart,
          endDateExclusive: null,
        },
        client,
      );
    });
  }

  await ensureManagerPrimary(mid.employmentId, middleRoleId);
  await ensureManagerPrimary(snr.employmentId, seniorRoleId);

  return {
    middleManagerPersonId: mid.personId,
    seniorManagerPersonId: snr.personId,
    memberPersonId: member.id,
  };
}

/** Derived management relationship fixtures (Story 3.9). */
export async function seedManagementRelationshipFixtures(
  db: PrismaClient,
): Promise<void> {
  await seedDemoManagementRelationships(db);
}
