/**
 * Job / level personnel events selfcheck (Story 4.8 / FR-23).
 * Run: pnpm --filter @divan/person-employment selfcheck:personnel-event-job-level
 * Requires DATABASE_URL, migrated schema, seeded accounts + org/job fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { createPgPool } from "@divan/db";
import {
  ensureHeadcountCapacitySchema,
  seedCapacitySlot,
  seedDemoHeadcountCapacity,
} from "@divan/headcount";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  cancelPersonnelEvent,
  createDraft,
  createGrade,
  createJobTitle,
  createLadder,
  createOrgUnit,
  createPerson,
  finalizeDraft,
  getActivePrimaryAssignmentAsOf,
  getPersonDb,
  listEmploymentsForPerson,
  listPrimaryAssignmentsForEmployment,
  resetProjectionRefreshHook,
  seedPrimaryAssignmentFixtures,
  SEED_EMPLOYMENT_LIFECYCLE,
  SEED_JOB_REFERENCES,
  SEED_ORGANIZATION_HIERARCHY,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

function addDays(dateOnly: string, days: number): string {
  const [ys, ms, ds] = dateOnly.split("-");
  const dt = new Date(Date.UTC(Number(ys), Number(ms) - 1, Number(ds)));
  dt.setUTCDate(dt.getUTCDate() + days);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function resolveJobRefs(db: ReturnType<typeof getPersonDb>) {
  const role = await db.organizationalRole.findUniqueOrThrow({
    where: { code: SEED_JOB_REFERENCES.role.code },
  });
  const title = await db.jobTitle.findUniqueOrThrow({
    where: { code: SEED_JOB_REFERENCES.jobTitle.code },
  });
  const ladder = await db.ladder.findUniqueOrThrow({
    where: { code: SEED_JOB_REFERENCES.ladder.code },
  });
  const gradeLow = await db.grade.findUniqueOrThrow({
    where: {
      ladderId_code: {
        ladderId: ladder.id,
        code: SEED_JOB_REFERENCES.gradeLow.code,
      },
    },
  });
  const gradeHalf = await db.grade.findUniqueOrThrow({
    where: {
      ladderId_code: {
        ladderId: ladder.id,
        code: SEED_JOB_REFERENCES.gradeHalf.code,
      },
    },
  });
  const gradeHigh = await db.grade.findUniqueOrThrow({
    where: {
      ladderId_code: {
        ladderId: ladder.id,
        code: SEED_JOB_REFERENCES.gradeHigh.code,
      },
    },
  });
  const seniority = await db.seniority.findUniqueOrThrow({
    where: { code: SEED_JOB_REFERENCES.seniority.code },
  });
  return {
    organizationalRoleId: role.id,
    jobTitleId: title.id,
    ladderId: ladder.id,
    gradeId: gradeLow.id,
    gradeLowId: gradeLow.id,
    gradeHalfId: gradeHalf.id,
    gradeHighId: gradeHigh.id,
    seniorityId: seniority.id,
  };
}

async function slotCounts(
  pool: ReturnType<typeof createPgPool>,
  slotId: string,
): Promise<{ free: number; reserved: number }> {
  const r = await pool.query<{ free_units: number; reserved_units: number }>(
    `SELECT free_units, reserved_units FROM headcount_capacity_slot WHERE id = $1::uuid`,
    [slotId],
  );
  const row = r.rows[0]!;
  return {
    free: Number(row.free_units),
    reserved: Number(row.reserved_units),
  };
}

async function reservationStatus(
  pool: ReturnType<typeof createPgPool>,
  eventId: string,
): Promise<string | null> {
  const r = await pool.query<{ status: string }>(
    `SELECT status FROM headcount_capacity_reservation WHERE event_id = $1::uuid`,
    [eventId],
  );
  return r.rows[0]?.status ?? null;
}

async function consumptionCount(
  pool: ReturnType<typeof createPgPool>,
  eventId: string,
): Promise<number> {
  const r = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM headcount_capacity_consumption
     WHERE event_id = $1::uuid AND release_event_id IS NULL`,
    [eventId],
  );
  return Number(r.rows[0]?.c ?? 0);
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();
  const pool = createPgPool(url);
  resetProjectionRefreshHook();

  await seedPrimaryAssignmentFixtures(db);
  await ensureHeadcountCapacitySchema(pool);
  await seedDemoHeadcountCapacity(db, pool);
  const jobRefs = await resolveJobRefs(db);

  const sourceTeam = await db.organizationalUnit.findUniqueOrThrow({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamActive.code },
  });
  const dept = await db.organizationalUnit.findUniqueOrThrow({
    where: { code: SEED_ORGANIZATION_HIERARCHY.department.code },
  });

  const operator =
    (await db.internalAccount.findUnique({ where: { username: "hr.operator" } }))
      ?.id ?? "selfcheck-operator";
  const admin =
    (await db.internalAccount.findUnique({ where: { username: "hr.admin" } }))
      ?.id ?? "selfcheck-admin";

  const suffix = randomUUID().slice(0, 8);
  const today = todayDateOnlyTehran();
  const startEd = addDays(today, -30);
  const gradeEd = addDays(today, -20);
  const titleEd = addDays(today, -10);
  const promoEd = addDays(today, -5);
  const future = addDays(today, 45);

  // Dedicated slots — avoid racing seedDemoHeadcountCapacity with parallel selfchecks
  const sourceSlotId = await seedCapacitySlot(pool, {
    id: randomUUID(),
    teamId: sourceTeam.id,
    jobTitleId: jobRefs.jobTitleId,
    ladderId: jobRefs.ladderId,
    gradeId: jobRefs.gradeId,
    startDate: "2020-01-01",
    freeUnits: 10,
    label: `jl-source-${suffix}`,
  });

  const otherTeam = await createOrgUnit(
    {
      code: `TEAM-JL-${suffix}`,
      nameFa: "تیم دیگر سطح شغلی",
      unitType: "TEAM",
      parentId: dept.id,
      startDate: "2020-01-01",
    },
    db,
  );

  const otherLadder = await createLadder(
    {
      code: `LAD-JL-${suffix}`,
      nameFa: "لدر ایزوله سطح شغلی",
      startDate: "2020-01-01",
    },
    db,
  );
  const otherGrade = await createGrade(
    {
      code: `G-JL-${suffix}`,
      nameFa: "گرید ایزوله",
      ladderId: otherLadder.id,
      rank: "1.0",
      startDate: "2020-01-01",
    },
    db,
  );

  const newTitle = await createJobTitle(
    {
      code: `JT-JL-${suffix}`,
      nameFa: "عنوان شغلی جدید",
      startDate: "2020-01-01",
    },
    db,
  );
  const newTitleSlotId = await seedCapacitySlot(pool, {
    id: randomUUID(),
    teamId: sourceTeam.id,
    jobTitleId: newTitle.id,
    ladderId: jobRefs.ladderId,
    gradeId: jobRefs.gradeHalfId,
    startDate: "2020-01-01",
    freeUnits: 5,
    label: `job-level-title-${suffix}`,
  });

  const futureTitle = await createJobTitle(
    {
      code: `JT-FUT-${suffix}`,
      nameFa: "عنوان آینده",
      startDate: "2020-01-01",
    },
    db,
  );
  const futureTitleSlotId = await seedCapacitySlot(pool, {
    id: randomUUID(),
    teamId: sourceTeam.id,
    jobTitleId: futureTitle.id,
    ladderId: jobRefs.ladderId,
    gradeId: jobRefs.gradeHalfId,
    startDate: "2020-01-01",
    freeUnits: 5,
    label: `job-level-future-${suffix}`,
  });

  try {
    // --- 1. Setup: Start Employment ---
    const person = await createPerson(
      {
        personnelCode: `58${suffix.slice(0, 4)}`,
        givenName: "آزمایش",
        familyName: "سطح‌شغلی",
        mobilePhone: "09125800001",
      },
      { accountId: operator, correlationId: `sc-jl-${suffix}` },
      db,
    );

    const startDraft = await createDraft(
      {
        personId: person.id,
        eventType: "EmploymentStarted",
        effectiveDate: startEd,
        payload: {
          collaborationType: SEED_EMPLOYMENT_LIFECYCLE.collaborationActive,
          teamId: sourceTeam.id,
          ...jobRefs,
          capacitySlotId: sourceSlotId,
        },
      },
      { accountId: operator },
      db,
    );
    const startFin = await finalizeDraft(
      {
        draftId: startDraft.id,
        actorId: operator,
        expectedVersion: startDraft.version,
        idempotencyKey: `jl-start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(startFin.outcome, "finalized");
    const emps = await listEmploymentsForPerson(person.id, db);
    assert.equal(emps.length, 1);
    const employmentId = emps[0]!.id;

    const primariesAfterStart = await listPrimaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    assert.equal(primariesAfterStart.length, 1);
    const sourceFreeBefore = (await slotCounts(pool, sourceSlotId)).free;

    // --- 2. GradeChanged Effective → successor Primary; capacity unchanged ---
    const gradeDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "GradeChanged",
        effectiveDate: gradeEd,
        payload: { gradeId: jobRefs.gradeHalfId },
      },
      { accountId: operator },
      db,
    );
    const gradeFin = await finalizeDraft(
      {
        draftId: gradeDraft.id,
        actorId: operator,
        expectedVersion: gradeDraft.version,
        idempotencyKey: `jl-grade-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(gradeFin.outcome, "finalized");
    assert.ok(gradeFin.outcome === "finalized" && gradeFin.status === "Effective");
    const gradeEventId =
      gradeFin.outcome === "finalized" ? gradeFin.eventId : "";

    const primariesAfterGrade = await listPrimaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    assert.equal(primariesAfterGrade.length, 2);
    const gradeSuccessor = primariesAfterGrade.find(
      (p) => p.sourceEventId === gradeEventId,
    );
    assert.ok(gradeSuccessor);
    assert.equal(gradeSuccessor!.gradeId, jobRefs.gradeHalfId);
    assert.equal(gradeSuccessor!.endDateExclusive, null);
    const gradeClosed = primariesAfterGrade.find(
      (p) => p.endDateExclusive === gradeEd,
    );
    assert.ok(gradeClosed);
    assert.equal(
      await consumptionCount(pool, gradeEventId),
      0,
      "Grade-only must not create capacity consumption for the grade event",
    );
    assert.equal(
      (await slotCounts(pool, sourceSlotId)).free,
      sourceFreeBefore,
      "Grade-only must not mutate capacity free units on dedicated slot",
    );

    // --- 3. Grade no-op → JOB_FACTS_NOOP reject ---
    const gradeNoopDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "GradeChanged",
        effectiveDate: gradeEd,
        payload: { gradeId: jobRefs.gradeHalfId },
      },
      { accountId: operator },
      db,
    );
    const gradeNoopFin = await finalizeDraft(
      {
        draftId: gradeNoopDraft.id,
        actorId: operator,
        expectedVersion: gradeNoopDraft.version,
      },
      pool,
      db,
    );
    assert.equal(gradeNoopFin.outcome, "rejected");
    if (gradeNoopFin.outcome === "rejected") {
      assert.ok(gradeNoopFin.conflicts.some((c) => c.code === "JOB_FACTS_NOOP"));
    }
    assert.equal(
      (await listPrimaryAssignmentsForEmployment(employmentId, db)).length,
      2,
    );

    // --- 4. LadderChanged invalid grade → LADDER_GRADE_INVALID reject ---
    const ladderDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "LadderChanged",
        effectiveDate: gradeEd,
        payload: {
          ladderId: jobRefs.ladderId,
          gradeId: otherGrade.id,
        },
      },
      { accountId: operator },
      db,
    );
    const ladderFin = await finalizeDraft(
      {
        draftId: ladderDraft.id,
        actorId: operator,
        expectedVersion: ladderDraft.version,
      },
      pool,
      db,
    );
    assert.equal(ladderFin.outcome, "rejected");
    if (ladderFin.outcome === "rejected") {
      assert.ok(
        ladderFin.conflicts.some((c) => c.code === "LADDER_GRADE_INVALID"),
      );
    }

    // --- 5. JobTitleChanged Effective → Primary successor + capacity move ---
    const titleSlotBefore = await slotCounts(pool, newTitleSlotId);
    const titleDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "JobTitleChanged",
        effectiveDate: titleEd,
        payload: {
          jobTitleId: newTitle.id,
          capacitySlotId: newTitleSlotId,
        },
      },
      { accountId: operator },
      db,
    );
    const titleFin = await finalizeDraft(
      {
        draftId: titleDraft.id,
        actorId: operator,
        expectedVersion: titleDraft.version,
        idempotencyKey: `jl-title-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(titleFin.outcome, "finalized");
    assert.ok(titleFin.outcome === "finalized" && titleFin.status === "Effective");
    const titleEventId =
      titleFin.outcome === "finalized" ? titleFin.eventId : "";

    const primariesAfterTitle = await listPrimaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    assert.equal(primariesAfterTitle.length, 3);
    const titleSuccessor = primariesAfterTitle.find(
      (p) => p.sourceEventId === titleEventId,
    );
    assert.ok(titleSuccessor);
    assert.equal(titleSuccessor!.jobTitleId, newTitle.id);
    assert.equal(await consumptionCount(pool, titleEventId), 1);
    const titleSlotAfter = await slotCounts(pool, newTitleSlotId);
    assert.equal(titleSlotAfter.free, titleSlotBefore.free - 1);

    // --- 6. OrganizationalRoleChanged with foreign teamId → USE_TRANSFER reject ---
    const roleDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "OrganizationalRoleChanged",
        effectiveDate: titleEd,
        payload: {
          organizationalRoleId: jobRefs.organizationalRoleId,
          teamId: otherTeam.id,
        },
      },
      { accountId: operator },
      db,
    );
    const roleFin = await finalizeDraft(
      {
        draftId: roleDraft.id,
        actorId: operator,
        expectedVersion: roleDraft.version,
      },
      pool,
      db,
    );
    assert.equal(roleFin.outcome, "rejected");
    if (roleFin.outcome === "rejected") {
      assert.ok(roleFin.conflicts.some((c) => c.code === "USE_TRANSFER"));
    }

    // --- 7. Scheduled JobTitleChanged → reserve only; Cancel releases ---
    const futureSlotBefore = await slotCounts(pool, futureTitleSlotId);
    const schedTitleDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "JobTitleChanged",
        effectiveDate: future,
        payload: {
          jobTitleId: futureTitle.id,
          capacitySlotId: futureTitleSlotId,
        },
      },
      { accountId: operator },
      db,
    );
    const schedTitleFin = await finalizeDraft(
      {
        draftId: schedTitleDraft.id,
        actorId: operator,
        expectedVersion: schedTitleDraft.version,
        idempotencyKey: `jl-sched-title-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(schedTitleFin.outcome, "finalized");
    assert.ok(
      schedTitleFin.outcome === "finalized" &&
        schedTitleFin.status === "Scheduled",
    );
    const schedTitleEventId =
      schedTitleFin.outcome === "finalized" ? schedTitleFin.eventId : "";

    const activeBeforeSched = await getActivePrimaryAssignmentAsOf(
      employmentId,
      today,
      db,
    );
    assert.ok(activeBeforeSched);
    assert.equal(activeBeforeSched!.jobTitleId, newTitle.id);
    assert.equal(
      (await listPrimaryAssignmentsForEmployment(employmentId, db)).length,
      3,
      "Scheduled JobTitle must not open successor Primary today",
    );
    const futureSlotAfterReserve = await slotCounts(pool, futureTitleSlotId);
    assert.equal(futureSlotAfterReserve.free, futureSlotBefore.free - 1);
    assert.equal(futureSlotAfterReserve.reserved, futureSlotBefore.reserved + 1);
    assert.equal(await reservationStatus(pool, schedTitleEventId), "reserved");

    await cancelPersonnelEvent(
      schedTitleEventId,
      {
        actorId: admin,
        reason: "selfcheck cancel scheduled job title",
        idempotencyKey: `jl-cancel-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(await reservationStatus(pool, schedTitleEventId), "released");
    const futureSlotAfterCancel = await slotCounts(pool, futureTitleSlotId);
    assert.equal(futureSlotAfterCancel.free, futureSlotBefore.free);
    assert.equal(futureSlotAfterCancel.reserved, futureSlotBefore.reserved);

    // --- 8. PromotionRecorded → Grade-only successor Primary ---
    const promoDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "PromotionRecorded",
        effectiveDate: promoEd,
        payload: { gradeId: jobRefs.gradeHighId },
      },
      { accountId: operator },
      db,
    );
    const promoFin = await finalizeDraft(
      {
        draftId: promoDraft.id,
        actorId: operator,
        expectedVersion: promoDraft.version,
        idempotencyKey: `jl-promo-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(promoFin.outcome, "finalized");
    assert.ok(promoFin.outcome === "finalized" && promoFin.status === "Effective");
    const promoEventId =
      promoFin.outcome === "finalized" ? promoFin.eventId : "";

    const primariesAfterPromo = await listPrimaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    assert.equal(primariesAfterPromo.length, 4);
    const promoSuccessor = primariesAfterPromo.find(
      (p) => p.sourceEventId === promoEventId,
    );
    assert.ok(promoSuccessor);
    assert.equal(promoSuccessor!.gradeId, jobRefs.gradeHighId);
    assert.equal(promoSuccessor!.jobTitleId, newTitle.id);
    assert.equal(
      (await slotCounts(pool, newTitleSlotId)).free,
      titleSlotAfter.free,
      "Promotion must not mutate capacity",
    );

    // --- 9. Retry finalize idempotent: one successor with sourceEventId ---
    const gradeRetry = await finalizeDraft(
      {
        draftId: gradeDraft.id,
        actorId: operator,
        idempotencyKey: `jl-grade-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(gradeRetry.outcome, "finalized");
    assert.equal(gradeRetry.outcome === "finalized" ? gradeRetry.eventId : "", gradeEventId);
    const gradeSuccessors = (await listPrimaryAssignmentsForEmployment(
      employmentId,
      db,
    )).filter((p) => p.sourceEventId === gradeEventId);
    assert.equal(gradeSuccessors.length, 1);

    console.log("personnel-event-job-level.selfcheck: OK");
  } finally {
    resetProjectionRefreshHook();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
