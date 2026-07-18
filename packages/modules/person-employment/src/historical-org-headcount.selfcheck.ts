/**
 * Historical org + headcount reconstruction selfcheck (Story 4.11 / FR-27).
 * Run: pnpm --filter @divan/person-employment selfcheck:historical-org-headcount
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
  headcountQuantitiesFactsForCompare,
  readHeadcountCapacityPanel,
  reconstructHeadcountQuantitiesAsOf,
  seedCapacitySlot,
} from "@divan/headcount";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  BASELINE_BOUNDARY_ENV,
  cancelPersonnelEvent,
  clearRecalculationStatus,
  createDraft,
  createOrgUnit,
  createPerson,
  finalizeDraft,
  getBaselineBoundaryDate,
  getHistoricalOrgHeadcountState,
  getPersonDb,
  historicalOrgHeadcountFactsForCompare,
  listEmploymentsForPerson,
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
  const pool = createPgPool(url);
  const prevBaseline = process.env[BASELINE_BOUNDARY_ENV];

  try {
    resetProjectionRefreshHook();
    await seedPrimaryAssignmentFixtures(db);
    await seedPersonnelEventPermissionFixtures(db);
    await ensureHeadcountCapacitySchema(pool);

    const jobRefs = await resolveJobRefs(db);
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
    const histBeforeXfer = addDays(today, -7);
    const future = addDays(today, 30);
    const futureXferEd = addDays(today, 15);

    const sourceTeamScoped = await createOrgUnit(
      {
        code: `TEAM-HOH-SRC-${suffix}`,
        nameFa: "تیم مبدأ شمارش تاریخی",
        unitType: "TEAM",
        parentId: dept.id,
        startDate: "2020-01-01",
      },
      db,
    );
    const sourceSlotScoped = await seedCapacitySlot(pool, {
      id: randomUUID(),
      teamId: sourceTeamScoped.id,
      jobTitleId: jobRefs.jobTitleId,
      ladderId: jobRefs.ladderId,
      gradeId: jobRefs.gradeId,
      startDate: "2020-01-01",
      freeUnits: 5,
      label: `hoh-src-${suffix}`,
    });

    const destTeam = await createOrgUnit(
      {
        code: `TEAM-HOH-${suffix}`,
        nameFa: "تیم مقصد شمارش تاریخی",
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
      label: `hoh-dest-${suffix}`,
    });

    const person = await createPerson(
      {
        personnelCode: `41${suffix.slice(0, 6)}`,
        givenName: "شمارش",
        familyName: "تاریخی",
        mobilePhone: "09124111001",
      },
      { accountId: operator, correlationId: `sc-hoh-${suffix}` },
      db,
    );

    const startDraft = await createDraft(
      {
        personId: person.id,
        eventType: "EmploymentStarted",
        effectiveDate: startEd,
        payload: {
          collaborationType: SEED_EMPLOYMENT_LIFECYCLE.collaborationActive,
          teamId: sourceTeamScoped.id,
          ...jobRefs,
          capacitySlotId: sourceSlotScoped,
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
        idempotencyKey: `hoh-start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(startFin.outcome, "finalized");
    await clearRecalculationStatus(pool, person.id);

    const emps = await listEmploymentsForPerson(person.id, db);
    assert.equal(emps.length, 1);
    const employmentId = emps[0]!.id;

    // --- Oracle: invalid asOf rejected ---
    await assert.rejects(
      () =>
        getHistoricalOrgHeadcountState(
          { asOf: "not-a-date", teamId: sourceTeamScoped.id },
          { eventDb: pool },
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        const coded = err as Error & { code?: string; messageFa?: string };
        assert.equal(
          coded.code,
          "VALIDATION",
          "invalid asOf must be PersonIdentityError VALIDATION",
        );
        assert.ok(
          typeof coded.messageFa === "string" && coded.messageFa.length > 0,
        );
        return true;
      },
    );

    // --- After Start, before Transfer: source membership 1; source used ≥ 1 ---
    const beforeXfer = await getHistoricalOrgHeadcountState(
      { asOf: histBeforeXfer, teamId: sourceTeamScoped.id },
      { personDb: db, eventDb: pool },
    );
    assert.equal(beforeXfer.ok, true);
    if (beforeXfer.ok) {
      assert.equal(beforeXfer.viewSemantics, "historical");
      assert.equal(beforeXfer.aggregate.teamMembershipCount, 1);
      assert.equal(beforeXfer.aggregate.used, 1);
      assert.equal(beforeXfer.aggregate.reserved, 0);
      const rollup = beforeXfer.detail.teams.reduce(
        (s, t) => s + t.teamMembershipCount,
        0,
      );
      assert.equal(rollup, beforeXfer.aggregate.teamMembershipCount);
    }

    // --- Scheduled Transfer (future effective): source membership unchanged; dest reserved ---
    const schedDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "TransferRecorded",
        effectiveDate: futureXferEd,
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
        idempotencyKey: `hoh-sched-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(schedFin.outcome, "finalized");
    await clearRecalculationStatus(pool, person.id);

    const afterSchedSource = await getHistoricalOrgHeadcountState(
      { asOf: today, teamId: sourceTeamScoped.id },
      { personDb: db, eventDb: pool },
    );
    assert.equal(afterSchedSource.ok, true);
    if (afterSchedSource.ok) {
      assert.equal(afterSchedSource.viewSemantics, "current");
      assert.equal(afterSchedSource.aggregate.teamMembershipCount, 1);
      assert.equal(afterSchedSource.aggregate.used, 1);
    }

    const afterSchedDest = await getHistoricalOrgHeadcountState(
      { asOf: today, teamId: destTeam.id },
      { personDb: db, eventDb: pool },
    );
    assert.equal(afterSchedDest.ok, true);
    if (afterSchedDest.ok) {
      assert.equal(afterSchedDest.aggregate.teamMembershipCount, 0);
      assert.equal(
        afterSchedDest.aggregate.reserved,
        1,
        "dest reserved === 1 after Scheduled Transfer finalize",
      );
    }

    // --- asOf=today ledger ≡ live panel for dest fixture slot ---
    const ledgerToday = await reconstructHeadcountQuantitiesAsOf(pool, {
      asOf: today,
      slotId: destSlotId,
    });
    const panelToday = await readHeadcountCapacityPanel(pool, {
      teamId: destTeam.id,
      jobTitleId: jobRefs.jobTitleId,
      ladderId: jobRefs.ladderId,
      gradeId: jobRefs.gradeId,
      effectiveDate: today,
      preferredSlotId: destSlotId,
    });
    assert.equal(ledgerToday.slots.length, 1);
    const destLedger = ledgerToday.slots[0]!;
    assert.equal(destLedger.used, panelToday.used);
    assert.equal(destLedger.reserved, panelToday.reserved);
    assert.equal(destLedger.free, panelToday.free);
    assert.equal(
      destLedger.approved,
      panelToday.used + panelToday.reserved + panelToday.free,
    );

    // Dual-consumer headcount facts
    const ledgerTodayB = await reconstructHeadcountQuantitiesAsOf(pool, {
      asOf: today,
      slotId: destSlotId,
    });
    assert.deepEqual(
      headcountQuantitiesFactsForCompare(ledgerToday),
      headcountQuantitiesFactsForCompare(ledgerTodayB),
    );

    // Cancel scheduled transfer so we can create an Effective past transfer
    if (schedFin.outcome === "finalized") {
      await cancelPersonnelEvent(
        schedFin.eventId,
        {
          actorId: admin,
          reason: "selfcheck replace with past transfer",
        },
        pool,
        db,
      );
      await clearRecalculationStatus(pool, person.id);
    }

    // --- Effective past Transfer: source −1, dest +1; capacity used moved ---
    const xferDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
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
    const xferFin = await finalizeDraft(
      {
        draftId: xferDraft.id,
        actorId: operator,
        expectedVersion: xferDraft.version,
        idempotencyKey: `hoh-xfer-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(xferFin.outcome, "finalized");
    await clearRecalculationStatus(pool, person.id);

    const afterXferSource = await getHistoricalOrgHeadcountState(
      { asOf: histAfterXfer, teamId: sourceTeamScoped.id },
      { personDb: db, eventDb: pool },
    );
    assert.equal(afterXferSource.ok, true);
    if (afterXferSource.ok) {
      assert.equal(afterXferSource.aggregate.teamMembershipCount, 0);
      assert.equal(
        afterXferSource.aggregate.used,
        0,
        "source used dropped after Effective Transfer",
      );
      assert.equal(afterXferSource.aggregate.reserved, 0);
    }

    const afterXferDest = await getHistoricalOrgHeadcountState(
      { asOf: histAfterXfer, teamId: destTeam.id },
      { personDb: db, eventDb: pool },
    );
    assert.equal(afterXferDest.ok, true);
    if (afterXferDest.ok) {
      assert.equal(afterXferDest.aggregate.teamMembershipCount, 1);
      assert.equal(afterXferDest.aggregate.used, 1);
      // Detail ≡ aggregate
      const rollup = afterXferDest.detail.teams.reduce(
        (s, t) => s + t.teamMembershipCount,
        0,
      );
      assert.equal(rollup, afterXferDest.aggregate.teamMembershipCount);
      assert.deepEqual(
        afterXferDest.detail.orgUnitCounts,
        afterXferDest.aggregate.orgUnitCounts,
      );
      assert.equal(
        afterXferDest.detail.headcount.aggregate.used,
        afterXferDest.aggregate.used,
      );
    }

    // Cancel of the future Scheduled Transfer is not historically active before its ED;
    // asOf-aware lifecycle may still show that reservation at histAfterXfer. Clean at today.
    const destTodayAfterXfer = await getHistoricalOrgHeadcountState(
      { asOf: today, teamId: destTeam.id },
      { personDb: db, eventDb: pool },
    );
    assert.equal(destTodayAfterXfer.ok, true);
    if (destTodayAfterXfer.ok) {
      assert.equal(destTodayAfterXfer.aggregate.used, 1);
      assert.equal(destTodayAfterXfer.aggregate.reserved, 0);
    }

    // Dual-consumer coordinator facts
    const afterXferDestB = await getHistoricalOrgHeadcountState(
      { asOf: histAfterXfer, teamId: destTeam.id },
      { personDb: db, eventDb: pool },
    );
    assert.equal(afterXferDestB.ok, true);
    if (afterXferDest.ok && afterXferDestB.ok) {
      assert.deepEqual(
        historicalOrgHeadcountFactsForCompare(afterXferDest),
        historicalOrgHeadcountFactsForCompare(afterXferDestB),
      );
    }

    // Historical before Effective: still on source
    const midHist = await getHistoricalOrgHeadcountState(
      { asOf: histBeforeXfer, teamId: sourceTeamScoped.id },
      { personDb: db, eventDb: pool },
    );
    assert.equal(midHist.ok, true);
    if (midHist.ok) {
      assert.equal(midHist.aggregate.teamMembershipCount, 1);
    }

    // --- Future asOf planned: facts @ today; no Effective label on planned ---
    const planned = await getHistoricalOrgHeadcountState(
      { asOf: future, teamId: destTeam.id },
      { personDb: db, eventDb: pool },
    );
    assert.equal(planned.ok, true);
    if (planned.ok) {
      assert.equal(planned.viewSemantics, "planned");
      assert.equal(planned.factsAsOf, today);
      assert.equal(planned.aggregate.teamMembershipCount, 1);
      for (const d of planned.plannedMembershipDeltas) {
        assert.equal(d.channel, "planned");
        assert.notEqual(d.channel, "Effective");
      }
    }

    // --- Baseline disclosure limited / unset ---
    delete process.env[BASELINE_BOUNDARY_ENV];
    const unsetBoundary = getBaselineBoundaryDate();
    assert.equal(unsetBoundary, null);
    const withUnset = await getHistoricalOrgHeadcountState(
      { asOf: today, teamId: destTeam.id, baselineBoundaryDate: null },
      { personDb: db, eventDb: pool },
    );
    assert.equal(withUnset.ok, true);
    if (withUnset.ok) {
      assert.equal(withUnset.baselineDisclosure.configured, false);
    }

    const limitedBoundary = addDays(today, -100);
    const withLimited = await getHistoricalOrgHeadcountState(
      {
        asOf: addDays(limitedBoundary, -1),
        teamId: destTeam.id,
        baselineBoundaryDate: limitedBoundary,
      },
      { personDb: db, eventDb: pool },
    );
    assert.equal(withLimited.ok, true);
    if (withLimited.ok) {
      assert.equal(withLimited.baselineDisclosure.limited, true);
      assert.equal(withLimited.baselineDisclosure.configured, true);
    }

    // Conservation identity per slot
    if (afterXferDest.ok) {
      for (const slot of afterXferDest.detail.headcount.slots) {
        assert.equal(
          slot.approved,
          slot.used + slot.reserved + slot.free,
          `conservation slot=${slot.slotId}`,
        );
      }
    }

    console.log("historical-org-headcount.selfcheck: OK");
  } finally {
    if (prevBaseline === undefined) {
      delete process.env[BASELINE_BOUNDARY_ENV];
    } else {
      process.env[BASELINE_BOUNDARY_ENV] = prevBaseline;
    }
    await pool.end();
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
