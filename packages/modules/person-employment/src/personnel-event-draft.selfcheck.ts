/**
 * Personnel Event Draft / finalize selfcheck (Story 4.2 / FR-15 / FR-19 / AD-6).
 * Run: pnpm --filter @divan/person-employment selfcheck:personnel-event-draft
 * Requires DATABASE_URL, migrated Draft table + kernel_events SQL, seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { createPgPool } from "@divan/db";
import { withTransaction } from "@divan/event-store";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  PersonnelEventError,
  createDraft,
  deleteDraft,
  finalizeDraft,
  getDraft,
  getPersonDb,
  resetProjectionRefreshHook,
  seedPersonIdentityFixtures,
  setProjectionRefreshHook,
  updateDraft,
  SEED_PERSON_IDENTITY,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function countBusinessEvents(
  pool: ReturnType<typeof createPgPool>,
  personId: string,
  draftId: string,
): Promise<number> {
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM kernel_events
     WHERE event_class = 'business'
       AND person_id = $1::uuid
       AND payload->>'draftId' = $2`,
    [personId, draftId],
  );
  return r.rows[0]?.n ?? 0;
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();
  const pool = createPgPool(url);
  await seedPersonIdentityFixtures(db);

  const demo = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  assert.ok(demo, "demo person required");

  const actor =
    (await db.internalAccount.findUnique({ where: { username: "hr.operator" } }))
      ?.id ?? "selfcheck-actor";

  let hookCalls = 0;
  setProjectionRefreshHook(async (ctx) => {
    hookCalls += 1;
    ctx.invoked = { eventId: ctx.eventId, eventType: ctx.eventType };
  });

  try {
    // --- Create / edit / delete Draft: no kernel_events, no projection ---
    const draft = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: "2025-06-15",
        payload: { note: "scaffold" },
      },
      { accountId: actor },
      db,
    );
    assert.equal(draft.status, "open");
    assert.equal(draft.version, 1);

    const beforeCreate = await countBusinessEvents(pool, demo.id, draft.id);
    assert.equal(beforeCreate, 0, "draft create must not append kernel event");

    const updated = await updateDraft(
      {
        draftId: draft.id,
        expectedVersion: 1,
        effectiveDate: "2025-07-01",
        payload: { note: "edited" },
      },
      { accountId: actor },
      db,
    );
    assert.equal(updated.version, 2);
    assert.equal(updated.effectiveDate, "2025-07-01");
    assert.equal(
      await countBusinessEvents(pool, demo.id, draft.id),
      0,
      "draft update must not append",
    );

    const deleted = await deleteDraft(draft.id, 2, { accountId: actor }, db);
    assert.equal(deleted.status, "deleted");

    // Cannot finalize deleted
    await assert.rejects(
      () =>
        finalizeDraft(
          { draftId: draft.id, actorId: actor },
          pool,
          db,
        ),
      (err: unknown) =>
        err instanceof PersonnelEventError && err.code === "DRAFT_DELETED",
    );

    // --- Finalize happy path ---
    const draft2 = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: "2025-06-15",
        payload: { scaffold: true },
      },
      { accountId: actor },
      db,
    );
    const idem = `selfcheck-finalize-${draft2.id}`;
    hookCalls = 0;
    const fin = await finalizeDraft(
      {
        draftId: draft2.id,
        actorId: actor,
        idempotencyKey: idem,
        expectedVersion: draft2.version,
        correlationId: randomUUID(),
      },
      pool,
      db,
    );
    assert.equal(fin.outcome, "finalized");
    if (fin.outcome !== "finalized") throw new Error("expected finalized");
    assert.ok(fin.eventId);
    assert.ok(
      fin.status === "Effective" || fin.status === "Scheduled",
      `status ${fin.status}`,
    );
    assert.equal(fin.draft.status, "finalized");
    assert.equal(fin.draft.finalizedEventId, fin.eventId);
    assert.equal(hookCalls, 1, "AD-6 projection hook must run once");
    assert.equal(fin.projectionHookInvoked, true);

    const row = await pool.query(
      `SELECT status, finalized_at, finalized_by, event_type
       FROM kernel_events WHERE id = $1::uuid`,
      [fin.eventId],
    );
    assert.equal(row.rows.length, 1);
    assert.ok(row.rows[0].finalized_at);
    assert.equal(row.rows[0].finalized_by, actor);
    assert.equal(row.rows[0].event_type, "ScaffoldChangeRecorded");
    assert.ok(
      row.rows[0].status === "Effective" || row.rows[0].status === "Scheduled",
    );

    // Exact cardinality: one event
    assert.equal(await countBusinessEvents(pool, demo.id, draft2.id), 1);

    // --- Idempotent retry → same event id ---
    const retry = await finalizeDraft(
      {
        draftId: draft2.id,
        actorId: actor,
        idempotencyKey: idem,
      },
      pool,
      db,
    );
    assert.equal(retry.outcome, "finalized");
    if (retry.outcome === "finalized") {
      assert.equal(retry.eventId, fin.eventId);
    }
    assert.equal(
      await countBusinessEvents(pool, demo.id, draft2.id),
      1,
      "retry must not create second event",
    );

    // --- No UPDATE on kernel_events ---
    await assert.rejects(async () => {
      await pool.query(
        `UPDATE kernel_events SET status = 'Draft' WHERE id = $1::uuid`,
        [fin.eventId],
      );
    });

    // --- Blocking conflict (headcount-consuming type) ---
    const draftBlock = await createDraft(
      {
        personId: demo.id,
        eventType: "EmploymentStarted",
        effectiveDate: "2025-08-01",
        payload: {},
      },
      { accountId: actor },
      db,
    );
    const blocked = await finalizeDraft(
      {
        draftId: draftBlock.id,
        actorId: actor,
        expectedVersion: draftBlock.version,
      },
      pool,
      db,
    );
    assert.equal(blocked.outcome, "rejected");
    if (blocked.outcome === "rejected") {
      assert.equal(blocked.code, "FINALIZE_BLOCKED");
      assert.ok(
        blocked.conflicts.some((c) => c.severity === "blocking"),
        "blocking conflict required",
      );
    }
    const stillOpen = await getDraft(draftBlock.id, db);
    assert.equal(stillOpen.status, "open");
    assert.equal(await countBusinessEvents(pool, demo.id, draftBlock.id), 0);

    // --- Warning requires ack ---
    const draftWarn = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: "2010-01-01",
        payload: {},
      },
      { accountId: actor },
      db,
    );
    const warnReject = await finalizeDraft(
      {
        draftId: draftWarn.id,
        actorId: actor,
        expectedVersion: draftWarn.version,
        conflictPolicy: {
          baselineBoundaryDate: "2020-01-01",
          allowPreBaselineOverride: true,
        },
        actorMayOverride: true,
        // missing acknowledgement
      },
      pool,
      db,
    );
    assert.equal(warnReject.outcome, "rejected");
    if (warnReject.outcome === "rejected") {
      assert.ok(
        warnReject.code === "FINALIZE_WARNING_ACK_REQUIRED" ||
          warnReject.code === "FINALIZE_OVERRIDE_REQUIRED",
      );
    }

    const warnOk = await finalizeDraft(
      {
        draftId: draftWarn.id,
        actorId: actor,
        expectedVersion: draftWarn.version,
        conflictPolicy: {
          baselineBoundaryDate: "2020-01-01",
          allowPreBaselineOverride: true,
        },
        actorMayOverride: true,
        acknowledgement: {
          warningCodes: ["PRE_BASELINE_EFFECTIVE_DATE"],
        },
        override: {
          reason: "selfcheck override for pre-baseline scaffold",
          approvedByAccountId: actor,
        },
      },
      pool,
      db,
    );
    assert.equal(warnOk.outcome, "finalized");

    // --- Risk tier → pending_review (non-authoritative) ---
    // Conflicts must pass first; then omit riskTier config → pending_review (no append).
    const demoEmp = await db.employment.findFirst({
      where: { personId: demo.id, endDateExclusive: null },
      orderBy: { startDate: "asc" },
    });
    assert.ok(demoEmp, "demo person needs an open Employment for Termination risk-tier check");
    const draftRisk = await createDraft(
      {
        personId: demo.id,
        employmentId: demoEmp.id,
        eventType: "EmploymentTerminated",
        effectiveDate: todayDateOnlyTehran(),
        payload: {
          riskTier: "termination",
          terminationReason: "contract_ended",
        },
      },
      { accountId: actor },
      db,
    );
    const pending = await finalizeDraft(
      {
        draftId: draftRisk.id,
        actorId: actor,
        expectedVersion: draftRisk.version,
        // no risk tier config → pending_review
      },
      pool,
      db,
    );
    assert.equal(pending.outcome, "pending_review");
    if (pending.outcome === "pending_review") {
      assert.equal(pending.draft.status, "pending_review");
    }
    assert.equal(await countBusinessEvents(pool, demo.id, draftRisk.id), 0);

    // --- Delete vs finalize race: finalize wins under lock ---
    const raceDraft = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: "2025-10-01",
        payload: {},
      },
      { accountId: actor },
      db,
    );
    const raceFin = await finalizeDraft(
      {
        draftId: raceDraft.id,
        actorId: actor,
        expectedVersion: raceDraft.version,
        idempotencyKey: `race-${raceDraft.id}`,
      },
      pool,
      db,
    );
    assert.equal(raceFin.outcome, "finalized");
    await assert.rejects(
      () =>
        deleteDraft(raceDraft.id, raceDraft.version, { accountId: actor }, db),
      (err: unknown) =>
        err instanceof PersonnelEventError &&
        (err.code === "DRAFT_ALREADY_FINALIZED" ||
          err.code === "DRAFT_NOT_EDITABLE" ||
          err.code === "DRAFT_VERSION_CONFLICT"),
    );
    const afterRace = await getDraft(raceDraft.id, db);
    assert.equal(afterRace.status, "finalized");
    assert.ok(afterRace.finalizedEventId);

    // --- AD-6: hook + append same txn (rollback rolls both) ---
    const rollbackDraft = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: "2025-11-01",
        payload: {},
      },
      { accountId: actor },
      db,
    );
    setProjectionRefreshHook(async () => {
      throw new Error("force_rollback_after_hook_setup");
    });
    // Force failure inside finalize after we'd normally append: use a hook that throws
    // Re-implement via finalize path — hook throws → txn rolls back
    await assert.rejects(() =>
      finalizeDraft(
        {
          draftId: rollbackDraft.id,
          actorId: actor,
          expectedVersion: rollbackDraft.version,
        },
        pool,
        db,
      ),
    );
    const afterRollback = await getDraft(rollbackDraft.id, db);
    assert.equal(
      afterRollback.status,
      "open",
      "failed finalize must leave draft open",
    );
    assert.equal(
      await countBusinessEvents(pool, demo.id, rollbackDraft.id),
      0,
      "rolled-back finalize must not leave kernel event",
    );

    // Prove withTransaction seam still works for access path companion
    await withTransaction(pool, async (client) => {
      const r = await client.query("SELECT 1 AS n");
      assert.equal(r.rows[0].n, 1);
    });

    console.log("personnel-event-draft selfcheck: OK");
  } finally {
    resetProjectionRefreshHook();
    await pool.end();
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
