/**
 * Compensation / Contract personnel events selfcheck (Story 4.8 / FR-24).
 * Run: pnpm --filter @divan/person-employment selfcheck:personnel-event-compensation
 * Requires DATABASE_URL, migrated schema, seeded accounts + org/job fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  ensureCompensationDraftSidecarSchema,
  getCompensationAsOf,
  getCompensationDb,
  getContractualAsOf,
  peekDraftCompensationValues,
  putDraftCompensationValues,
} from "@divan/compensation-facts";
import { createPgPool } from "@divan/db";
import {
  ensureHeadcountCapacitySchema,
  seedDemoHeadcountCapacity,
} from "@divan/headcount";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  COMPENSATION_PRODUCT_RISK_TIERS,
  createDraft,
  createPerson,
  ELEMENT_ID,
  enableDataElement,
  finalizeDraft,
  getPersonDb,
  listEmploymentsForPerson,
  PersonnelEventError,
  PERSONNEL_EVENT_PRODUCT_RISK_TIERS,
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

const COMP_META = {
  ownerSource: "AR-DATA partial freeze 2026-07-16",
  retention: "workforce-master-data retention (AR-DATA)",
  export: "governed export only (FR-50+)",
  audit: "access-event + identity change audit",
} as const;

async function promoteCompensationElement(
  db: ReturnType<typeof getPersonDb>,
  elementId: string,
  purpose: string,
  format: string,
  sensitivity: string,
  access: string,
): Promise<void> {
  await db.dataElement.update({
    where: { elementId },
    data: {
      disposition: "approve",
      purpose,
      ownerSource: COMP_META.ownerSource,
      format,
      sensitivity,
      access,
      retention: COMP_META.retention,
      export: COMP_META.export,
      audit: COMP_META.audit,
    },
  });
  await enableDataElement(elementId, db);
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
  resetProjectionRefreshHook();

  await seedPrimaryAssignmentFixtures(db);
  await seedPersonnelEventPermissionFixtures(db);
  await ensureHeadcountCapacitySchema(pool);
  const { slotId: sourceSlotId } = await seedDemoHeadcountCapacity(db, pool);
  await ensureCompensationDraftSidecarSchema(compDb);

  await promoteCompensationElement(
    db,
    ELEMENT_ID.compensationAmount,
    "Monetary compensation amount for contractual facts",
    "decimal string canonical; no currency symbol",
    "sensitive",
    "compensation.write + compensation.read",
  );
  await promoteCompensationElement(
    db,
    ELEMENT_ID.compensationCurrency,
    "ISO currency code for compensation facts",
    "ISO 4217 code; e.g. IRR",
    "ordinary",
    "compensation.read",
  );
  await promoteCompensationElement(
    db,
    ELEMENT_ID.compensationChangeType,
    "Reason/category for compensation change events",
    "controlled vocabulary code",
    "ordinary",
    "compensation.read",
  );
  await promoteCompensationElement(
    db,
    ELEMENT_ID.contractType,
    "Contract type for contractual facts",
    "controlled vocabulary code",
    "ordinary",
    "compensation.read",
  );
  await promoteCompensationElement(
    db,
    ELEMENT_ID.contractCollaborationType,
    "Dated collaboration type on contractual facts",
    "controlled vocabulary code",
    "ordinary",
    "compensation.read",
  );

  const jobRefs = await resolveJobRefs(db);
  const sourceTeam = await db.organizationalUnit.findUniqueOrThrow({
    where: { code: SEED_ORGANIZATION_HIERARCHY.teamActive.code },
  });

  const admin =
    (await db.internalAccount.findUnique({ where: { username: "hr.admin" } }))
      ?.id ?? "selfcheck-admin";
  const operator =
    (await db.internalAccount.findUnique({ where: { username: "hr.operator" } }))
      ?.id ?? "selfcheck-operator";

  const suffix = randomUUID().slice(0, 8);
  const today = todayDateOnlyTehran();
  const startEd = priorDateOnly(today);
  const future = addDays(today, 45);

  try {
    // --- 1. Start employment ---
    const person = await createPerson(
      {
        personnelCode: `59${suffix.slice(0, 4)}`,
        givenName: "آزمایش",
        familyName: "جبران‌خدمت",
        mobilePhone: "09125900001",
      },
      { accountId: operator, correlationId: `sc-comp-${suffix}` },
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
        idempotencyKey: `comp-start-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(startFin.outcome, "finalized");
    const employmentId = (await listEmploymentsForPerson(person.id, db))[0]!.id;
    const compBefore = await getCompensationAsOf(person.id, today, compDb);
    assert.equal(compBefore, null);

    // --- 2. createDraft CompensationChanged without amount in payload ---
    const compDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "CompensationChanged",
        effectiveDate: today,
        payload: {
          employmentId,
          currency: "IRR",
          changeType: "adjustment",
        },
      },
      { accountId: admin },
      db,
    );
    assert.equal(compDraft.payload.amount, undefined);

    // --- 3. Sensitive amount in payload → SENSITIVE_PAYLOAD ---
    await assert.rejects(
      () =>
        createDraft(
          {
            personId: person.id,
            employmentId,
            eventType: "CompensationChanged",
            effectiveDate: today,
            payload: {
              employmentId,
              currency: "IRR",
              changeType: "adjustment",
              amount: "15000000",
            },
          },
          { accountId: admin },
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof PersonnelEventError);
        assert.equal(err.code, "SENSITIVE_PAYLOAD");
        return true;
      },
    );

    // --- 4. putDraftCompensationValues sidecar ---
    await putDraftCompensationValues(compDraft.id, { amount: "15000000" }, compDb);
    const sidecarPeek = await peekDraftCompensationValues(compDraft.id, compDb);
    assert.equal(sidecarPeek?.amount, "15000000");

    // --- 5. finalize without risk tiers → pending_review ---
    const pendingFin = await finalizeDraft(
      {
        draftId: compDraft.id,
        actorId: admin,
        expectedVersion: compDraft.version,
      },
      pool,
      db,
    );
    assert.equal(pendingFin.outcome, "pending_review");
    if (pendingFin.outcome === "pending_review") {
      assert.equal(pendingFin.draft.status, "pending_review");
    }
    assert.equal(await getCompensationAsOf(person.id, today, compDb), null);

    // --- 6. finalize with risk tiers as admin → Effective + fact + empty sidecar ---
    const compFin = await finalizeDraft(
      {
        draftId: compDraft.id,
        actorId: admin,
        riskTier: PERSONNEL_EVENT_PRODUCT_RISK_TIERS,
        idempotencyKey: `comp-eff-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(compFin.outcome, "finalized");
    assert.ok(compFin.outcome === "finalized" && compFin.status === "Effective");
    const compEventId =
      compFin.outcome === "finalized" ? compFin.eventId : "";

    const compFact = await getCompensationAsOf(person.id, today, compDb);
    assert.ok(compFact);
    assert.equal(compFact!.amount, "15000000");
    assert.equal(compFact!.sourceEventId, compEventId);
    assert.equal(await peekDraftCompensationValues(compDraft.id, compDb), null);

    // --- 7. Retry finalize → same event id ---
    const compRetry = await finalizeDraft(
      {
        draftId: compDraft.id,
        actorId: admin,
        idempotencyKey: `comp-eff-${suffix}`,
        riskTier: PERSONNEL_EVENT_PRODUCT_RISK_TIERS,
      },
      pool,
      db,
    );
    assert.equal(compRetry.outcome, "finalized");
    assert.equal(
      compRetry.outcome === "finalized" ? compRetry.eventId : "",
      compEventId,
    );

    // --- 8. Operator without compensation.write → PERMISSION_DENIED ---
    const opDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "CompensationChanged",
        effectiveDate: today,
        payload: {
          employmentId,
          currency: "IRR",
          changeType: "adjustment",
        },
      },
      { accountId: operator },
      db,
    );
    await putDraftCompensationValues(opDraft.id, { amount: "16000000" }, compDb);
    await assert.rejects(
      () =>
        finalizeDraft(
          {
            draftId: opDraft.id,
            actorId: operator,
            expectedVersion: opDraft.version,
            riskTier: COMPENSATION_PRODUCT_RISK_TIERS,
          },
          pool,
          db,
        ),
      (err: unknown) => {
        assert.ok(err instanceof PersonnelEventError);
        assert.equal(err.code, "PERMISSION_DENIED");
        return true;
      },
    );

    // --- 9. ContractChanged structural finalize with risk tiers ---
    const contractDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "ContractChanged",
        effectiveDate: today,
        payload: {
          employmentId,
          collaborationType: SEED_EMPLOYMENT_LIFECYCLE.collaborationActive,
          contractType: "fixed_term",
        },
      },
      { accountId: admin },
      db,
    );
    const contractFin = await finalizeDraft(
      {
        draftId: contractDraft.id,
        actorId: admin,
        expectedVersion: contractDraft.version,
        riskTier: COMPENSATION_PRODUCT_RISK_TIERS,
        idempotencyKey: `comp-contract-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(contractFin.outcome, "finalized");
    assert.ok(
      contractFin.outcome === "finalized" && contractFin.status === "Effective",
    );
    const contractEventId =
      contractFin.outcome === "finalized" ? contractFin.eventId : "";
    const contractual = await getContractualAsOf(person.id, today, compDb);
    assert.ok(contractual);
    assert.equal(contractual!.contractType, "fixed_term");
    assert.equal(contractual!.sourceEventId, contractEventId);

    // --- 10. Scheduled CompensationChanged future → no fact mutation today ---
    const futureDraft = await createDraft(
      {
        personId: person.id,
        employmentId,
        eventType: "CompensationChanged",
        effectiveDate: future,
        payload: {
          employmentId,
          currency: "IRR",
          changeType: "adjustment",
        },
      },
      { accountId: admin },
      db,
    );
    await putDraftCompensationValues(
      futureDraft.id,
      { amount: "20000000" },
      compDb,
    );
    const futureFin = await finalizeDraft(
      {
        draftId: futureDraft.id,
        actorId: admin,
        expectedVersion: futureDraft.version,
        riskTier: PERSONNEL_EVENT_PRODUCT_RISK_TIERS,
        idempotencyKey: `comp-future-${suffix}`,
      },
      pool,
      db,
    );
    assert.equal(futureFin.outcome, "finalized");
    assert.ok(
      futureFin.outcome === "finalized" && futureFin.status === "Scheduled",
    );

    const compTodayAfterSched = await getCompensationAsOf(person.id, today, compDb);
    assert.ok(compTodayAfterSched);
    assert.equal(compTodayAfterSched!.amount, "15000000");
    assert.equal(compTodayAfterSched!.sourceEventId, compEventId);
    const compAtFuture = await getCompensationAsOf(person.id, future, compDb);
    assert.ok(compAtFuture);
    assert.equal(
      compAtFuture!.amount,
      "15000000",
      "Scheduled Compensation must not open future fact before ED evaluation",
    );
    assert.equal(compAtFuture!.sourceEventId, compEventId);

    console.log("personnel-event-compensation.selfcheck: OK");
  } finally {
    resetProjectionRefreshHook();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
