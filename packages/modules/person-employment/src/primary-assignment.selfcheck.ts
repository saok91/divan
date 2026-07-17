/**
 * Primary Assignment integrity selfcheck (Story 3.7 / FR-11).
 * Run: pnpm --filter @divan/person-employment selfcheck:primary-assignment
 * Requires DATABASE_URL, migrated schema (PrimaryAssignment + EXCLUDE), seeded fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  EMPLOYMENT_MINIMUM_FACTS,
  OrgUnitError,
  PrimaryAssignmentError,
  SEED_EMPLOYMENT_LIFECYCLE,
  SEED_JOB_REFERENCES,
  SEED_ORGANIZATION_HIERARCHY,
  SEED_PERSON_IDENTITY,
  applyEmploymentProjection,
  applyPrimaryAssignmentProjection,
  assertExactlyOneActivePrimaryAsOf,
  assertPrimaryCoverageForActiveEmployment,
  clearJobRefDependencyHooksForTests,
  clearOrgUnitDependencyHooksForTests,
  closePrimaryAssignmentProjection,
  createOrgUnit,
  createPerson,
  deactivateJobTitle,
  deactivateOrgUnit,
  ensurePrimaryAssignmentHooksRegistered,
  getActivePrimaryAssignmentAsOf,
  getEmploymentById,
  getPersonById,
  getPersonDb,
  getPrimaryAssignmentById,
  isEmploymentActiveAsOf,
  listEmploymentsForPerson,
  listPrimaryAssignmentsForEmployment,
  resetPrimaryAssignmentHooksRegistrationForTests,
  resolveTeamMembershipAsOf,
  seedPrimaryAssignmentFixtures,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();

  // Fresh hook registration for this process
  clearOrgUnitDependencyHooksForTests();
  clearJobRefDependencyHooksForTests();
  resetPrimaryAssignmentHooksRegistrationForTests();
  ensurePrimaryAssignmentHooksRegistered();

  await seedPrimaryAssignmentFixtures(db);

  // --- Seed shape: open Primary covering open Employment ---
  const demo = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  assert.ok(demo, "demo person 10001 required");
  const employments = await listEmploymentsForPerson(demo.id, db);
  const openEmp = employments.find(
    (e) =>
      e.startDate === SEED_EMPLOYMENT_LIFECYCLE.activeStart &&
      e.endDateExclusive === null,
  );
  const histEmp = employments.find(
    (e) =>
      e.startDate === SEED_EMPLOYMENT_LIFECYCLE.historicalStart &&
      e.endDateExclusive === SEED_EMPLOYMENT_LIFECYCLE.historicalEndExclusive,
  );
  assert.ok(openEmp, "open employment");
  assert.ok(histEmp, "historical employment");

  const openPrimaries = await listPrimaryAssignmentsForEmployment(
    openEmp!.id,
    db,
  );
  assert.ok(openPrimaries.length >= 1, "seed ≥1 open primary");
  const openPrimary = openPrimaries.find((p) => p.endDateExclusive === null);
  assert.ok(openPrimary, "open primary on active employment");
  assert.equal(openPrimary!.startDate, SEED_EMPLOYMENT_LIFECYCLE.activeStart);
  assertPrimaryCoverageForActiveEmployment(openEmp!, openPrimaries);

  const histPrimaries = await listPrimaryAssignmentsForEmployment(
    histEmp!.id,
    db,
  );
  assert.ok(histPrimaries.length >= 1, "historical primary seeded");
  assertPrimaryCoverageForActiveEmployment(histEmp!, histPrimaries);

  // Team membership as-of
  const membership = await resolveTeamMembershipAsOf(demo.id, "2025-06-15", db);
  assert.ok(membership);
  assert.equal(membership!.teamId, openPrimary!.teamId);
  assert.equal(membership!.employmentId, openEmp!.id);

  const team = await db.organizationalUnit.findUnique({
    where: { id: openPrimary!.teamId },
  });
  assert.ok(team);
  assert.equal(team!.unitType, "TEAM");
  assert.equal(team!.code, SEED_ORGANIZATION_HIERARCHY.teamActive.code);

  // Exactly one active when Employment active
  assertExactlyOneActivePrimaryAsOf(
    openPrimaries,
    "2025-06-15",
    isEmploymentActiveAsOf(openEmp!, "2025-06-15"),
  );
  const activePa = await getActivePrimaryAssignmentAsOf(
    openEmp!.id,
    "2025-06-15",
    db,
  );
  assert.ok(activePa);
  assert.equal(activePa!.id, openPrimary!.id);

  // EMPLOYMENT_MINIMUM_FACTS marks Primary live
  const exactlyOne = EMPLOYMENT_MINIMUM_FACTS.find(
    (f) => f.fact === "Exactly one active Primary Assignment",
  );
  assert.ok(exactlyOne);
  assert.match(exactlyOne!.notes, /3\.7/);
  assert.match(exactlyOne!.notes, /Epic 4/);

  // Forbidden product verbs must not exist on public API
  const pub = await import("./index");
  assert.equal(
    "createPrimaryAssignment" in pub,
    false,
    "must not export createPrimaryAssignment",
  );
  assert.equal(
    "transferPrimary" in pub,
    false,
    "must not export transferPrimary",
  );
  assert.equal(
    "assignPersonToTeam" in pub,
    false,
    "must not export assignPersonToTeam",
  );
  assert.ok("applyPrimaryAssignmentProjection" in pub);

  // Default: no Start/Transfer product mutation surface in this package
  assert.equal(
    typeof (pub as Record<string, unknown>).startEmployment,
    "undefined",
  );

  // --- Mutation cases on fresh person ---
  const suffix = randomUUID().slice(0, 8);
  const person = await createPerson(
    {
      personnelCode: `8${suffix.slice(0, 7)}`,
      givenName: "تخصیص",
      familyName: "آزمون",
      mobilePhone: "09123334455",
    },
    { accountId: "selfcheck", correlationId: randomUUID() },
    db,
  );

  const emp = await applyEmploymentProjection(
    {
      personId: person.id,
      startDate: "2022-01-01",
      endDateExclusive: null,
      collaborationType: "employee",
    },
    db,
  );

  const role = await db.organizationalRole.findUnique({
    where: { code: SEED_JOB_REFERENCES.role.code },
  });
  const title = await db.jobTitle.findUnique({
    where: { code: SEED_JOB_REFERENCES.jobTitle.code },
  });
  const ladder = await db.ladder.findUnique({
    where: { code: SEED_JOB_REFERENCES.ladder.code },
  });
  const gradeLow = ladder
    ? await db.grade.findUnique({
        where: {
          ladderId_code: {
            ladderId: ladder.id,
            code: SEED_JOB_REFERENCES.gradeLow.code,
          },
        },
      })
    : null;
  const gradeHigh = ladder
    ? await db.grade.findUnique({
        where: {
          ladderId_code: {
            ladderId: ladder.id,
            code: SEED_JOB_REFERENCES.gradeHigh.code,
          },
        },
      })
    : null;
  const seedTeam = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamActive.code },
  });
  assert.ok(role && title && ladder && gradeLow && gradeHigh && seedTeam);

  // Apply covering open Employment (seniority omitted)
  const first = await applyPrimaryAssignmentProjection(
    {
      employmentId: emp.id,
      teamId: seedTeam!.id,
      organizationalRoleId: role!.id,
      jobTitleId: title!.id,
      ladderId: ladder!.id,
      gradeId: gradeLow!.id,
      startDate: "2022-01-01",
      endDateExclusive: "2024-01-01",
    },
    db,
  );
  const second = await applyPrimaryAssignmentProjection(
    {
      employmentId: emp.id,
      teamId: seedTeam!.id,
      organizationalRoleId: role!.id,
      jobTitleId: title!.id,
      ladderId: ladder!.id,
      gradeId: gradeHigh!.id,
      startDate: "2024-01-01",
      endDateExclusive: null,
    },
    db,
  );
  assert.equal(first.endDateExclusive, second.startDate, "back-to-back OK");
  assertPrimaryCoverageForActiveEmployment(emp, [first, second]);

  // Overlapping Primary rejected (domain)
  await assert.rejects(
    () =>
      applyPrimaryAssignmentProjection(
        {
          employmentId: emp.id,
          teamId: seedTeam!.id,
          organizationalRoleId: role!.id,
          jobTitleId: title!.id,
          ladderId: ladder!.id,
          gradeId: gradeLow!.id,
          startDate: "2023-06-01",
          endDateExclusive: "2024-06-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof PrimaryAssignmentError &&
      err.code === "OVERLAPPING_PRIMARY_ASSIGNMENT",
  );

  // DB EXCLUDE: raw Prisma create overlapping must fail (23P01), even if domain bypassed
  await assert.rejects(
    () =>
      db.primaryAssignment.create({
        data: {
          employmentId: emp.id,
          teamId: seedTeam!.id,
          organizationalRoleId: role!.id,
          jobTitleId: title!.id,
          ladderId: ladder!.id,
          gradeId: gradeLow!.id,
          startDate: new Date("2023-06-01T00:00:00.000Z"),
          endDateExclusive: new Date("2024-06-01T00:00:00.000Z"),
        },
      }),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(
        /23P01|exclusion|PrimaryAssignment_employment_effective_excl/i.test(
          msg,
        ) ||
          (typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: unknown }).code === "23P01"),
        `expected exclusion violation, got: ${msg}`,
      );
      return true;
    },
  );

  // Apply update on closed Primary rejected
  await assert.rejects(
    () =>
      applyPrimaryAssignmentProjection(
        {
          id: first.id,
          employmentId: emp.id,
          teamId: seedTeam!.id,
          organizationalRoleId: role!.id,
          jobTitleId: title!.id,
          ladderId: ladder!.id,
          gradeId: gradeLow!.id,
          startDate: first.startDate,
          endDateExclusive: first.endDateExclusive,
        },
        db,
      ),
    (err: unknown) =>
      err instanceof PrimaryAssignmentError &&
      err.code === "PRIMARY_ALREADY_CLOSED",
  );

  // Outside Employment
  await assert.rejects(
    () =>
      applyPrimaryAssignmentProjection(
        {
          employmentId: emp.id,
          teamId: seedTeam!.id,
          organizationalRoleId: role!.id,
          jobTitleId: title!.id,
          ladderId: ladder!.id,
          gradeId: gradeLow!.id,
          startDate: "2020-01-01",
          endDateExclusive: "2021-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof PrimaryAssignmentError &&
      err.code === "PRIMARY_OUTSIDE_EMPLOYMENT",
  );

  // Coverage gap
  const gapPerson = await createPerson(
    {
      personnelCode: `9${suffix.slice(0, 7)}`,
      givenName: "شکاف",
      familyName: "آزمون",
      mobilePhone: "09124445566",
    },
    { accountId: "selfcheck", correlationId: randomUUID() },
    db,
  );
  const gapEmp = await applyEmploymentProjection(
    {
      personId: gapPerson.id,
      startDate: "2021-01-01",
      endDateExclusive: null,
      collaborationType: "employee",
    },
    db,
  );
  const gapOnly = await applyPrimaryAssignmentProjection(
    {
      employmentId: gapEmp.id,
      teamId: seedTeam!.id,
      organizationalRoleId: role!.id,
      jobTitleId: title!.id,
      ladderId: ladder!.id,
      gradeId: gradeLow!.id,
      startDate: "2022-01-01",
      endDateExclusive: null,
    },
    db,
  );
  assert.throws(
    () => assertPrimaryCoverageForActiveEmployment(gapEmp, [gapOnly]),
    (err: unknown) =>
      err instanceof PrimaryAssignmentError &&
      err.code === "PRIMARY_COVERAGE_GAP",
  );

  // Read model: active Employment with zero Primaries → null (not throw)
  const barePerson = await createPerson(
    {
      personnelCode: `7${suffix.slice(0, 7)}`,
      givenName: "بدون",
      familyName: "تخصیص",
      mobilePhone: "09125556677",
    },
    { accountId: "selfcheck", correlationId: randomUUID() },
    db,
  );
  await applyEmploymentProjection(
    {
      personId: barePerson.id,
      startDate: "2021-01-01",
      endDateExclusive: null,
      collaborationType: "employee",
    },
    db,
  );
  const bareMembership = await resolveTeamMembershipAsOf(
    barePerson.id,
    "2025-01-01",
    db,
  );
  assert.equal(bareMembership, null);

  // Zero Primaries under active Employment
  assert.throws(
    () => assertExactlyOneActivePrimaryAsOf([], "2025-01-01", true),
    (err: unknown) =>
      err instanceof PrimaryAssignmentError &&
      err.code === "PRIMARY_ASSIGNMENT_REQUIRED",
  );

  // TEAM_UNIT_REQUIRED — create a DEPARTMENT and try
  const dept = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.department.code },
  });
  assert.ok(dept);
  await assert.rejects(
    () =>
      applyPrimaryAssignmentProjection(
        {
          employmentId: emp.id,
          teamId: dept!.id,
          organizationalRoleId: role!.id,
          jobTitleId: title!.id,
          ladderId: ladder!.id,
          gradeId: gradeLow!.id,
          startDate: "2030-01-01",
          endDateExclusive: "2031-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof PrimaryAssignmentError &&
      err.code === "TEAM_UNIT_REQUIRED",
  );

  // GRADE_NOT_IN_LADDER — create another ladder+grade then mismatch
  const otherLadder = await db.ladder.create({
    data: {
      code: `LAD-SC-${suffix}`,
      nameFa: "لدر آزمون",
      startDate: new Date("2019-01-01T00:00:00.000Z"),
      updatedAt: new Date(),
    },
  });
  const otherGrade = await db.grade.create({
    data: {
      code: "G-X",
      nameFa: "گرید بیگانه",
      ladderId: otherLadder.id,
      rank: "1.0",
      startDate: new Date("2019-01-01T00:00:00.000Z"),
      updatedAt: new Date(),
    },
  });
  await assert.rejects(
    () =>
      applyPrimaryAssignmentProjection(
        {
          employmentId: emp.id,
          teamId: seedTeam!.id,
          organizationalRoleId: role!.id,
          jobTitleId: title!.id,
          ladderId: ladder!.id,
          gradeId: otherGrade.id,
          startDate: "2030-01-01",
          endDateExclusive: "2031-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof PrimaryAssignmentError &&
      err.code === "GRADE_NOT_IN_LADDER",
  );

  // Close then second close fails; Person/Employment still readable
  const closed = await closePrimaryAssignmentProjection(
    second.id,
    "2026-06-01",
    db,
  );
  assert.equal(closed.endDateExclusive, "2026-06-01");
  await assert.rejects(
    () => closePrimaryAssignmentProjection(second.id, "2026-07-01", db),
    (err: unknown) =>
      err instanceof PrimaryAssignmentError &&
      err.code === "PRIMARY_ALREADY_CLOSED",
  );
  const personStill = await getPersonById(person.id, db);
  assert.ok(personStill);
  const empStill = await getEmploymentById(emp.id, db);
  assert.ok(empStill);
  const byId = await getPrimaryAssignmentById(first.id, db);
  assert.ok(byId);

  // --- Dependency hooks: deactivate Team / JobTitle while open Primary ---
  const hookSuffix = randomUUID().slice(0, 8);
  const hookPerson = await createPerson(
    {
      personnelCode: `6${hookSuffix.slice(0, 7)}`,
      givenName: "قلاب",
      familyName: "آزمون",
      mobilePhone: "09125556677",
    },
    { accountId: "selfcheck", correlationId: randomUUID() },
    db,
  );
  const hookEmp = await applyEmploymentProjection(
    {
      personId: hookPerson.id,
      startDate: "2023-01-01",
      endDateExclusive: null,
      collaborationType: "employee",
    },
    db,
  );

  // Dedicated Team under demo dept for deactivate test
  const hookTeam = await createOrgUnit(
    {
      code: `TEAM-SC-${hookSuffix}`,
      nameFa: "تیم آزمون قلاب",
      unitType: "TEAM",
      parentId: dept!.id,
      startDate: "2023-01-01",
    },
    db,
  );

  // Dedicated JobTitle for deactivate test
  const hookTitle = await db.jobTitle.create({
    data: {
      code: `JT-SC-${hookSuffix}`,
      nameFa: "عنوان آزمون قلاب",
      startDate: new Date("2020-01-01T00:00:00.000Z"),
      updatedAt: new Date(),
    },
  });

  const hookPrimary = await applyPrimaryAssignmentProjection(
    {
      employmentId: hookEmp.id,
      teamId: hookTeam.id,
      organizationalRoleId: role!.id,
      jobTitleId: hookTitle.id,
      ladderId: ladder!.id,
      gradeId: gradeLow!.id,
      startDate: "2023-01-01",
      endDateExclusive: null,
    },
    db,
  );

  await assert.rejects(
    () => deactivateOrgUnit(hookTeam.id, "2026-01-01", db),
    (err: unknown) =>
      err instanceof OrgUnitError &&
      err.code === "DEACTIVATION_BLOCKED_DEPENDENCIES",
  );

  await assert.rejects(
    () => deactivateJobTitle(hookTitle.id, "2026-01-01", db),
    (err: unknown) =>
      (err as { code?: string }).code === "DEACTIVATION_BLOCKED_DEPENDENCIES",
  );

  await closePrimaryAssignmentProjection(hookPrimary.id, "2025-12-01", db);

  // After close — deactivate allowed
  await deactivateOrgUnit(hookTeam.id, "2026-01-01", db);
  await deactivateJobTitle(hookTitle.id, "2026-01-01", db);

  // Cleanup ephemeral ladder/grade
  await db.grade.delete({ where: { id: otherGrade.id } });
  await db.ladder.delete({ where: { id: otherLadder.id } });

  console.log("selfcheck:primary-assignment OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
