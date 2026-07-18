/**
 * Team Transfer personnel events selfcheck (Story 4.7 / FR-22 / FR-30 / FR-31).
 * Run: pnpm --filter @divan/person-employment selfcheck:personnel-event-transfer
 * Requires DATABASE_URL, migrated schema, seeded accounts + org/job fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { createPgPool } from "@divan/db";
import { getBusinessEventById, withTransaction } from "@divan/event-store";
import {
  ensureHeadcountCapacitySchema,
  readHeadcountCapacityPanel,
  seedCapacitySlot,
  seedDemoHeadcountCapacity,
} from "@divan/headcount";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  TERMINATION_PRODUCT_RISK_TIERS,
  cancelPersonnelEvent,
  createDraft,
  createOrgUnit,
  createPerson,
  evaluationStatusAsOf,
  finalizeDraft,
  getActivePrimaryAssignmentAsOf,
  getPersonDb,
  listEmploymentsForPerson,
  listPrimaryAssignmentsForEmployment,
  priorDateOnly,
  resetProjectionRefreshHook,
  runProjectionRefreshHook,
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
    organizationalRoleId: role.id,
    jobTitleId: title.id,
    ladderId: ladder.id,
    gradeId: grade.id,
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
  const { slotId: sourceSlotId } = await seedDemoHeadcountCapacity(db, pool);
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
  const startEd = priorDateOnly(today);
  const future = addDays(today, 45);

  const destTeam = await createOrgUnit(
    {
      code: `TEAM-XFER-${suffix}`,
      nameFa: "تیم مقصد انتقال",
      unitType: "TEAM",
      parentId: dept.id,
      startDate: "2020-01-01",
    },
    db,
  );
  const destSlotId = await seedCapacitySlot(pool, {
    id: randomUUID(),
    teamId: destTeam.id,
    jobTitleId: jobRefs.jobTitleId,
    ladderId: jobRefs.ladderId,
    gradeId: jobRefs.gradeId,
    startDate: "2020-01-01",
    freeUnits: 5,
    label: `transfer-dest-${suffix}`,
  });

  try {
    // --- Start person on source team ---
    const person = await createPerson(
      {
        personnelCode: `47${suffix.slice(0, 4)}`,
        givenName: "آزمایش",
        familyName: "انتقال",
        mobilePhone: "09124700001",
      },
      { accountId: operator, correlationId: `sc-xfer-${suffix}` },
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
        idempotencyKey: `xfer-start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(startFin.outcome, "finalized");
    const emps = await listEmploymentsForPerson(person.id, db);
    assert.equal(emps.length, 1);
    const employmentId = emps[0]!.id;
    const primaryBefore = await getActivePrimaryAssignmentAsOf(
      employmentId,
      today,
      db,
    );
    assert.ok(primaryBefore);
    assert.equal(primaryBefore!.teamId, sourceTeam.id);

    const sourceFreeBefore = (await slotCounts(pool, sourceSlotId)).free;
    const destBefore = await slotCounts(pool, destSlotId);

    // Panel read
    const panel = await readHeadcountCapacityPanel(pool, {
      teamId: destTeam.id,
      jobTitleId: jobRefs.jobTitleId,
      ladderId: jobRefs.ladderId,
      gradeId: jobRefs.gradeId,
      effectiveDate: today,
      preferredSlotId: destSlotId,
    });
    assert.equal(panel.free, destBefore.free);
    assert.equal(panel.reserved, destBefore.reserved);

    // --- No-op reject ---
    const noopDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "TransferRecorded",
        effectiveDate: today,
        payload: {
          teamId: sourceTeam.id,
          ...jobRefs,
        },
      },
      { accountId: operator },
      db,
    );
    const noopFin = await finalizeDraft(
      {
        draftId: noopDraft.id,
        actorId: operator,
        expectedVersion: noopDraft.version,
      },
      pool,
      db,
    );
    assert.equal(noopFin.outcome, "rejected");
    if (noopFin.outcome === "rejected") {
      assert.ok(noopFin.conflicts.some((c) => c.code === "TRANSFER_NOOP"));
    }

    // --- TeamTransferRecorded non-product ---
    const nonProduct = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "TeamTransferRecorded",
        effectiveDate: today,
        payload: {
          teamId: destTeam.id,
          ...jobRefs,
        },
      },
      { accountId: operator },
      db,
    );
    const nonProductFin = await finalizeDraft(
      {
        draftId: nonProduct.id,
        actorId: operator,
        expectedVersion: nonProduct.version,
      },
      pool,
      db,
    );
    assert.equal(nonProductFin.outcome, "rejected");

    // --- Scheduled Transfer → reserve only ---
    const schedDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "TransferRecorded",
        effectiveDate: future,
        payload: {
          teamId: destTeam.id,
          ...jobRefs,
          capacitySlotId: destSlotId,
        },
      },
      { accountId: operator },
      db,
    );
    const schedFin = await finalizeDraft(
      {
        draftId: schedDraft.id,
        actorId: operator,
        expectedVersion: schedDraft.version,
        idempotencyKey: `xfer-sched-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(schedFin.outcome, "finalized");
    assert.ok(schedFin.outcome === "finalized" && schedFin.status === "Scheduled");
    const schedEventId =
      schedFin.outcome === "finalized" ? schedFin.eventId : "";

    const primaryAfterSched = await getActivePrimaryAssignmentAsOf(
      employmentId,
      today,
      db,
    );
    assert.ok(primaryAfterSched);
    assert.equal(
      primaryAfterSched!.teamId,
      sourceTeam.id,
      "FR-16: Scheduled must not move today's Primary",
    );
    assert.equal(
      (await slotCounts(pool, sourceSlotId)).free,
      sourceFreeBefore,
      "source capacity unchanged on Scheduled Transfer",
    );
    const destAfterReserve = await slotCounts(pool, destSlotId);
    assert.equal(destAfterReserve.free, destBefore.free - 1);
    assert.equal(destAfterReserve.reserved, destBefore.reserved + 1);
    assert.equal(await reservationStatus(pool, schedEventId), "reserved");

    // Idempotent finalize retry — no double reserve
    const schedRetry = await finalizeDraft(
      {
        draftId: schedDraft.id,
        actorId: operator,
        idempotencyKey: `xfer-sched-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(schedRetry.outcome, "finalized");
    assert.equal((await slotCounts(pool, destSlotId)).reserved, destAfterReserve.reserved);
    assert.equal(await reservationStatus(pool, schedEventId), "reserved");

    // --- Cancel Scheduled → release reservation ---
    const cancelResult = await cancelPersonnelEvent(
      schedEventId,
      {
        actorId: admin,
        reason: "selfcheck cancel scheduled transfer",
        idempotencyKey: `xfer-cancel-${suffix}`,
      },
      pool,
      db,
    );
    assert.ok(cancelResult.neutralizingEventId);
    assert.equal(await reservationStatus(pool, schedEventId), "released");
    const destAfterCancel = await slotCounts(pool, destSlotId);
    assert.equal(destAfterCancel.free, destBefore.free);
    assert.equal(destAfterCancel.reserved, destBefore.reserved);

    // --- Effective Transfer (today) → atomic move ---
    const effDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "TransferRecorded",
        effectiveDate: today,
        payload: {
          teamId: destTeam.id,
          ...jobRefs,
          capacitySlotId: destSlotId,
        },
      },
      { accountId: operator },
      db,
    );
    const effFin = await finalizeDraft(
      {
        draftId: effDraft.id,
        actorId: operator,
        expectedVersion: effDraft.version,
        idempotencyKey: `xfer-eff-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(effFin.outcome, "finalized");
    assert.ok(effFin.outcome === "finalized" && effFin.status === "Effective");
    const effEventId = effFin.outcome === "finalized" ? effFin.eventId : "";

    const primaries = await listPrimaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    assert.equal(primaries.length, 2);
    const closed = primaries.find((p) => p.endDateExclusive === today);
    const opened = primaries.find((p) => p.sourceEventId === effEventId);
    assert.ok(closed);
    assert.ok(opened);
    assert.equal(closed!.teamId, sourceTeam.id);
    assert.equal(opened!.teamId, destTeam.id);
    assert.equal(opened!.startDate, today);

    const activeAsOfEd = await getActivePrimaryAssignmentAsOf(
      employmentId,
      today,
      db,
    );
    assert.ok(activeAsOfEd);
    assert.equal(activeAsOfEd!.id, opened!.id);
    assert.equal(activeAsOfEd!.teamId, destTeam.id);

    assert.equal(await consumptionCount(pool, effEventId), 1);
    // Source slot free restored (Start consume released)
    assert.equal(
      (await slotCounts(pool, sourceSlotId)).free,
      sourceFreeBefore + 1,
    );

    // Idempotent Effective retry
    const effRetry = await finalizeDraft(
      {
        draftId: effDraft.id,
        actorId: operator,
        idempotencyKey: `xfer-eff-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(effRetry.outcome, "finalized");
    assert.equal(await consumptionCount(pool, effEventId), 1);
    assert.equal(
      (await listPrimaryAssignmentsForEmployment(employmentId, db)).length,
      2,
    );

    // --- evaluation-by-date: Scheduled Transfer applies without status UPDATE ---
    const person2 = await createPerson(
      {
        personnelCode: `48${suffix.slice(0, 4)}`,
        givenName: "ارزیابی",
        familyName: "تاریخ",
        mobilePhone: "09124700002",
      },
      { accountId: operator, correlationId: `sc-eval-${suffix}` },
      db,
    );
    const start2 = await createDraft(
      {
        personId: person2.id,
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
    const start2Fin = await finalizeDraft(
      {
        draftId: start2.id,
        actorId: operator,
        expectedVersion: start2.version,
        idempotencyKey: `xfer-start2-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(start2Fin.outcome, "finalized");
    const emp2 = (await listEmploymentsForPerson(person2.id, db))[0]!;

    const futureDraft = await createDraft(
      {
        personId: person2.id,
        employmentId: emp2.id,
        eventType: "TransferRecorded",
        effectiveDate: future,
        payload: {
          teamId: destTeam.id,
          ...jobRefs,
          capacitySlotId: destSlotId,
        },
      },
      { accountId: operator },
      db,
    );
    const futureFin = await finalizeDraft(
      {
        draftId: futureDraft.id,
        actorId: operator,
        expectedVersion: futureDraft.version,
        idempotencyKey: `xfer-future-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(futureFin.outcome, "finalized");
    assert.ok(
      futureFin.outcome === "finalized" && futureFin.status === "Scheduled",
    );
    const futureEventId =
      futureFin.outcome === "finalized" ? futureFin.eventId : "";
    assert.equal(await reservationStatus(pool, futureEventId), "reserved");

    // Simulate asOf advanced to ED — apply via evaluationStatusAsOf without status UPDATE
    await withTransaction(pool, async (client) => {
      const event = await getBusinessEventById(client, futureEventId);
      assert.ok(event);
      assert.equal(event!.status, "Scheduled");
      assert.equal(evaluationStatusAsOf(event!, future), "Effective");
      await runProjectionRefreshHook({
        client,
        eventId: futureEventId,
        eventType: "TransferRecorded",
        applyToCurrentProjection:
          evaluationStatusAsOf(event!, future) === "Effective",
      });
    });

    const stored = await withTransaction(pool, async (client) =>
      getBusinessEventById(client, futureEventId),
    );
    assert.equal(stored!.status, "Scheduled", "storage status must not UPDATE");
    assert.equal(await reservationStatus(pool, futureEventId), "converted");
    assert.equal(await consumptionCount(pool, futureEventId), 1);
    const active2 = await getActivePrimaryAssignmentAsOf(emp2.id, future, db);
    assert.ok(active2);
    assert.equal(active2!.teamId, destTeam.id);

    // --- Last-unit concurrency ---
    const lastTeam = await createOrgUnit(
      {
        code: `TEAM-LAST-${suffix}`,
        nameFa: "تیم آخرین واحد",
        unitType: "TEAM",
        parentId: dept.id,
        startDate: "2020-01-01",
      },
      db,
    );
    const lastSlotId = await seedCapacitySlot(pool, {
      id: randomUUID(),
      teamId: lastTeam.id,
      jobTitleId: jobRefs.jobTitleId,
      ladderId: jobRefs.ladderId,
      gradeId: jobRefs.gradeId,
      startDate: "2020-01-01",
      freeUnits: 1,
      label: `last-unit-${suffix}`,
    });

    const personA = await createPerson(
      {
        personnelCode: `49${suffix.slice(0, 4)}`,
        givenName: "همزمان",
        familyName: "الف",
        mobilePhone: "09124700003",
      },
      { accountId: operator, correlationId: `sc-conc-a-${suffix}` },
      db,
    );
    const personB = await createPerson(
      {
        personnelCode: `50${suffix.slice(0, 4)}`,
        givenName: "همزمان",
        familyName: "ب",
        mobilePhone: "09124700004",
      },
      { accountId: operator, correlationId: `sc-conc-b-${suffix}` },
      db,
    );

    async function startThenTransfer(
      pId: string,
      key: string,
    ): Promise<"ok" | "fail"> {
      const sd = await createDraft(
        {
          personId: pId,
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
      const sf = await finalizeDraft(
        {
          draftId: sd.id,
          actorId: operator,
          expectedVersion: sd.version,
          idempotencyKey: `conc-start-${key}`,
        },
        pool,
        db,
      );
      if (sf.outcome !== "finalized") return "fail";
      const emp = (await listEmploymentsForPerson(pId, db))[0]!;
      const td = await createDraft(
        {
          personId: pId,
          employmentId: emp.id,
          eventType: "TransferRecorded",
          effectiveDate: future,
          payload: {
            teamId: lastTeam.id,
            ...jobRefs,
            capacitySlotId: lastSlotId,
          },
        },
        { accountId: operator },
        db,
      );
      try {
        const tf = await finalizeDraft(
          {
            draftId: td.id,
            actorId: operator,
            expectedVersion: td.version,
            idempotencyKey: `conc-xfer-${key}`,
          },
          pool,
          db,
        );
        return tf.outcome === "finalized" ? "ok" : "fail";
      } catch {
        return "fail";
      }
    }

    const [rA, rB] = await Promise.all([
      startThenTransfer(personA.id, `${suffix}-a`),
      startThenTransfer(personB.id, `${suffix}-b`),
    ]);
    const okCount = [rA, rB].filter((r) => r === "ok").length;
    assert.equal(
      okCount,
      1,
      `exactly one concurrent last-unit reserve must succeed (got ${rA}/${rB})`,
    );
    assert.equal((await slotCounts(pool, lastSlotId)).free, 0);
    assert.equal((await slotCounts(pool, lastSlotId)).reserved, 1);

    // --- Incompatible future: Scheduled Transfer blocks Termination until Cancel ---
    const person3 = await createPerson(
      {
        personnelCode: `51${suffix.slice(0, 4)}`,
        givenName: "ناسازگار",
        familyName: "آینده",
        mobilePhone: "09124700005",
      },
      { accountId: operator, correlationId: `sc-peer-${suffix}` },
      db,
    );
    const s3 = await createDraft(
      {
        personId: person3.id,
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
    const s3Fin = await finalizeDraft(
      {
        draftId: s3.id,
        actorId: operator,
        expectedVersion: s3.version,
        idempotencyKey: `peer-start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(s3Fin.outcome, "finalized");
    const emp3 = (await listEmploymentsForPerson(person3.id, db))[0]!;

    const peerXfer = await createDraft(
      {
        personId: person3.id,
        employmentId: emp3.id,
        eventType: "TransferRecorded",
        effectiveDate: future,
        payload: {
          teamId: destTeam.id,
          ...jobRefs,
          capacitySlotId: destSlotId,
        },
      },
      { accountId: operator },
      db,
    );
    const peerXferFin = await finalizeDraft(
      {
        draftId: peerXfer.id,
        actorId: operator,
        expectedVersion: peerXfer.version,
        idempotencyKey: `peer-xfer-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(peerXferFin.outcome, "finalized");
    const peerXferId =
      peerXferFin.outcome === "finalized" ? peerXferFin.eventId : "";

    const termDraft = await createDraft(
      {
        personId: person3.id,
        employmentId: emp3.id,
        eventType: "EmploymentTerminated",
        effectiveDate: today,
        payload: { terminationReason: "contract_ended" },
      },
      { accountId: operator },
      db,
    );
    const termBlocked = await finalizeDraft(
      {
        draftId: termDraft.id,
        actorId: operator,
        expectedVersion: termDraft.version,
        riskTier: TERMINATION_PRODUCT_RISK_TIERS,
      },
      pool,
      db,
    );
    assert.equal(termBlocked.outcome, "rejected");
    if (termBlocked.outcome === "rejected") {
      assert.ok(
        termBlocked.conflicts.some(
          (c) => c.code === "INCOMPATIBLE_FUTURE_EVENTS",
        ),
      );
    }

    await cancelPersonnelEvent(
      peerXferId,
      {
        actorId: admin,
        reason: "dispose peer transfer for termination",
        idempotencyKey: `peer-cancel-${suffix}`,
      },
      pool,
      db,
    );

    const termDraft2 = await createDraft(
      {
        personId: person3.id,
        employmentId: emp3.id,
        eventType: "EmploymentTerminated",
        effectiveDate: today,
        payload: { terminationReason: "contract_ended" },
      },
      { accountId: operator },
      db,
    );
    const termOk = await finalizeDraft(
      {
        draftId: termDraft2.id,
        actorId: operator,
        expectedVersion: termDraft2.version,
        riskTier: TERMINATION_PRODUCT_RISK_TIERS,
        idempotencyKey: `peer-term-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(termOk.outcome, "finalized");

    console.log("personnel-event-transfer.selfcheck: OK");
  } finally {
    resetProjectionRefreshHook();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
