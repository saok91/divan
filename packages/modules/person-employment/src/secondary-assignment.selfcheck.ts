/**
 * Secondary Assignment fidelity selfcheck (Story 3.8 / FR-12).
 * Run: pnpm --filter @divan/person-employment selfcheck:secondary-assignment
 * Requires DATABASE_URL, migrated schema (SecondaryAssignment + EXCLUDE), seeded fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  AR_SECONDARY_INVENTORY,
  EMPLOYMENT_MINIMUM_FACTS,
  OrgUnitError,
  SEED_EMPLOYMENT_LIFECYCLE,
  SEED_JOB_REFERENCES,
  SEED_ORGANIZATION_HIERARCHY,
  SEED_PERSON_IDENTITY,
  SEED_SECONDARY_ASSIGNMENT,
  SecondaryAssignmentError,
  applyEmploymentProjection,
  applySecondaryAssignmentProjection,
  assertReasonTypeInInventory,
  clearJobRefDependencyHooksForTests,
  clearOrgUnitDependencyHooksForTests,
  closeSecondaryAssignmentProjection,
  createOrgUnit,
  createPerson,
  deactivateJobTitle,
  deactivateOrgUnit,
  ensurePrimaryAssignmentHooksRegistered,
  ensureSecondaryAssignmentHooksRegistered,
  getEmploymentById,
  getPersonById,
  getPersonDb,
  getSecondaryAssignmentById,
  listActiveSecondaryAssignmentsAsOf,
  listSecondaryAssignmentsForEmployment,
  listSecondaryAssignmentsForPerson,
  resetPrimaryAssignmentHooksRegistrationForTests,
  resetSecondaryAssignmentHooksRegistrationForTests,
  seedSecondaryAssignmentFixtures,
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

  clearOrgUnitDependencyHooksForTests();
  clearJobRefDependencyHooksForTests();
  resetPrimaryAssignmentHooksRegistrationForTests();
  resetSecondaryAssignmentHooksRegistrationForTests();
  ensurePrimaryAssignmentHooksRegistered();
  ensureSecondaryAssignmentHooksRegistered();

  await seedSecondaryAssignmentFixtures(db);

  // --- Seed shape ---
  const demo = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  assert.ok(demo, "demo person 10001 required");
  const employments = await listSecondaryAssignmentsForPerson(demo.id, db);
  void employments;
  const openEmpRows = await db.employment.findMany({
    where: { personId: demo.id },
  });
  const openEmp = openEmpRows.find((e) => {
    const start = e.startDate.toISOString().slice(0, 10);
    return (
      start === SEED_EMPLOYMENT_LIFECYCLE.activeStart &&
      e.endDateExclusive === null
    );
  });
  assert.ok(openEmp, "open employment");

  const secs = await listSecondaryAssignmentsForEmployment(openEmp!.id, db);
  assert.ok(secs.length >= 3, "seed ≥3 secondaries (hist + 2 concurrent)");
  const openActing = secs.find(
    (s) =>
      s.reasonType === SEED_SECONDARY_ASSIGNMENT.activeReasonType &&
      s.endDateExclusive === null,
  );
  assert.ok(openActing, "open acting_manager secondary");
  const concurrent = secs.find(
    (s) =>
      s.reasonType === SEED_SECONDARY_ASSIGNMENT.concurrentReasonType &&
      s.endDateExclusive === null,
  );
  assert.ok(concurrent, "concurrent cross_dept_support secondary");
  const hist = secs.find(
    (s) =>
      s.startDate === SEED_SECONDARY_ASSIGNMENT.historicalStart &&
      s.endDateExclusive === SEED_SECONDARY_ASSIGNMENT.historicalEndExclusive,
  );
  assert.ok(hist, "historical closed secondary");

  const dept = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.department.code },
  });
  assert.ok(dept);
  assert.equal(dept!.unitType, "DEPARTMENT");
  assert.equal(openActing!.orgUnitId, dept!.id);

  const activeAsOf = await listActiveSecondaryAssignmentsAsOf(
    { personId: demo.id },
    "2025-01-15",
    db,
  );
  assert.ok(activeAsOf.length >= 2, "multiple concurrent actives OK");

  // Inventory stub
  assert.ok(AR_SECONDARY_INVENTORY.includes("acting_manager"));
  assert.equal(assertReasonTypeInInventory("Acting_Manager"), "acting_manager");

  // EMPLOYMENT_MINIMUM_FACTS marks Secondary live
  const secondaryFact = EMPLOYMENT_MINIMUM_FACTS.find(
    (f) => f.fact === "Secondary Assignment (dual-role fidelity)",
  );
  assert.ok(secondaryFact);
  assert.match(secondaryFact!.notes, /3\.8/);
  assert.match(secondaryFact!.notes, /no headcount/i);

  // No headcount columns on Secondary schema
  const sample = await db.secondaryAssignment.findFirst();
  assert.ok(sample);
  assert.equal(
    "headcountApprovalId" in sample!,
    false,
    "no headcountApprovalId on Secondary",
  );

  // Forbidden product verbs
  const pub = await import("./index");
  assert.equal("createSecondaryAssignment" in pub, false);
  assert.equal("assignSecondaryRole" in pub, false);
  assert.equal("endSecondary" in pub, false);
  assert.ok("applySecondaryAssignmentProjection" in pub);

  // No Secondary mutation tRPC/UI surface in this package
  assert.equal(
    typeof (pub as Record<string, unknown>).createSecondaryAssignment,
    "undefined",
  );

  // --- Mutation cases on fresh person ---
  const suffix = randomUUID().slice(0, 8);
  const person = await createPerson(
    {
      personnelCode: `5${suffix.slice(0, 7)}`,
      givenName: "ثانویه",
      familyName: "آزمون",
      mobilePhone: "09126667788",
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
  const seedTeam = await db.organizationalUnit.findUnique({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamActive.code },
  });
  assert.ok(role && title && ladder && gradeLow && seedTeam && dept);

  // Apply within Employment + inventory + DEPARTMENT target (not TEAM-only)
  const first = await applySecondaryAssignmentProjection(
    {
      personId: person.id,
      employmentId: emp.id,
      orgUnitId: dept!.id,
      reasonType: "acting_manager",
      startDate: "2022-01-01",
      endDateExclusive: "2024-01-01",
    },
    db,
  );
  assert.equal(first.orgUnitId, dept!.id);

  // Back-to-back equivalent OK
  const second = await applySecondaryAssignmentProjection(
    {
      personId: person.id,
      employmentId: emp.id,
      orgUnitId: dept!.id,
      reasonType: "acting_manager",
      startDate: "2024-01-01",
      endDateExclusive: null,
    },
    db,
  );
  assert.equal(first.endDateExclusive, second.startDate);

  // Concurrent different reasonType OK
  const otherReason = await applySecondaryAssignmentProjection(
    {
      personId: person.id,
      employmentId: emp.id,
      orgUnitId: dept!.id,
      reasonType: "cross_dept_support",
      organizationalRoleId: role!.id,
      startDate: "2023-01-01",
      endDateExclusive: null,
    },
    db,
  );
  assert.ok(otherReason.id);

  // Concurrent different orgUnit same reason OK
  const otherOrg = await applySecondaryAssignmentProjection(
    {
      personId: person.id,
      employmentId: emp.id,
      orgUnitId: seedTeam!.id,
      reasonType: "acting_manager",
      startDate: "2023-06-01",
      endDateExclusive: null,
    },
    db,
  );
  assert.ok(otherOrg.id);

  // Optional job facts omitted OK (already proven on first)
  // Missing / empty / sentinel reason
  await assert.rejects(
    () =>
      applySecondaryAssignmentProjection(
        {
          personId: person.id,
          employmentId: emp.id,
          orgUnitId: dept!.id,
          reasonType: "",
          startDate: "2030-01-01",
          endDateExclusive: "2031-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof SecondaryAssignmentError &&
      err.code === "SECONDARY_REASON_REQUIRED",
  );
  await assert.rejects(
    () =>
      applySecondaryAssignmentProjection(
        {
          personId: person.id,
          employmentId: emp.id,
          orgUnitId: dept!.id,
          reasonType: "N/A",
          startDate: "2030-01-01",
          endDateExclusive: "2031-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof SecondaryAssignmentError &&
      err.code === "SECONDARY_REASON_REQUIRED",
  );

  // Out of inventory
  await assert.rejects(
    () =>
      applySecondaryAssignmentProjection(
        {
          personId: person.id,
          employmentId: emp.id,
          orgUnitId: dept!.id,
          reasonType: "invented_scenario",
          startDate: "2030-01-01",
          endDateExclusive: "2031-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof SecondaryAssignmentError &&
      err.code === "SECONDARY_REASON_OUT_OF_INVENTORY",
  );

  // Equivalent overlap (domain)
  await assert.rejects(
    () =>
      applySecondaryAssignmentProjection(
        {
          personId: person.id,
          employmentId: emp.id,
          orgUnitId: dept!.id,
          reasonType: "acting_manager",
          startDate: "2024-06-01",
          endDateExclusive: "2025-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof SecondaryAssignmentError &&
      err.code === "OVERLAPPING_EQUIVALENT_SECONDARY",
  );

  // DB EXCLUDE: raw Prisma create overlapping must fail (23P01)
  await assert.rejects(
    () =>
      db.secondaryAssignment.create({
        data: {
          personId: person.id,
          employmentId: emp.id,
          orgUnitId: dept!.id,
          reasonType: "acting_manager",
          startDate: new Date("2024-06-01T00:00:00.000Z"),
          endDateExclusive: new Date("2025-01-01T00:00:00.000Z"),
          updatedAt: new Date(),
        },
      }),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(
        /23P01|exclusion|SecondaryAssignment_equivalent_effective_excl/i.test(
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

  // Outside Employment
  await assert.rejects(
    () =>
      applySecondaryAssignmentProjection(
        {
          personId: person.id,
          employmentId: emp.id,
          orgUnitId: dept!.id,
          reasonType: "acting_manager",
          startDate: "2020-01-01",
          endDateExclusive: "2021-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof SecondaryAssignmentError &&
      err.code === "SECONDARY_OUTSIDE_EMPLOYMENT",
  );

  // personId mismatch
  const otherPerson = await createPerson(
    {
      personnelCode: `4${suffix.slice(0, 7)}`,
      givenName: "ناهمخوان",
      familyName: "آزمون",
      mobilePhone: "09127778899",
    },
    { accountId: "selfcheck", correlationId: randomUUID() },
    db,
  );
  await assert.rejects(
    () =>
      applySecondaryAssignmentProjection(
        {
          personId: otherPerson.id,
          employmentId: emp.id,
          orgUnitId: dept!.id,
          reasonType: "acting_manager",
          startDate: "2030-01-01",
          endDateExclusive: "2031-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof SecondaryAssignmentError &&
      err.code === "SECONDARY_PERSON_MISMATCH",
  );

  // Grade + Ladder mismatch when both set
  const otherLadder = await db.ladder.create({
    data: {
      code: `LAD-SEC-${suffix}`,
      nameFa: "لدر ثانویه آزمون",
      startDate: new Date("2019-01-01T00:00:00.000Z"),
      updatedAt: new Date(),
    },
  });
  const otherGrade = await db.grade.create({
    data: {
      code: "G-SEC",
      nameFa: "گرید بیگانه",
      ladderId: otherLadder.id,
      rank: "1.0",
      startDate: new Date("2019-01-01T00:00:00.000Z"),
      updatedAt: new Date(),
    },
  });
  await assert.rejects(
    () =>
      applySecondaryAssignmentProjection(
        {
          personId: person.id,
          employmentId: emp.id,
          orgUnitId: dept!.id,
          reasonType: "cross_dept_support",
          ladderId: ladder!.id,
          gradeId: otherGrade.id,
          startDate: "2030-01-01",
          endDateExclusive: "2031-01-01",
        },
        db,
      ),
    (err: unknown) =>
      err instanceof SecondaryAssignmentError &&
      err.code === "GRADE_NOT_IN_LADDER",
  );

  // Update on already-closed rejected
  await assert.rejects(
    () =>
      applySecondaryAssignmentProjection(
        {
          id: first.id,
          personId: person.id,
          employmentId: emp.id,
          orgUnitId: dept!.id,
          reasonType: "acting_manager",
          startDate: first.startDate,
          endDateExclusive: first.endDateExclusive,
        },
        db,
      ),
    (err: unknown) =>
      err instanceof SecondaryAssignmentError &&
      err.code === "SECONDARY_ALREADY_CLOSED",
  );

  // Close then second close fails; Person/Employment still readable
  const closed = await closeSecondaryAssignmentProjection(
    second.id,
    "2026-06-01",
    db,
  );
  assert.equal(closed.endDateExclusive, "2026-06-01");
  await assert.rejects(
    () => closeSecondaryAssignmentProjection(second.id, "2026-07-01", db),
    (err: unknown) =>
      err instanceof SecondaryAssignmentError &&
      err.code === "SECONDARY_ALREADY_CLOSED",
  );
  assert.ok(await getPersonById(person.id, db));
  assert.ok(await getEmploymentById(emp.id, db));
  assert.ok(await getSecondaryAssignmentById(first.id, db));

  // --- Dependency hooks ---
  const hookSuffix = randomUUID().slice(0, 8);
  const hookPerson = await createPerson(
    {
      personnelCode: `3${hookSuffix.slice(0, 7)}`,
      givenName: "قلاب",
      familyName: "ثانویه",
      mobilePhone: "09128889900",
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

  const hookUnit = await createOrgUnit(
    {
      code: `DEPT-SEC-${hookSuffix}`,
      nameFa: "دپارتمان آزمون ثانویه",
      unitType: "DEPARTMENT",
      parentId: (
        await db.organizationalUnit.findUnique({
          where: { code: SEED_ORGANIZATION_HIERARCHY.businessUnit.code },
        })
      )!.id,
      startDate: "2023-01-01",
    },
    db,
  );

  const hookTitle = await db.jobTitle.create({
    data: {
      code: `JT-SEC-${hookSuffix}`,
      nameFa: "عنوان آزمون ثانویه",
      startDate: new Date("2023-01-01T00:00:00.000Z"),
      updatedAt: new Date(),
    },
  });

  const hookSec = await applySecondaryAssignmentProjection(
    {
      personId: hookPerson.id,
      employmentId: hookEmp.id,
      orgUnitId: hookUnit.id,
      reasonType: "acting_manager",
      jobTitleId: hookTitle.id,
      startDate: "2023-01-01",
      endDateExclusive: null,
    },
    db,
  );

  await assert.rejects(
    () => deactivateOrgUnit(hookUnit.id, "2030-01-01", db),
    (err: unknown) =>
      err instanceof OrgUnitError &&
      err.code === "DEACTIVATION_BLOCKED_DEPENDENCIES",
  );

  await assert.rejects(
    () => deactivateJobTitle(hookTitle.id, "2030-01-01", db),
    (err: unknown) =>
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "DEACTIVATION_BLOCKED_DEPENDENCIES",
  );

  await closeSecondaryAssignmentProjection(hookSec.id, "2025-12-01", db);

  // After close, deactivate allowed
  await deactivateOrgUnit(hookUnit.id, "2030-01-01", db);
  await deactivateJobTitle(hookTitle.id, "2030-01-01", db);

  console.log("secondary-assignment selfcheck: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
