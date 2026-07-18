/**
 * Current Person state assembler selfcheck (Story 4.9 / FR-25 / FR-16 / FR-45).
 * Run: pnpm --filter @divan/person-employment selfcheck:current-person-state
 * Requires DATABASE_URL, migrated schema, seeded accounts + org/job fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  DEV_DEMO_CATEGORIES,
  type CategoryRegistry,
} from "@divan/audit-envelope";
import {
  COMPENSATION_DATA_CATEGORY,
  applyCompensationProjection,
  applyContractualProjection,
  getCompensationDb,
} from "@divan/compensation-facts";
import { createPgPool } from "@divan/db";
import {
  ensureHeadcountCapacitySchema,
  seedCapacitySlot,
  seedDemoHeadcountCapacity,
} from "@divan/headcount";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  PERSON_DATA_CATEGORY,
  BASELINE_BOUNDARY_ENV,
  cancelPersonnelEvent,
  clearRecalculationStatus,
  closeEmploymentProjection,
  closePrimaryAssignmentProjection,
  createDraft,
  createJobTitle,
  createOrgUnit,
  createPerson,
  currentPersonStateFactsForCompare,
  finalizeDraft,
  getBaselineBoundaryDate,
  getCurrentPersonState,
  getPersonDb,
  listEmploymentsForPerson,
  markRecalculationFailed,
  markRecalculationPending,
  markRecalculationStale,
  resetProjectionRefreshHook,
  seedPersonnelEventPermissionFixtures,
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

/** Selfcheck registry: identity.person + compensation enabled (dev omit proofs). */
function authzCategoriesWithCompensation(): CategoryRegistry {
  return {
    categories: [
      ...DEV_DEMO_CATEGORIES.categories.filter(
        (c) => c.id !== COMPENSATION_DATA_CATEGORY,
      ),
      {
        id: COMPENSATION_DATA_CATEGORY,
        enabled: true,
        sensitivity: "sensitive",
        requiresSeparateExport: true,
      },
    ],
  };
}

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

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();
  const compDb = getCompensationDb();
  const pool = createPgPool(url);

  try {
    resetProjectionRefreshHook();

    await seedPrimaryAssignmentFixtures(db);
    await seedPersonnelEventPermissionFixtures(db);
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
    const startEd = addDays(today, -10);
    const xferEd = addDays(today, -5);
    const histAfterXfer = addDays(today, -2);
    const midFuture = addDays(today, 20);
    const future = addDays(today, 45);
    const categories = authzCategoriesWithCompensation();
    const ordinaryAuthz = {
      allowedCategories: new Set([PERSON_DATA_CATEGORY]),
      categories,
      hasCompensationRead: false,
    };
    const compAuthz = {
      allowedCategories: new Set([
        PERSON_DATA_CATEGORY,
        COMPENSATION_DATA_CATEGORY,
      ]),
      categories,
      hasCompensationRead: true,
    };

    const destTeam = await createOrgUnit(
      {
        code: `TEAM-CPS-${suffix}`,
        nameFa: "تیم مقصد وضعیت جاری",
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
      label: `cps-dest-${suffix}`,
    });

    const futureTitle = await createJobTitle(
      {
        code: `JT-CPS-${suffix}`,
        nameFa: "عنوان زمان‌بندی‌شده وضعیت جاری",
        startDate: "2020-01-01",
      },
      db,
    );
    const futureTitleSlotId = await seedCapacitySlot(pool, {
      id: randomUUID(),
      teamId: sourceTeam.id,
      jobTitleId: futureTitle.id,
      ladderId: jobRefs.ladderId,
      gradeId: jobRefs.gradeId,
      startDate: "2020-01-01",
      freeUnits: 5,
      label: `cps-title-${suffix}`,
    });

    // --- 1. Start → active Employment + Primary ---
    const person = await createPerson(
      {
        personnelCode: `49${suffix.slice(0, 4)}`,
        givenName: "آزمایش",
        familyName: "وضعیت‌جاری",
        mobilePhone: "09124900001",
      },
      { accountId: operator, correlationId: `sc-cps-${suffix}` },
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
        idempotencyKey: `cps-start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(startFin.outcome, "finalized");
    // Past-dated Start may leave recalculation_status=pending (enqueue unset).
    await clearRecalculationStatus(pool, person.id);

    const afterStart = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(afterStart.ok, true);
    if (!afterStart.ok) throw new Error("unreachable");
    assert.equal(afterStart.viewSemantics, "current");
    assert.equal(afterStart.baselineDisclosure.configured, false);
    assert.ok(afterStart.employment);
    assert.ok(afterStart.primaryAssignment);
    assert.equal(afterStart.teamMembership?.teamId, sourceTeam.id);
    assert.equal(afterStart.primaryAssignment.jobTitleId, jobRefs.jobTitleId);
    assert.equal(afterStart.plannedChangesThroughAsOf.length, 0);
    assert.equal(
      Object.prototype.hasOwnProperty.call(afterStart, "compensation"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(afterStart, "contractual"),
      false,
    );

    // --- 1b. Invalid asOf rejected fail-closed ---
    await assert.rejects(
      () =>
        getCurrentPersonState(
          person.id,
          {
            asOf: `${today}T12:00:00Z`,
            actorAuthz: ordinaryAuthz,
          },
          { eventDb: pool, personDb: db, compensationDb: compDb },
        ),
      (err: unknown) => {
        assert.ok(
          err !== null &&
            typeof err === "object" &&
            "messageFa" in err &&
            "code" in err,
        );
        const pe = err as { code: string; messageFa: string };
        assert.equal(pe.code, "VALIDATION");
        assert.match(pe.messageFa, /تاریخ مبنا/);
        return true;
      },
    );

    // --- 1c. Baseline disclosure: unset honesty + limited when configured ---
    assert.equal(getBaselineBoundaryDate({}), null);
    assert.equal(
      getBaselineBoundaryDate({ [BASELINE_BOUNDARY_ENV]: "2020-01-01" }),
      "2020-01-01",
    );
    assert.throws(
      () =>
        getBaselineBoundaryDate({
          [BASELINE_BOUNDARY_ENV]: "not-a-date",
        }),
      (err: unknown) => {
        assert.ok(
          err !== null &&
            typeof err === "object" &&
            "code" in err &&
            "messageFa" in err,
        );
        const pe = err as { code: string; messageFa: string };
        assert.equal(pe.code, "VALIDATION");
        assert.match(pe.messageFa, /Baseline/);
        return true;
      },
    );
    await assert.rejects(
      () =>
        getCurrentPersonState(
          person.id,
          {
            asOf: today,
            actorAuthz: ordinaryAuthz,
            baselineBoundaryDate: "not-a-date",
          },
          { eventDb: pool, personDb: db, compensationDb: compDb },
        ),
      (err: unknown) => {
        assert.ok(
          err !== null &&
            typeof err === "object" &&
            "code" in err &&
            "messageFa" in err,
        );
        const pe = err as { code: string; messageFa: string };
        assert.equal(pe.code, "VALIDATION");
        assert.match(pe.messageFa, /Baseline/);
        return true;
      },
    );

    const histAsOf = startEd;
    const limited = await getCurrentPersonState(
      person.id,
      {
        asOf: histAsOf,
        actorAuthz: ordinaryAuthz,
        baselineBoundaryDate: today,
      },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(limited.ok, true);
    if (!limited.ok) throw new Error("unreachable");
    assert.equal(limited.viewSemantics, "historical");
    assert.equal(limited.baselineDisclosure.configured, true);
    assert.equal(limited.baselineDisclosure.limited, true);
    assert.equal(limited.baselineDisclosure.boundaryDate, today);
    assert.ok(limited.baselineDisclosure.messageFa.length > 0);

    const within = await getCurrentPersonState(
      person.id,
      {
        asOf: today,
        actorAuthz: ordinaryAuthz,
        baselineBoundaryDate: startEd,
      },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(within.ok, true);
    if (!within.ok) throw new Error("unreachable");
    assert.equal(within.baselineDisclosure.configured, true);
    assert.equal(within.baselineDisclosure.limited, false);

    // --- 2. Dual-consumer equality ---
    async function profileConsumer() {
      return getCurrentPersonState(
        person.id,
        { asOf: today, actorAuthz: ordinaryAuthz },
        { eventDb: pool, personDb: db, compensationDb: compDb },
      );
    }
    async function reportConsumer() {
      return getCurrentPersonState(
        person.id,
        { asOf: today, actorAuthz: ordinaryAuthz },
        { eventDb: pool, personDb: db, compensationDb: compDb },
      );
    }
    const a = await profileConsumer();
    const b = await reportConsumer();
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (a.ok && b.ok) {
      assert.deepEqual(
        currentPersonStateFactsForCompare(a),
        currentPersonStateFactsForCompare(b),
      );
    }

    // --- 3. Scheduled JobTitleChanged → current Title unchanged ---
    const titleDraft = await createDraft(
      {
        personId: person.id,
        employmentId: afterStart.employment!.id,
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
    const titleFin = await finalizeDraft(
      {
        draftId: titleDraft.id,
        actorId: operator,
        expectedVersion: titleDraft.version,
        idempotencyKey: `cps-title-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(titleFin.outcome, "finalized");
    assert.ok(titleFin.outcome === "finalized" && titleFin.eventId);
    await clearRecalculationStatus(pool, person.id);

    const withSchedTitle = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(withSchedTitle.ok, true);
    if (!withSchedTitle.ok) throw new Error("unreachable");
    assert.equal(
      withSchedTitle.primaryAssignment?.jobTitleId,
      jobRefs.jobTitleId,
    );
    const scheduledTitle = withSchedTitle.scheduledChanges.find(
      (r) => r.eventType === "JobTitleChanged",
    );
    assert.ok(scheduledTitle);
    assert.equal(scheduledTitle.resolvedStatus, "Scheduled");
    assert.equal(scheduledTitle.id, titleFin.eventId);

    await cancelPersonnelEvent(
      titleFin.eventId,
      {
        actorId: admin,
        reason: "selfcheck cancel scheduled title",
        idempotencyKey: `cps-cancel-title-${suffix}`,
      },
      pool,
      db,
    );
    await clearRecalculationStatus(pool, person.id);
    const afterTitleCancel = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(afterTitleCancel.ok, true);
    if (!afterTitleCancel.ok) throw new Error("unreachable");
    assert.equal(
      afterTitleCancel.scheduledChanges.some(
        (r) => r.eventType === "JobTitleChanged",
      ),
      false,
    );

    // --- 4. Scheduled Transfer → current Team unchanged ---
    const xferDraft = await createDraft(
      {
        personId: person.id,
        employmentId: afterStart.employment!.id,
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
    const xferFin = await finalizeDraft(
      {
        draftId: xferDraft.id,
        actorId: operator,
        expectedVersion: xferDraft.version,
        idempotencyKey: `cps-xfer-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(xferFin.outcome, "finalized");
    assert.ok(xferFin.outcome === "finalized" && xferFin.eventId);
    await clearRecalculationStatus(pool, person.id);

    const withScheduled = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(withScheduled.ok, true);
    if (!withScheduled.ok) throw new Error("unreachable");
    assert.equal(withScheduled.teamMembership?.teamId, sourceTeam.id);
    assert.equal(withScheduled.primaryAssignment?.teamId, sourceTeam.id);
    const scheduledXfer = withScheduled.scheduledChanges.find(
      (r) => r.eventType === "TransferRecorded",
    );
    assert.ok(scheduledXfer);
    assert.equal(scheduledXfer.resolvedStatus, "Scheduled");
    assert.ok(scheduledXfer.effectiveDate > today);
    assert.equal(scheduledXfer.id, xferFin.eventId);

    // Cancel Scheduled Transfer so Effective Transfer can proceed
    await cancelPersonnelEvent(
      xferFin.eventId,
      {
        actorId: admin,
        reason: "selfcheck cancel scheduled transfer",
        idempotencyKey: `cps-cancel-${suffix}`,
      },
      pool,
      db,
    );
    await clearRecalculationStatus(pool, person.id);
    const afterXferCancel = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(afterXferCancel.ok, true);
    if (!afterXferCancel.ok) throw new Error("unreachable");
    assert.equal(
      afterXferCancel.scheduledChanges.some(
        (r) => r.eventType === "TransferRecorded",
      ),
      false,
    );

    // --- 5. Effective Transfer (past) → Team updated ---
    const effXferDraft = await createDraft(
      {
        personId: person.id,
        employmentId: afterStart.employment!.id,
        eventType: "TransferRecorded",
        effectiveDate: xferEd,
        payload: {
          teamId: destTeam.id,
          ...jobRefs,
          capacitySlotId: destSlotId,
        },
      },
      { accountId: operator },
      db,
    );
    const effXferFin = await finalizeDraft(
      {
        draftId: effXferDraft.id,
        actorId: operator,
        expectedVersion: effXferDraft.version,
        idempotencyKey: `cps-xfer-eff-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(effXferFin.outcome, "finalized");
    await clearRecalculationStatus(pool, person.id);

    const afterEffXfer = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(afterEffXfer.ok, true);
    if (!afterEffXfer.ok) throw new Error("unreachable");
    assert.equal(afterEffXfer.teamMembership?.teamId, destTeam.id);
    assert.equal(afterEffXfer.primaryAssignment?.teamId, destTeam.id);
    assert.equal(
      afterEffXfer.scheduledChanges.some((r) => r.eventType === "TransferRecorded"),
      false,
    );

    // --- 5b. Historical as-of after Effective Transfer → destination Team ---
    const historicalBeforeXfer = await getCurrentPersonState(
      person.id,
      { asOf: startEd, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(historicalBeforeXfer.ok, true);
    if (!historicalBeforeXfer.ok) throw new Error("unreachable");
    assert.equal(historicalBeforeXfer.viewSemantics, "historical");
    assert.equal(historicalBeforeXfer.teamMembership?.teamId, sourceTeam.id);

    const historicalAfterXfer = await getCurrentPersonState(
      person.id,
      { asOf: histAfterXfer, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(historicalAfterXfer.ok, true);
    if (!historicalAfterXfer.ok) throw new Error("unreachable");
    assert.equal(historicalAfterXfer.viewSemantics, "historical");
    assert.equal(historicalAfterXfer.teamMembership?.teamId, destTeam.id);

    // Dual-consumer equality at same historical asOf
    const histA = await getCurrentPersonState(
      person.id,
      { asOf: histAfterXfer, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    const histB = await getCurrentPersonState(
      person.id,
      { asOf: histAfterXfer, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(histA.ok, true);
    assert.equal(histB.ok, true);
    if (histA.ok && histB.ok) {
      assert.deepEqual(
        currentPersonStateFactsForCompare(histA),
        currentPersonStateFactsForCompare(histB),
      );
      assert.equal(histA.viewSemantics, histB.viewSemantics);
      assert.deepEqual(histA.baselineDisclosure, histB.baselineDisclosure);
    }

    // --- 5c. Schedule future Transfer → planned as-of keeps today Team ---
    const plannedXferDraft = await createDraft(
      {
        personId: person.id,
        employmentId: afterStart.employment!.id,
        eventType: "TransferRecorded",
        effectiveDate: future,
        payload: {
          teamId: sourceTeam.id,
          ...jobRefs,
          capacitySlotId: sourceSlotId,
        },
      },
      { accountId: operator },
      db,
    );
    const plannedXferFin = await finalizeDraft(
      {
        draftId: plannedXferDraft.id,
        actorId: operator,
        expectedVersion: plannedXferDraft.version,
        idempotencyKey: `cps-xfer-planned-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(plannedXferFin.outcome, "finalized");
    assert.ok(plannedXferFin.outcome === "finalized" && plannedXferFin.eventId);
    await clearRecalculationStatus(pool, person.id);

    // Mid-future asOf: Transfer still only in remaining scheduledChanges
    const plannedMid = await getCurrentPersonState(
      person.id,
      { asOf: midFuture, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(plannedMid.ok, true);
    if (!plannedMid.ok) throw new Error("unreachable");
    assert.equal(plannedMid.viewSemantics, "planned");
    assert.equal(plannedMid.teamMembership?.teamId, destTeam.id);
    assert.equal(plannedMid.plannedChangesThroughAsOf.length, 0);
    const remainingXfer = plannedMid.scheduledChanges.find(
      (r) => r.eventType === "TransferRecorded",
    );
    assert.ok(remainingXfer);
    assert.equal(remainingXfer.id, plannedXferFin.eventId);
    assert.equal(remainingXfer.resolvedStatus, "Scheduled");

    const plannedView = await getCurrentPersonState(
      person.id,
      { asOf: future, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(plannedView.ok, true);
    if (!plannedView.ok) throw new Error("unreachable");
    assert.equal(plannedView.viewSemantics, "planned");
    // Facts stay at today (dest after Effective Transfer) — not torn future Primary
    assert.equal(plannedView.teamMembership?.teamId, destTeam.id);
    assert.equal(plannedView.asOf, future);
    const plannedXferRow = plannedView.plannedChangesThroughAsOf.find(
      (r) => r.eventType === "TransferRecorded",
    );
    assert.ok(plannedXferRow);
    assert.equal(plannedXferRow.resolvedStatus, "Scheduled");
    assert.equal(plannedXferRow.id, plannedXferFin.eventId);
    assert.equal(plannedView.scheduledChanges.length, 0);
    // Never label Effective for planned view
    assert.notEqual(plannedView.viewSemantics, "current");
    assert.equal(plannedView.viewSemantics, "planned");
    for (const row of [
      ...plannedView.plannedChangesThroughAsOf,
      ...plannedView.scheduledChanges,
    ]) {
      assert.equal(row.resolvedStatus, "Scheduled");
    }
    await cancelPersonnelEvent(
      plannedXferFin.eventId,
      {
        actorId: admin,
        reason: "selfcheck cancel planned transfer",
        idempotencyKey: `cps-cancel-planned-${suffix}`,
      },
      pool,
      db,
    );
    await clearRecalculationStatus(pool, person.id);

    // --- 6. Compensation + contractual as-of visible with read; omitted without ---
    const employmentId = (await listEmploymentsForPerson(person.id, db))[0]!.id;
    await applyCompensationProjection(
      {
        personId: person.id,
        employmentId,
        startDate: today,
        amount: "12000000",
        currency: "IRR",
        changeType: "adjustment",
        skipDictionaryGate: true,
      },
      compDb,
    );
    await applyContractualProjection(
      {
        personId: person.id,
        employmentId,
        startDate: today,
        contractType: "permanent",
        collaborationType: SEED_EMPLOYMENT_LIFECYCLE.collaborationActive,
        skipDictionaryGate: true,
      },
      compDb,
    );

    const withComp = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: compAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(withComp.ok, true);
    if (!withComp.ok) throw new Error("unreachable");
    assert.ok(withComp.compensation);
    assert.equal(withComp.compensation.amount, "12000000");
    assert.ok(withComp.contractual);
    assert.equal(withComp.contractual.contractType, "permanent");

    const withoutComp = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(withoutComp.ok, true);
    if (!withoutComp.ok) throw new Error("unreachable");
    assert.equal(
      Object.prototype.hasOwnProperty.call(withoutComp, "compensation"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(withoutComp, "contractual"),
      false,
    );

    // --- 7. Pending / failed / stale recalc fail-closed ---
    await markRecalculationPending(pool, person.id, startEd);
    const blockedPending = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(blockedPending.ok, false);
    if (blockedPending.ok) throw new Error("unreachable");
    assert.equal(blockedPending.code, "RECALCULATION_PENDING");

    await markRecalculationFailed(pool, person.id, "selfcheck failed");
    const blockedFailed = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(blockedFailed.ok, false);
    if (blockedFailed.ok) throw new Error("unreachable");
    assert.equal(blockedFailed.code, "RECALCULATION_FAILED");

    await markRecalculationStale(pool, person.id, "selfcheck stale");
    const blockedStale = await getCurrentPersonState(
      person.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(blockedStale.ok, false);
    if (blockedStale.ok) throw new Error("unreachable");
    assert.equal(blockedStale.code, "RECALCULATION_STALE");
    await clearRecalculationStatus(pool, person.id);

    // --- 8. Closed Employment/Primary → no active as-of (terminated shape) ---
    // Dedicated past-started person: Transfer-opened Primary starts today and
    // cannot close with endExclusive <= today (interval invariant).
    const termPerson = await createPerson(
      {
        personnelCode: `T9${suffix.slice(0, 6)}`,
        givenName: "آزمایش",
        familyName: "خاتمه‌یافته",
        mobilePhone: "09124900002",
      },
      { accountId: operator, correlationId: `sc-cps-term-${suffix}` },
      db,
    );
    const termStartDraft = await createDraft(
      {
        personId: termPerson.id,
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
    const termStartFin = await finalizeDraft(
      {
        draftId: termStartDraft.id,
        actorId: operator,
        expectedVersion: termStartDraft.version,
        idempotencyKey: `cps-term-start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(termStartFin.outcome, "finalized");
    await clearRecalculationStatus(pool, termPerson.id);

    const termState = await getCurrentPersonState(
      termPerson.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(termState.ok, true);
    if (!termState.ok) throw new Error("unreachable");
    assert.ok(termState.primaryAssignment);
    const termEmploymentId = (await listEmploymentsForPerson(termPerson.id, db))[0]!
      .id;

    await closePrimaryAssignmentProjection(
      termState.primaryAssignment.id,
      today,
      db,
    );
    await closeEmploymentProjection(termEmploymentId, today, db, {
      terminationReason: "resignation",
    });

    const afterTerm = await getCurrentPersonState(
      termPerson.id,
      { asOf: today, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(afterTerm.ok, true);
    if (!afterTerm.ok) throw new Error("unreachable");
    assert.equal(afterTerm.viewSemantics, "current");
    assert.equal(afterTerm.employment, null);
    assert.equal(afterTerm.primaryAssignment, null);
    assert.equal(afterTerm.teamMembership, null);

    console.log("current-person-state selfcheck: OK");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
