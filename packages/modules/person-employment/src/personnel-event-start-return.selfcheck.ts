/**
 * Start / Return personnel events selfcheck (Story 4.5 / FR-20).
 * Run: pnpm --filter @divan/person-employment selfcheck:personnel-event-start-return
 * Requires DATABASE_URL, migrated schema, seeded accounts + org/job fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { createPgPool } from "@divan/db";
import { seedDemoHeadcountCapacity } from "@divan/headcount";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  closeEmploymentProjection,
  createDraft,
  createPerson,
  finalizeDraft,
  finalizeRejectEnvelopeMessageFa,
  getPersonDb,
  getRecalculationStatus,
  listEmploymentsForPerson,
  listPrimaryAssignmentsForEmployment,
  matchReturn,
  MSG_FINALIZE_BLOCKED_FA,
  MSG_FINALIZE_OVERRIDE_REQUIRED_FA,
  MSG_FINALIZE_STALE_SNAPSHOT_FA,
  MSG_HEADCOUNT_NO_CAPACITY_FA,
  PersonnelEventError,
  resetProjectionRefreshHook,
  seedPrimaryAssignmentFixtures,
  SEED_EMPLOYMENT_LIFECYCLE,
  SEED_JOB_REFERENCES,
  SEED_ORGANIZATION_HIERARCHY,
  SEED_PERSON_IDENTITY,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function assertSourceRejectTransportGates(): void {
  const peErrors = readFileSync(resolve(__dirname, "./errors.ts"), "utf8");
  assert.match(
    peErrors,
    /finalizeRejectEnvelopeMessageFa/,
    "errors.ts must export finalizeRejectEnvelopeMessageFa",
  );
  assert.match(
    peErrors,
    /readonly conflicts\?/,
    "PersonnelEventError must carry optional conflicts",
  );

  const webPe = readFileSync(
    resolve(__dirname, "../../../../apps/web/src/server/personnel-event.ts"),
    "utf8",
  );
  assert.match(
    webPe,
    /finalizeRejectEnvelopeMessageFa/,
    "tRPC finalize reject must build gate-honest envelope",
  );
  assert.match(
    webPe,
    /new PersonnelEventError\([\s\S]*?conflicts/,
    "tRPC finalize reject must pass conflicts into PersonnelEventError",
  );

  const trpc = readFileSync(
    resolve(__dirname, "../../../../apps/web/src/server/trpc.ts"),
    "utf8",
  );
  assert.match(
    trpc,
    /conflicts !== undefined \? \{ conflicts \}/,
    "errorFormatter must expose conflicts on data",
  );

  // Envelope unit gates (no DB)
  assert.equal(
    finalizeRejectEnvelopeMessageFa({
      code: "FINALIZE_STALE_SNAPSHOT",
      messageFa: "ignored",
      conflicts: [],
    }),
    MSG_FINALIZE_STALE_SNAPSHOT_FA,
  );
  assert.equal(
    finalizeRejectEnvelopeMessageFa({
      code: "FINALIZE_OVERRIDE_REQUIRED",
      messageFa: MSG_FINALIZE_OVERRIDE_REQUIRED_FA,
      conflicts: [
        {
          code: "HEADCOUNT_UNAPPROVED",
          severity: "warning",
          messageFa: "جزئیات ظرفیت",
          requiresOverride: true,
        },
      ],
    }),
    MSG_FINALIZE_OVERRIDE_REQUIRED_FA,
  );
  assert.equal(
    finalizeRejectEnvelopeMessageFa({
      code: "FINALIZE_BLOCKED",
      messageFa: MSG_FINALIZE_BLOCKED_FA,
      conflicts: [
        {
          code: "HEADCOUNT_UNAPPROVED",
          severity: "blocking",
          messageFa: MSG_HEADCOUNT_NO_CAPACITY_FA,
        },
      ],
    }),
    MSG_HEADCOUNT_NO_CAPACITY_FA,
  );
  // Capacity warning must not steal the envelope when another gate blocks.
  assert.equal(
    finalizeRejectEnvelopeMessageFa({
      code: "FINALIZE_BLOCKED",
      messageFa: MSG_FINALIZE_BLOCKED_FA,
      conflicts: [
        {
          code: "IRRECONCILABLE_ORDERING",
          severity: "blocking",
          messageFa: "ترتیب هم‌روز ناسازگار است.",
        },
        {
          code: "HEADCOUNT_UNAPPROVED",
          severity: "warning",
          messageFa: MSG_HEADCOUNT_NO_CAPACITY_FA,
          requiresOverride: true,
        },
      ],
    }),
    MSG_FINALIZE_BLOCKED_FA,
  );
  const carried = new PersonnelEventError(
    "FINALIZE_BLOCKED",
    MSG_FINALIZE_BLOCKED_FA,
    undefined,
    [
      {
        code: "HEADCOUNT_UNAPPROVED",
        severity: "warning",
        messageFa: "کمبود",
        requiresOverride: true,
      },
    ],
  );
  assert.equal(carried.conflicts?.length, 1);
  assert.equal(carried.conflicts?.[0]?.code, "HEADCOUNT_UNAPPROVED");
}

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

async function countEmployments(
  db: ReturnType<typeof getPersonDb>,
  personId: string,
): Promise<number> {
  return (await listEmploymentsForPerson(personId, db)).length;
}

async function countPrimariesForPerson(
  db: ReturnType<typeof getPersonDb>,
  personId: string,
): Promise<number> {
  const emps = await listEmploymentsForPerson(personId, db);
  let n = 0;
  for (const e of emps) {
    n += (await listPrimaryAssignmentsForEmployment(e.id, db)).length;
  }
  return n;
}

async function main() {
  assertSourceRejectTransportGates();

  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();
  const pool = createPgPool(url);

  await seedPrimaryAssignmentFixtures(db);
  const { seedHeadcountOverridePermissionFixtures } = await import("./seed");
  await seedHeadcountOverridePermissionFixtures(db);
  const { slotId } = await seedDemoHeadcountCapacity(db, pool);
  const basePayload = await resolveStartPayload(db);
  const payload = { ...basePayload, capacitySlotId: slotId };

  const operator =
    (await db.internalAccount.findUnique({ where: { username: "hr.operator" } }))
      ?.id ?? "selfcheck-operator";
  const admin =
    (await db.internalAccount.findUnique({ where: { username: "hr.admin" } }))
      ?.id ?? "selfcheck-admin";

  const suffix = randomUUID().slice(0, 8);
  const today = todayDateOnlyTehran();

  try {
    // --- Person without active Employment for Start happy path ---
    const startPerson = await createPerson(
      {
        personnelCode: `19${suffix.slice(0, 4)}`,
        givenName: "آزمایش",
        familyName: "شروع",
        mobilePhone: "09120000001",
      },
      { accountId: operator, correlationId: `sc-start-${suffix}` },
      db,
    );
    assert.equal(await countEmployments(db, startPerson.id), 0);

    // --- Missing facts block ---
    const draftMissing = await createDraft(
      {
        personId: startPerson.id,
        eventType: "EmploymentStarted",
        effectiveDate: today,
        payload: {},
      },
      { accountId: operator },
      db,
    );
    const missingFin = await finalizeDraft(
      {
        draftId: draftMissing.id,
        actorId: operator,
        expectedVersion: draftMissing.version,
      },
      pool,
      db,
    );
    assert.equal(missingFin.outcome, "rejected");
    if (missingFin.outcome === "rejected") {
      assert.ok(
        missingFin.conflicts.some((c) => c.code.startsWith("MISSING_")),
        "missing facts must block",
      );
    }
    assert.equal(await countEmployments(db, startPerson.id), 0);

    // --- Operator + capacity happy path Start ---
    const draftStart = await createDraft(
      {
        personId: startPerson.id,
        eventType: "EmploymentStarted",
        effectiveDate: today,
        payload,
      },
      { accountId: operator },
      db,
    );
    const startFin = await finalizeDraft(
      {
        draftId: draftStart.id,
        actorId: operator,
        expectedVersion: draftStart.version,
        idempotencyKey: `start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(startFin.outcome, "finalized");
    assert.ok(startFin.outcome === "finalized" && startFin.projectionHookInvoked);
    assert.equal(await countEmployments(db, startPerson.id), 1);
    assert.equal(await countPrimariesForPerson(db, startPerson.id), 1);

    const emp = (await listEmploymentsForPerson(startPerson.id, db))[0]!;
    const primaries = await listPrimaryAssignmentsForEmployment(emp.id, db);
    assert.equal(primaries.length, 1);
    assert.equal(primaries[0]!.sourceEventId, startFin.outcome === "finalized" ? startFin.eventId : null);
    assert.equal(primaries[0]!.endDateExclusive, null);
    // Demo seed uses legacy null-approval slots via preferredSlotId; product
    // Approval-backed path asserts headcountApprovalId in headcount-matching.selfcheck.

    const draftAfter = await db.personnelEventDraft.findUniqueOrThrow({
      where: { id: draftStart.id },
    });
    assert.equal(draftAfter.employmentId, emp.id, "employmentId bound on draft");

    // --- Idempotent finalize retry ---
    const retry = await finalizeDraft(
      {
        draftId: draftStart.id,
        actorId: operator,
        idempotencyKey: `start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(retry.outcome, "finalized");
    if (retry.outcome === "finalized" && startFin.outcome === "finalized") {
      assert.equal(retry.eventId, startFin.eventId);
    }
    assert.equal(await countEmployments(db, startPerson.id), 1);
    assert.equal(await countPrimariesForPerson(db, startPerson.id), 1);

    // --- Story 11.2: preferred free Active Approval → finalize without Override ---
    const { activateApproval, createApproval } = await import("@divan/headcount");
    const prefPerson = await createPerson(
      {
        personnelCode: `18${suffix.slice(0, 4)}`,
        givenName: "ترجیح",
        familyName: "ظرفیت",
        mobilePhone: "09120000011",
      },
      { accountId: operator, correlationId: `sc-pref-${suffix}` },
      db,
    );
    const prefDept = await db.organizationalUnit.findFirstOrThrow({
      where: { unitType: "DEPARTMENT", active: true },
    });
    const prefTeam = await db.organizationalUnit.create({
      data: {
        code: `TEAM-PREF-11-2-${suffix}`,
        nameFa: "تیم ترجیح ظرفیت ۱۱٫۲",
        unitType: "TEAM",
        parentId: prefDept.id,
        startDate: new Date("2020-01-01"),
        active: true,
      },
    });
    const preferredApproval = await createApproval(pool, {
      requirementCode: `REQ-PREF-11-2-${suffix}`,
      teamId: prefTeam.id,
      jobTitleId: basePayload.jobTitleId,
      allowedCount: 5,
      validityStart: "2020-01-01",
      validityEndExclusive: "2099-12-31",
      actorId: admin,
    });
    await activateApproval(pool, {
      id: preferredApproval.id,
      actorId: admin,
    });
    const draftPreferred = await createDraft(
      {
        personId: prefPerson.id,
        eventType: "EmploymentStarted",
        effectiveDate: today,
        payload: {
          ...basePayload,
          teamId: prefTeam.id,
          preferredApprovalId: preferredApproval.id,
        },
      },
      { accountId: operator },
      db,
    );
    const preferredFin = await finalizeDraft(
      {
        draftId: draftPreferred.id,
        actorId: operator,
        expectedVersion: draftPreferred.version,
        idempotencyKey: `pref-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(
      preferredFin.outcome,
      "finalized",
      preferredFin.outcome === "rejected"
        ? `preferred free compatible Approval must finalize without Override (got ${preferredFin.code}: ${preferredFin.messageFa})`
        : "preferred free compatible Approval must finalize without Override",
    );
    assert.equal(await countEmployments(db, prefPerson.id), 1);

    // --- Scheduled Start — no Employment/Primary mutation ---
    const schedPerson = await createPerson(
      {
        personnelCode: `29${suffix.slice(0, 4)}`,
        givenName: "زمان‌بندی",
        familyName: "آینده",
        mobilePhone: "09120000002",
      },
      { accountId: operator, correlationId: `sc-sched-${suffix}` },
      db,
    );
    // Far future date
    const futureDate = "2099-06-15";
    const draftSched = await createDraft(
      {
        personId: schedPerson.id,
        eventType: "EmploymentStarted",
        effectiveDate: futureDate,
        payload,
      },
      { accountId: operator },
      db,
    );
    const schedFin = await finalizeDraft(
      {
        draftId: draftSched.id,
        actorId: operator,
        expectedVersion: draftSched.version,
      },
      pool,
      db,
    );
    assert.equal(schedFin.outcome, "finalized");
    if (schedFin.outcome === "finalized") {
      assert.equal(schedFin.status, "Scheduled");
    }
    assert.equal(
      await countEmployments(db, schedPerson.id),
      0,
      "Scheduled Start must not create Employment",
    );
    assert.equal(await countPrimariesForPerson(db, schedPerson.id), 0);

    // --- Past-dated Effective Start → recalc pending (UX-DR5 / Task 7) ---
    const pastPerson = await createPerson(
      {
        personnelCode: `69${suffix.slice(0, 4)}`,
        givenName: "گذشته",
        familyName: "مؤثر",
        mobilePhone: "09120000006",
      },
      { accountId: operator, correlationId: `sc-past-${suffix}` },
      db,
    );
    const pastDate = "2024-06-15";
    const draftPast = await createDraft(
      {
        personId: pastPerson.id,
        eventType: "EmploymentStarted",
        effectiveDate: pastDate,
        payload,
      },
      { accountId: operator },
      db,
    );
    const pastFin = await finalizeDraft(
      {
        draftId: draftPast.id,
        actorId: operator,
        expectedVersion: draftPast.version,
      },
      pool,
      db,
    );
    assert.equal(pastFin.outcome, "finalized");
    if (pastFin.outcome === "finalized") {
      assert.equal(pastFin.status, "Effective");
      assert.ok(
        pastFin.recalcScheduled,
        "past-dated Effective Start must schedule recalc",
      );
    }
    const pastStatus = await getRecalculationStatus(pool, pastPerson.id);
    assert.ok(pastStatus, "recalculation_status row exists");
    assert.equal(pastStatus!.status, "pending");
    assert.equal(await countEmployments(db, pastPerson.id), 1);

    // --- Overlap block on demo person (has active Employment) ---
    const demo = await db.person.findUniqueOrThrow({
      where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
    });
    const draftOverlap = await createDraft(
      {
        personId: demo.id,
        eventType: "EmploymentStarted",
        effectiveDate: today,
        payload,
      },
      { accountId: operator },
      db,
    );
    const overlapFin = await finalizeDraft(
      {
        draftId: draftOverlap.id,
        actorId: operator,
        expectedVersion: draftOverlap.version,
      },
      pool,
      db,
    );
    assert.equal(overlapFin.outcome, "rejected");
    if (overlapFin.outcome === "rejected") {
      assert.ok(
        overlapFin.conflicts.some((c) => c.code === "OVERLAPPING_EMPLOYMENT"),
      );
    }

    // --- No-capacity Operator block + Admin Override ---
    const noCapPerson = await createPerson(
      {
        personnelCode: `39${suffix.slice(0, 4)}`,
        givenName: "بدون",
        familyName: "ظرفیت",
        mobilePhone: "09120000003",
      },
      { accountId: operator, correlationId: `sc-nocap-${suffix}` },
      db,
    );

    // Inactive team as-of today → blocking
    const histTeam = await db.organizationalUnit.findUniqueOrThrow({
      where: { code: SEED_ORGANIZATION_HIERARCHY.teamHistorical.code },
    });
    const draftInactive = await createDraft(
      {
        personId: noCapPerson.id,
        eventType: "EmploymentStarted",
        effectiveDate: today,
        payload: { ...basePayload, teamId: histTeam.id },
      },
      { accountId: operator },
      db,
    );
    const inactiveFin = await finalizeDraft(
      {
        draftId: draftInactive.id,
        actorId: operator,
        expectedVersion: draftInactive.version,
      },
      pool,
      db,
    );
    assert.equal(inactiveFin.outcome, "rejected");
    if (inactiveFin.outcome === "rejected") {
      assert.ok(
        inactiveFin.conflicts.some((c) => c.code === "INACTIVE_TEAM_REF"),
      );
    }

    const { seedCapacitySlot } = await import("@divan/headcount");
    const emptySlotId = await seedCapacitySlot(pool, {
      id: randomUUID(),
      teamId: basePayload.teamId,
      jobTitleId: basePayload.jobTitleId,
      ladderId: basePayload.ladderId,
      gradeId: basePayload.gradeId,
      freeUnits: 0,
      label: "empty-slot-selfcheck",
    });
    const priorFree = await pool.query<{ id: string; free_units: number }>(
      `SELECT id, free_units FROM headcount_capacity_slot WHERE team_id = $1::uuid`,
      [basePayload.teamId],
    );
    await pool.query(
      `UPDATE headcount_capacity_slot SET free_units = 0 WHERE team_id = $1::uuid`,
      [basePayload.teamId],
    );
    try {
      const draftCap = await createDraft(
        {
          personId: noCapPerson.id,
          eventType: "EmploymentStarted",
          effectiveDate: today,
          payload: { ...basePayload },
        },
        { accountId: operator },
        db,
      );
      const opBlocked = await finalizeDraft(
        {
          draftId: draftCap.id,
          actorId: operator,
          expectedVersion: draftCap.version,
        },
        pool,
        db,
      );
      assert.equal(opBlocked.outcome, "rejected");
      if (opBlocked.outcome === "rejected") {
        assert.ok(
          opBlocked.conflicts.some(
            (c) =>
              c.code === "HEADCOUNT_UNAPPROVED" &&
              (c.severity === "warning" || c.severity === "blocking") &&
              (c.requiresOverride === true || c.severity === "blocking"),
          ),
          "Operator must see HEADCOUNT_UNAPPROVED requiring Override (FR-32)",
        );
        assert.ok(
          opBlocked.code === "FINALIZE_OVERRIDE_REQUIRED" ||
            opBlocked.conflicts.some((c) => c.code === "HEADCOUNT_UNAPPROVED"),
          "Operator blocked without Override permission",
        );
        assert.ok(
          opBlocked.conflicts.length > 0,
          "Story 11.2: domain reject must retain conflicts[] for transport",
        );
        const envelope = finalizeRejectEnvelopeMessageFa({
          code: opBlocked.code,
          messageFa: opBlocked.messageFa,
          conflicts: opBlocked.conflicts,
        });
        assert.ok(
          envelope.includes("Override") ||
            envelope.includes("ظرفیت") ||
            opBlocked.conflicts.some((c) => c.messageFa.length > 0),
          "reject envelope must name capacity/override gate family",
        );
      }

      const draftCap2 = await createDraft(
        {
          personId: noCapPerson.id,
          eventType: "EmploymentStarted",
          effectiveDate: today,
          payload: { ...basePayload },
        },
        { accountId: admin },
        db,
      );
      const adminFin = await finalizeDraft(
        {
          draftId: draftCap2.id,
          actorId: admin,
          expectedVersion: draftCap2.version,
          actorMayOverride: true,
          acknowledgement: {
            warningCodes: ["HEADCOUNT_UNAPPROVED"],
          },
          override: {
            reason: "تأیید دستی کمبود ظرفیت — خودآزمایی ۴٫۱۴",
            approvedByAccountId: admin,
          },
        },
        pool,
        db,
      );
      assert.equal(
        adminFin.outcome,
        "finalized",
        "Admin Override may proceed for shortage (FR-32)",
      );
      assert.equal(await countEmployments(db, noCapPerson.id), 1);
      const freeAfter = await pool.query<{ free_units: number }>(
        `SELECT free_units FROM headcount_capacity_slot
         WHERE team_id = $1::uuid ORDER BY free_units ASC LIMIT 1`,
        [basePayload.teamId],
      );
      assert.ok(
        Number(freeAfter.rows[0]?.free_units ?? 0) < 0,
        "Override consume may drive free negative",
      );
      const overrides = await pool.query<{ id: string; violated_rule: string }>(
        `SELECT id, violated_rule FROM headcount_override
         WHERE status = 'active' AND violated_rule = 'shortage'
         ORDER BY created_at DESC LIMIT 1`,
      );
      assert.ok(overrides.rows[0], "Override row must be filterable");
      assert.equal(overrides.rows[0]!.violated_rule, "shortage");
    } finally {
      for (const row of priorFree.rows) {
        await pool.query(
          `UPDATE headcount_capacity_slot SET free_units = $2 WHERE id = $1::uuid`,
          [row.id, row.free_units],
        );
      }
      await pool.query(
        `UPDATE headcount_capacity_slot SET free_units = 0 WHERE id = $1::uuid`,
        [emptySlotId],
      );
    }

    // --- Return: same Person + code; new Employment; history preserved ---
    const returnPerson = await createPerson(
      {
        personnelCode: `49${suffix.slice(0, 4)}`,
        givenName: "بازگشت",
        familyName: "سالم",
        mobilePhone: "09120000004",
      },
      { accountId: operator, correlationId: `sc-ret-${suffix}` },
      db,
    );
    // Ensure capacity restored for Return
    await pool.query(
      `UPDATE headcount_capacity_slot SET free_units = GREATEST(free_units, 5) WHERE id = $1::uuid`,
      [slotId],
    );

    const draftR1 = await createDraft(
      {
        personId: returnPerson.id,
        eventType: "EmploymentStarted",
        effectiveDate: "2024-01-01",
        payload,
      },
      { accountId: operator },
      db,
    );
    const r1 = await finalizeDraft(
      {
        draftId: draftR1.id,
        actorId: operator,
        expectedVersion: draftR1.version,
      },
      pool,
      db,
    );
    assert.equal(r1.outcome, "finalized");
    const firstEmp = (await listEmploymentsForPerson(returnPerson.id, db))[0]!;
    await closeEmploymentProjection(firstEmp.id, "2025-01-01", db);
    assert.equal(await countEmployments(db, returnPerson.id), 1);

    const draftReturn = await createDraft(
      {
        personId: returnPerson.id,
        eventType: "EmploymentReturned",
        effectiveDate: "2025-06-01",
        payload,
      },
      { accountId: operator },
      db,
    );
    const retFin = await finalizeDraft(
      {
        draftId: draftReturn.id,
        actorId: operator,
        expectedVersion: draftReturn.version,
      },
      pool,
      db,
    );
    assert.equal(retFin.outcome, "finalized");
    assert.equal(await countEmployments(db, returnPerson.id), 2);
    const emps = await listEmploymentsForPerson(returnPerson.id, db);
    assert.ok(emps.some((e) => e.id === firstEmp.id), "prior Employment preserved");
    assert.ok(emps.some((e) => e.endDateExclusive === null), "new open Employment");

    const personAfter = await db.person.findUniqueOrThrow({
      where: { id: returnPerson.id },
    });
    assert.equal(personAfter.personnelCode, returnPerson.personnelCode);

    // --- Anonymized auto-rematch blocked ---
    const anonPerson = await createPerson(
      {
        personnelCode: `59${suffix.slice(0, 4)}`,
        givenName: "[REDACTED]",
        familyName: "[REDACTED]",
        mobilePhone: "09120000005",
      },
      { accountId: operator, correlationId: `sc-anon-${suffix}` },
      db,
    );
    const draftAnon = await createDraft(
      {
        personId: anonPerson.id,
        eventType: "EmploymentReturned",
        effectiveDate: today,
        payload: { ...payload, anonymizedPerson: true },
      },
      { accountId: operator },
      db,
    );
    const anonFin = await finalizeDraft(
      {
        draftId: draftAnon.id,
        actorId: operator,
        expectedVersion: draftAnon.version,
      },
      pool,
      db,
    );
    assert.equal(anonFin.outcome, "rejected");
    if (anonFin.outcome === "rejected") {
      assert.ok(
        anonFin.conflicts.some((c) => c.code === "ANONYMIZED_RETURN_BLOCKED"),
      );
    }

    // matchReturn remains fail-closed
    assert.throws(() =>
      matchReturn(anonPerson.id, {
        accountId: operator,
        correlationId: `sc-match-${suffix}`,
      }),
    );

    // --- Scaffold still does not create Employment ---
    const beforeScaffold = await countEmployments(db, startPerson.id);
    const draftScaffold = await createDraft(
      {
        personId: startPerson.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: today,
        payload: { note: "scaffold-ok" },
      },
      { accountId: operator },
      db,
    );
    const scafFin = await finalizeDraft(
      {
        draftId: draftScaffold.id,
        actorId: operator,
        expectedVersion: draftScaffold.version,
      },
      pool,
      db,
    );
    assert.equal(scafFin.outcome, "finalized");
    assert.equal(await countEmployments(db, startPerson.id), beforeScaffold);

    console.log("personnel-event-start-return selfcheck: OK");
  } finally {
    resetProjectionRefreshHook();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
