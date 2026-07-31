/**
 * Story 4.4 recalculation substrate selfcheck.
 * Run: pnpm --filter @divan/person-employment selfcheck:personnel-event-recalc
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPgPool } from "@divan/db";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import { getPersonDb } from "./db";
import { createDraft } from "./personnel-event-draft";
import { finalizeDraft } from "./personnel-event-finalize";
import {
  classifyConflicts,
  buildEvaluationSnapshot,
} from "./personnel-event-conflicts";
import {
  clearRecalculationStatus,
  getPlatformRecalcSignal,
  getRecalculationStatus,
  loadOrderedEventsForRecalc,
  markRecalculationPending,
  runHistoricalRecalculation,
  setRecalcEnqueueForTest,
  TEMPORAL_RECALCULATE_QUEUE,
} from "./personnel-event-recalc";
import {
  resetProjectionRefreshHook,
  setProjectionRefreshHook,
} from "./personnel-event-projection-hook";
import {
  seedPersonIdentityFixtures,
  SEED_PERSON_IDENTITY,
} from "./seed";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");
  const db = getPersonDb();
  const pool = createPgPool(url);
  await seedPersonIdentityFixtures(db);

  const enqueued: unknown[] = [];
  setRecalcEnqueueForTest(async (payload) => {
    enqueued.push(payload);
  });

  setProjectionRefreshHook(async () => {
    /* scaffold */
  });

  try {
    assert.equal(TEMPORAL_RECALCULATE_QUEUE, "temporal.recalculate");

    const demo = await db.person.findUnique({
      where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
    });
    assert.ok(demo, "demo person required");
    const actor =
      (
        await db.internalAccount.findUnique({
          where: { username: "hr.operator" },
        })
      )?.id ?? "selfcheck-actor";

    await pool.query(
      `DELETE FROM recalculation_status WHERE person_id = $1::uuid`,
      [demo.id],
    );

    const past = "2019-06-01";
    const exclusiveKey = `slot-${randomUUID()}`;
    const draftA = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: past,
        payload: { orderingExclusiveKey: exclusiveKey },
      },
      { accountId: actor },
      db,
    );
    const finA = await finalizeDraft(
      {
        draftId: draftA.id,
        actorId: actor,
        expectedVersion: draftA.version,
        conflictPolicy: {
          baselineBoundaryDate: "2020-01-01",
          allowPreBaselineOverride: true,
        },
        actorMayOverride: true,
        acknowledgement: {
          warningCodes: ["PRE_BASELINE_EFFECTIVE_DATE"],
        },
        override: {
          reason: "selfcheck first exclusive slot",
          approvedByAccountId: actor,
        },
      },
      pool,
      db,
    );
    assert.equal(finA.outcome, "finalized");
    if (finA.outcome === "finalized") {
      assert.ok(finA.recalcScheduled, "past-dated finalize schedules recalc");
      assert.equal(enqueued.length, 1, "exact enqueue cardinality 1");
    }

    const statusAfter = await getRecalculationStatus(pool, demo.id);
    assert.ok(statusAfter);
    assert.equal(statusAfter!.status, "pending");

    const signal = await getPlatformRecalcSignal(pool);
    assert.equal(signal.recalculationPending, true);
    assert.ok(
      signal.affectedPersonCount != null && signal.affectedPersonCount >= 1,
      "affectedPersonCount counts pending persons",
    );

    const draftB = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: past,
        payload: { orderingExclusiveKey: exclusiveKey },
      },
      { accountId: actor },
      db,
    );
    const snap = await buildEvaluationSnapshot(
      {
        draft: draftB,
        actorAccountId: actor,
        correlationId: randomUUID(),
      },
      db,
    );
    const conflicts = await classifyConflicts(
      draftB,
      snap,
      {
        baselineBoundaryDate: "2020-01-01",
        allowPreBaselineOverride: true,
      },
      db,
      {},
    );
    assert.ok(
      conflicts.some((c) => c.code === "IRRECONCILABLE_ORDERING"),
      "same-day exclusive key must block",
    );

    if (finA.outcome === "finalized") {
      const access = await pool.query(
        `SELECT operation, result, reason FROM kernel_events
         WHERE event_class = 'access'
           AND operation = 'personnel_event.pre_baseline_override'
           AND entity_id = $1
         ORDER BY occurred_at DESC LIMIT 1`,
        [draftA.id],
      );
      assert.equal(access.rows.length, 1, "override leaves access evidence");
      assert.equal(access.rows[0].result, "allow");
      assert.ok(access.rows[0].reason);

      const draftRow = await db.personnelEventDraft.findUnique({
        where: { id: draftA.id },
      });
      assert.ok(draftRow?.overrideEvidence, "overrideEvidence on draft");
      assert.ok(draftRow?.warningAcks, "warning ack recorded");
    }

    const draftC = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: "2018-01-01",
        payload: {},
      },
      { accountId: actor },
      db,
    );
    const snapC = await buildEvaluationSnapshot(
      {
        draft: draftC,
        actorAccountId: actor,
        correlationId: randomUUID(),
      },
      db,
    );
    const conflictsC = await classifyConflicts(draftC, snapC, {}, db);
    assert.ok(
      !conflictsC.some((c) => c.code === "PRE_BASELINE_EFFECTIVE_DATE"),
      "unset baseline gate inactive",
    );

    const payload = finA.outcome === "finalized" ? finA.recalcScheduled! : null;
    assert.ok(payload);
    const run1 = await runHistoricalRecalculation(pool, payload!);
    assert.equal(run1.skipped, false);
    assert.ok(run1.applied >= 1);
    const afterClear = await getRecalculationStatus(pool, demo.id);
    assert.equal(afterClear?.status, "clear");

    const run2 = await runHistoricalRecalculation(pool, payload!);
    assert.equal(run2.skipped, true, "same generation must not double-apply");

    const ordered = await loadOrderedEventsForRecalc(pool, demo.id, past);
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]!;
      const cur = ordered[i]!;
      assert.ok(
        prev.effectiveDate < cur.effectiveDate ||
          prev.effectiveDate === cur.effectiveDate,
      );
    }

    const gen1 = await markRecalculationPending(pool, demo.id, "2020-01-01");
    const gen2 = await markRecalculationPending(pool, demo.id, "2019-01-01");
    assert.ok(gen2.generation > gen1.generation);
    assert.equal(gen2.fromEffectiveDate, "2019-01-01");
    await clearRecalculationStatus(pool, demo.id);

    assert.ok(todayDateOnlyTehran().length === 10);

    console.log("personnel-event-recalc selfcheck: OK");
  } finally {
    setRecalcEnqueueForTest(null);
    resetProjectionRefreshHook();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
