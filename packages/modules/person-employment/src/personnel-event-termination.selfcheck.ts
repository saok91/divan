/**
 * Termination personnel events selfcheck (Story 4.6 / FR-21).
 * Run: pnpm --filter @divan/person-employment selfcheck:personnel-event-termination
 * Requires DATABASE_URL, migrated schema, seeded accounts + org/job fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { createPgPool } from "@divan/db";
import { seedDemoHeadcountCapacity } from "@divan/headcount";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  TERMINATION_PRODUCT_RISK_TIERS,
  applySecondaryAssignmentProjection,
  cancelPersonnelEvent,
  createDraft,
  createPerson,
  finalizeDraft,
  getActiveEmploymentAsOf,
  getPersonById,
  getPersonDb,
  getRecalculationStatus,
  listEmploymentsForPerson,
  listPrimaryAssignmentsForEmployment,
  listSecondaryAssignmentsForEmployment,
  priorDateOnly,
  resetProjectionRefreshHook,
  runHistoricalRecalculation,
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

async function resolveStartPayload(db: ReturnType<typeof getPersonDb>) {
  const team = await db.organizationalUnit.findUniqueOrThrow({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamActive.code },
  });
  const role = await db.organizationalRole.findUniqueOrThrow({
    where: { code: SEED_JOB_REFERENCES.role.code },
  });
  const title = await db.jobTitle.findUniqueOrThrow({
    where: { code: SEED_JOB_REFERENCES.jobTitle.code },
  });
  const ladder = await db.ladder.findUniqueOrThrow({
    where: { code: SEED_JOB_REFERENCES.ladder.code },
  });
  const grade = await db.grade.findUniqueOrThrow({
    where: {
      ladderId_code: {
        ladderId: ladder.id,
        code: SEED_JOB_REFERENCES.gradeLow.code,
      },
    },
  });
  const seniority = await db.seniority.findUniqueOrThrow({
    where: { code: SEED_JOB_REFERENCES.seniority.code },
  });
  return {
    collaborationType: SEED_EMPLOYMENT_LIFECYCLE.collaborationActive,
    teamId: team.id,
    organizationalRoleId: role.id,
    jobTitleId: title.id,
    ladderId: ladder.id,
    gradeId: grade.id,
    seniorityId: seniority.id,
  };
}

async function slotFreeUnits(
  pool: ReturnType<typeof createPgPool>,
  slotId: string,
): Promise<number> {
  const r = await pool.query<{ free_units: number }>(
    `SELECT free_units FROM headcount_capacity_slot WHERE id = $1::uuid`,
    [slotId],
  );
  return r.rows[0]?.free_units ?? -1;
}

async function releaseCount(
  pool: ReturnType<typeof createPgPool>,
  releaseEventId: string,
): Promise<number> {
  const r = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM headcount_capacity_consumption
     WHERE release_event_id = $1::uuid`,
    [releaseEventId],
  );
  return Number(r.rows[0]?.c ?? 0);
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();
  const pool = createPgPool(url);

  await seedPrimaryAssignmentFixtures(db);
  const { slotId } = await seedDemoHeadcountCapacity(db, pool);
  const basePayload = await resolveStartPayload(db);
  const startPayload = { ...basePayload, capacitySlotId: slotId };

  const operator =
    (await db.internalAccount.findUnique({ where: { username: "hr.operator" } }))
      ?.id ?? "selfcheck-operator";
  const admin =
    (await db.internalAccount.findUnique({ where: { username: "hr.admin" } }))
      ?.id ?? "selfcheck-admin";

  const suffix = randomUUID().slice(0, 8);
  const today = todayDateOnlyTehran();
  const riskTier = TERMINATION_PRODUCT_RISK_TIERS;

  try {
    // --- Start then Terminate happy path ---
    const person = await createPerson(
      {
        personnelCode: `46${suffix.slice(0, 4)}`,
        givenName: "آزمایش",
        familyName: "خاتمه",
        mobilePhone: "09124600001",
      },
      { accountId: operator, correlationId: `sc-term-${suffix}` },
      db,
    );

    // Start must be strictly before Termination ED (half-open endExclusive = ED)
    const startEd = priorDateOnly(today);
    const freeBeforeStart = await slotFreeUnits(pool, slotId);
    const draftStart = await createDraft(
      {
        personId: person.id,
        eventType: "EmploymentStarted",
        effectiveDate: startEd,
        payload: startPayload,
      },
      { accountId: operator },
      db,
    );
    const startFin = await finalizeDraft(
      {
        draftId: draftStart.id,
        actorId: operator,
        expectedVersion: draftStart.version,
        idempotencyKey: `term-start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(startFin.outcome, "finalized");
    const freeAfterStart = await slotFreeUnits(pool, slotId);
    assert.equal(freeAfterStart, freeBeforeStart - 1);

    const emp = (await listEmploymentsForPerson(person.id, db))[0]!;
    assert.equal(emp.endDateExclusive, null);
    assert.equal(emp.terminationReason, null);

    // Seed an open Secondary so Termination close-at-ED is exercised
    const sec = await applySecondaryAssignmentProjection(
      {
        personId: person.id,
        employmentId: emp.id,
        orgUnitId: startPayload.teamId,
        reasonType: "acting_manager",
        startDate: startEd,
        endDateExclusive: null,
        organizationalRoleId: startPayload.organizationalRoleId,
      },
      db,
    );
    assert.equal(sec.endDateExclusive, null);

    // Missing reason blocks
    const draftMissingReason = await createDraft(
      {
        personId: person.id,
        employmentId: emp.id,
        eventType: "EmploymentTerminated",
        effectiveDate: today,
        payload: {},
      },
      { accountId: operator },
      db,
    );
    const missingReasonFin = await finalizeDraft(
      {
        draftId: draftMissingReason.id,
        actorId: operator,
        expectedVersion: draftMissingReason.version,
        riskTier,
      },
      pool,
      db,
    );
    assert.equal(missingReasonFin.outcome, "rejected");
    if (missingReasonFin.outcome === "rejected") {
      assert.ok(
        missingReasonFin.conflicts.some(
          (c) => c.code === "MISSING_TERMINATION_REASON",
        ),
      );
    }

    // No open employment (wrong id) blocks
    const draftNoEmp = await createDraft(
      {
        personId: person.id,
        eventType: "EmploymentTerminated",
        effectiveDate: today,
        payload: { terminationReason: "contract_ended" },
      },
      { accountId: operator },
      db,
    );
    const noEmpFin = await finalizeDraft(
      {
        draftId: draftNoEmp.id,
        actorId: operator,
        expectedVersion: draftNoEmp.version,
        riskTier,
      },
      pool,
      db,
    );
    assert.equal(noEmpFin.outcome, "rejected");
    if (noEmpFin.outcome === "rejected") {
      assert.ok(
        noEmpFin.conflicts.some(
          (c) =>
            c.code === "MISSING_EMPLOYMENT" ||
            c.code === "EMPLOYMENT_REF_MISSING",
        ),
      );
    }

    // Happy Terminate
    const termEd = today;
    const draftTerm = await createDraft(
      {
        personId: person.id,
        employmentId: emp.id,
        eventType: "EmploymentTerminated",
        effectiveDate: termEd,
        payload: { terminationReason: "contract_ended" },
      },
      { accountId: operator },
      db,
    );
    const termFin = await finalizeDraft(
      {
        draftId: draftTerm.id,
        actorId: operator,
        expectedVersion: draftTerm.version,
        idempotencyKey: `term-${suffix}`,
        riskTier,
      },
      pool,
      db,
    );
    assert.equal(termFin.outcome, "finalized");
    assert.ok(termFin.outcome === "finalized" && termFin.projectionHookInvoked);

    const empsAfter = await listEmploymentsForPerson(person.id, db);
    assert.equal(empsAfter.length, 1);
    const closed = empsAfter[0]!;
    assert.equal(closed.endDateExclusive, termEd);
    assert.equal(closed.terminationReason, "contract_ended");

    const primaries = await listPrimaryAssignmentsForEmployment(closed.id, db);
    assert.equal(primaries.length, 1);
    assert.equal(primaries[0]!.endDateExclusive, termEd);
    const secondaries = await listSecondaryAssignmentsForEmployment(
      closed.id,
      db,
    );
    assert.ok(secondaries.length >= 1, "Secondary must be seeded");
    assert.ok(
      secondaries.every((s) => s.endDateExclusive === termEd),
      "every Secondary must close at Termination ED",
    );

    // Half-open: not active as-of ED; prior day active when start ≤ prior
    assert.equal(await getActiveEmploymentAsOf(person.id, termEd, db), null);
    const prior = priorDateOnly(termEd);
    if (closed.startDate <= prior) {
      const activePrior = await getActiveEmploymentAsOf(person.id, prior, db);
      assert.ok(activePrior, "prior day should still see Employment active");
      assert.equal(activePrior!.id, closed.id);
    }

    const freeAfterTerm = await slotFreeUnits(pool, slotId);
    assert.equal(freeAfterTerm, freeBeforeStart, "capacity restored");
    if (termFin.outcome === "finalized") {
      assert.equal(await releaseCount(pool, termFin.eventId), 1);
    }

    // Person intact
    const personAfter = await getPersonById(person.id, db);
    assert.ok(personAfter);
    assert.equal(personAfter!.personnelCode, person.personnelCode);
    assert.equal(personAfter!.givenName, "آزمایش");

    // Idempotent finalize retry — no double-release
    const retry = await finalizeDraft(
      {
        draftId: draftTerm.id,
        actorId: operator,
        idempotencyKey: `term-${suffix}`,
        riskTier,
      },
      pool,
      db,
    );
    assert.equal(retry.outcome, "finalized");
    if (retry.outcome === "finalized" && termFin.outcome === "finalized") {
      assert.equal(retry.eventId, termFin.eventId);
      assert.equal(await releaseCount(pool, termFin.eventId), 1);
    }
    assert.equal(await slotFreeUnits(pool, slotId), freeBeforeStart);
    assert.equal((await listEmploymentsForPerson(person.id, db)).length, 1);

    // Without riskTier → pending_review (no append path for new draft)
    const person2 = await createPerson(
      {
        personnelCode: `47${suffix.slice(0, 4)}`,
        givenName: "ریسک",
        familyName: "لایه",
        mobilePhone: "09124600002",
      },
      { accountId: operator, correlationId: `sc-risk-${suffix}` },
      db,
    );
    const draftStart2 = await createDraft(
      {
        personId: person2.id,
        eventType: "EmploymentStarted",
        effectiveDate: priorDateOnly(today),
        payload: startPayload,
      },
      { accountId: operator },
      db,
    );
    const start2 = await finalizeDraft(
      {
        draftId: draftStart2.id,
        actorId: operator,
        expectedVersion: draftStart2.version,
      },
      pool,
      db,
    );
    assert.equal(start2.outcome, "finalized");
    const emp2 = (await listEmploymentsForPerson(person2.id, db))[0]!;
    const draftRisk = await createDraft(
      {
        personId: person2.id,
        employmentId: emp2.id,
        eventType: "EmploymentTerminated",
        effectiveDate: today,
        payload: { terminationReason: "resignation" },
      },
      { accountId: operator },
      db,
    );
    const riskFin = await finalizeDraft(
      {
        draftId: draftRisk.id,
        actorId: operator,
        expectedVersion: draftRisk.version,
        // intentionally omit riskTier
      },
      pool,
      db,
    );
    assert.equal(riskFin.outcome, "pending_review");
    assert.equal(
      (await listEmploymentsForPerson(person2.id, db))[0]!.endDateExclusive,
      null,
      "pending_review must not close Employment",
    );

    // Scheduled Termination — no close/release
    const person3 = await createPerson(
      {
        personnelCode: `48${suffix.slice(0, 4)}`,
        givenName: "زمان‌بندی",
        familyName: "خاتمه",
        mobilePhone: "09124600003",
      },
      { accountId: operator, correlationId: `sc-sched-term-${suffix}` },
      db,
    );
    const draftStart3 = await createDraft(
      {
        personId: person3.id,
        eventType: "EmploymentStarted",
        effectiveDate: priorDateOnly(today),
        payload: startPayload,
      },
      { accountId: operator },
      db,
    );
    await finalizeDraft(
      {
        draftId: draftStart3.id,
        actorId: operator,
        expectedVersion: draftStart3.version,
      },
      pool,
      db,
    );
    const emp3 = (await listEmploymentsForPerson(person3.id, db))[0]!;
    const freeBeforeSched = await slotFreeUnits(pool, slotId);
    const futureTerm = "2099-12-01";
    const draftSchedTerm = await createDraft(
      {
        personId: person3.id,
        employmentId: emp3.id,
        eventType: "EmploymentTerminated",
        effectiveDate: futureTerm,
        payload: { terminationReason: "contract_ended" },
      },
      { accountId: operator },
      db,
    );
    const schedTermFin = await finalizeDraft(
      {
        draftId: draftSchedTerm.id,
        actorId: operator,
        expectedVersion: draftSchedTerm.version,
        riskTier,
      },
      pool,
      db,
    );
    assert.equal(schedTermFin.outcome, "finalized");
    if (schedTermFin.outcome === "finalized") {
      assert.equal(schedTermFin.status, "Scheduled");
    }
    const emp3After = (await listEmploymentsForPerson(person3.id, db))[0]!;
    assert.equal(emp3After.endDateExclusive, null);
    assert.equal(await slotFreeUnits(pool, slotId), freeBeforeSched);

    // Incompatible future Scheduled Start blocks; Cancel then finalize
    const person4 = await createPerson(
      {
        personnelCode: `49${suffix.slice(0, 4)}`,
        givenName: "ناسازگار",
        familyName: "آینده",
        mobilePhone: "09124600004",
      },
      { accountId: operator, correlationId: `sc-future-${suffix}` },
      db,
    );

    // Schedule future Start FIRST (no open Employment yet)
    const futureStart = "2099-08-01";
    const draftFutureStart = await createDraft(
      {
        personId: person4.id,
        eventType: "EmploymentStarted",
        effectiveDate: futureStart,
        payload: startPayload,
      },
      { accountId: operator },
      db,
    );
    const futureStartFin = await finalizeDraft(
      {
        draftId: draftFutureStart.id,
        actorId: operator,
        expectedVersion: draftFutureStart.version,
      },
      pool,
      db,
    );
    assert.equal(futureStartFin.outcome, "finalized");
    assert.ok(
      futureStartFin.outcome === "finalized" &&
        futureStartFin.status === "Scheduled",
    );

    // Then open Employment via Effective Start (Scheduled peer remains)
    const draftStart4 = await createDraft(
      {
        personId: person4.id,
        eventType: "EmploymentStarted",
        effectiveDate: priorDateOnly(today),
        payload: startPayload,
      },
      { accountId: operator },
      db,
    );
    const start4Fin = await finalizeDraft(
      {
        draftId: draftStart4.id,
        actorId: operator,
        expectedVersion: draftStart4.version,
      },
      pool,
      db,
    );
    assert.equal(start4Fin.outcome, "finalized");
    const emp4 = (await listEmploymentsForPerson(person4.id, db))[0]!;

    const draftTermBlock = await createDraft(
      {
        personId: person4.id,
        employmentId: emp4.id,
        eventType: "EmploymentTerminated",
        effectiveDate: today,
        payload: { terminationReason: "dismissal" },
      },
      { accountId: operator },
      db,
    );
    const blocked = await finalizeDraft(
      {
        draftId: draftTermBlock.id,
        actorId: operator,
        expectedVersion: draftTermBlock.version,
        riskTier,
      },
      pool,
      db,
    );
    assert.equal(blocked.outcome, "rejected");
    if (blocked.outcome === "rejected") {
      assert.ok(
        blocked.conflicts.some((c) => c.code === "INCOMPATIBLE_FUTURE_EVENTS"),
        "incompatible future must block",
      );
    }
    assert.equal(
      (await listEmploymentsForPerson(person4.id, db))[0]!.endDateExclusive,
      null,
    );

    // Explicit Cancel dispose then finalize succeeds
    assert.ok(futureStartFin.outcome === "finalized");
    await cancelPersonnelEvent(
      futureStartFin.eventId,
      {
        actorId: admin,
        reason: "dispose-before-termination-selfcheck",
        correlationId: randomUUID(),
      },
      pool,
      db,
    );

    const draftTermOk = await createDraft(
      {
        personId: person4.id,
        employmentId: emp4.id,
        eventType: "EmploymentTerminated",
        effectiveDate: today,
        payload: { terminationReason: "dismissal" },
      },
      { accountId: operator },
      db,
    );
    const afterCancel = await finalizeDraft(
      {
        draftId: draftTermOk.id,
        actorId: operator,
        expectedVersion: draftTermOk.version,
        riskTier,
      },
      pool,
      db,
    );
    assert.equal(afterCancel.outcome, "finalized");
    assert.equal(
      (await listEmploymentsForPerson(person4.id, db))[0]!.endDateExclusive,
      today,
    );

    // Past-dated Effective Termination → recalc pending
    const person5 = await createPerson(
      {
        personnelCode: `50${suffix.slice(0, 4)}`,
        givenName: "گذشته",
        familyName: "خاتمه",
        mobilePhone: "09124600005",
      },
      { accountId: operator, correlationId: `sc-past-term-${suffix}` },
      db,
    );
    const pastStart = "2024-01-10";
    const pastTerm = "2024-06-15";
    const draftPastStart = await createDraft(
      {
        personId: person5.id,
        eventType: "EmploymentStarted",
        effectiveDate: pastStart,
        payload: startPayload,
      },
      { accountId: operator },
      db,
    );
    await finalizeDraft(
      {
        draftId: draftPastStart.id,
        actorId: operator,
        expectedVersion: draftPastStart.version,
      },
      pool,
      db,
    );
    const emp5 = (await listEmploymentsForPerson(person5.id, db))[0]!;
    const draftPastTerm = await createDraft(
      {
        personId: person5.id,
        employmentId: emp5.id,
        eventType: "EmploymentTerminated",
        effectiveDate: pastTerm,
        payload: { terminationReason: "contract_ended" },
      },
      { accountId: operator },
      db,
    );
    const pastTermFin = await finalizeDraft(
      {
        draftId: draftPastTerm.id,
        actorId: operator,
        expectedVersion: draftPastTerm.version,
        riskTier,
      },
      pool,
      db,
    );
    assert.equal(pastTermFin.outcome, "finalized");
    if (pastTermFin.outcome === "finalized") {
      assert.equal(pastTermFin.status, "Effective");
      assert.ok(
        pastTermFin.recalcScheduled,
        "past-dated Effective Termination must schedule recalc",
      );
    }
    const pastStatus = await getRecalculationStatus(pool, person5.id);
    assert.ok(pastStatus);
    assert.equal(pastStatus!.status, "pending");

    // Recalc apply/replay — closes + release stay single-cardinality
    assert.ok(pastTermFin.outcome === "finalized" && pastTermFin.recalcScheduled);
    const freeBeforeRecalc = await slotFreeUnits(pool, slotId);
    const releaseBeforeRecalc = await releaseCount(pool, pastTermFin.eventId);
    const run1 = await runHistoricalRecalculation(
      pool,
      pastTermFin.recalcScheduled,
    );
    assert.equal(run1.skipped, false);
    assert.ok(run1.applied >= 1);
    const empAfterRecalc = (await listEmploymentsForPerson(person5.id, db))[0]!;
    assert.equal(empAfterRecalc.endDateExclusive, pastTerm);
    assert.equal(empAfterRecalc.terminationReason, "contract_ended");
    assert.equal(await slotFreeUnits(pool, slotId), freeBeforeRecalc);
    assert.equal(await releaseCount(pool, pastTermFin.eventId), releaseBeforeRecalc);

    const run2 = await runHistoricalRecalculation(
      pool,
      pastTermFin.recalcScheduled,
    );
    assert.equal(run2.skipped, true, "second recalc with same generation skips");
    assert.equal(await releaseCount(pool, pastTermFin.eventId), releaseBeforeRecalc);
    assert.equal(await slotFreeUnits(pool, slotId), freeBeforeRecalc);

    console.log("personnel-event-termination.selfcheck: OK");
  } finally {
    resetProjectionRefreshHook();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
