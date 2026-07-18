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
  getCurrentPersonState,
  getPersonDb,
  listEmploymentsForPerson,
  markRecalculationFailed,
  markRecalculationPending,
  markRecalculationStale,
  priorDateOnly,
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
    const startEd = priorDateOnly(today);
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
    assert.ok(afterStart.employment);
    assert.ok(afterStart.primaryAssignment);
    assert.equal(afterStart.teamMembership?.teamId, sourceTeam.id);
    assert.equal(afterStart.primaryAssignment.jobTitleId, jobRefs.jobTitleId);
    assert.equal(
      Object.prototype.hasOwnProperty.call(afterStart, "compensation"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(afterStart, "contractual"),
      false,
    );

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

    // --- 5. Effective Transfer → Team updated ---
    const effXferDraft = await createDraft(
      {
        personId: person.id,
        employmentId: afterStart.employment!.id,
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
    const termEd = addDays(today, 1);
    assert.ok(afterEffXfer.primaryAssignment);
    await closePrimaryAssignmentProjection(
      afterEffXfer.primaryAssignment.id,
      termEd,
      db,
    );
    await closeEmploymentProjection(employmentId, termEd, db, {
      terminationReason: "resignation",
    });

    const afterTerm = await getCurrentPersonState(
      person.id,
      { asOf: termEd, actorAuthz: ordinaryAuthz },
      { eventDb: pool, personDb: db, compensationDb: compDb },
    );
    assert.equal(afterTerm.ok, true);
    if (!afterTerm.ok) throw new Error("unreachable");
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
