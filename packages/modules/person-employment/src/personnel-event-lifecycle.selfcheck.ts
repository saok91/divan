/**
 * Personnel Event lifecycle selfcheck (Story 4.3 / FR-16 / FR-17 / AD-6).
 * Run: pnpm --filter @divan/person-employment selfcheck:personnel-event-lifecycle
 * Requires DATABASE_URL, migrated kernel_events + Draft, seeded accounts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { createPgPool } from "@divan/db";
import {
  getBusinessEventById,
} from "@divan/event-store";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  PersonnelEventError,
  cancelPersonnelEvent,
  correctPersonnelEvent,
  createDraft,
  evaluationStatusAsOf,
  finalizeDraft,
  getPersonDb,
  loadEventWithResolvedStatus,
  resetProjectionRefreshHook,
  resolveLifecycleStatus,
  reversePersonnelEvent,
  seedPersonIdentityFixtures,
  seedPersonnelEventPermissionFixtures,
  setProjectionRefreshHook,
  SEED_PERSON_IDENTITY,
} from "./index";
import { listChainLinksForEvent } from "@divan/event-store";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

function futureDate(daysAhead: number): string {
  const today = todayDateOnlyTehran();
  const parts = today.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const dt = new Date(Date.UTC(y, m - 1, d + daysAhead));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function pastDate(daysBack: number): string {
  return futureDate(-daysBack);
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const db = getPersonDb();
  const pool = createPgPool(url);
  await seedPersonIdentityFixtures(db);
  await seedPersonnelEventPermissionFixtures(db);

  const demo = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  assert.ok(demo, "demo person required");

  const admin =
    (await db.internalAccount.findUnique({ where: { username: "hr.admin" } }))
      ?.id ?? null;
  assert.ok(admin, "hr.admin account required for lifecycle permissions");

  let hookCalls = 0;
  let lastApply: boolean | undefined;
  setProjectionRefreshHook(async (ctx) => {
    hookCalls += 1;
    lastApply = ctx.applyToCurrentProjection;
    ctx.invoked = { eventId: ctx.eventId, eventType: ctx.eventType };
  });

  try {
    // --- Finalize future → Scheduled; hook must NOT apply current projection ---
    hookCalls = 0;
    const futureDraft = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: futureDate(30),
        payload: { note: "future-scheduled" },
      },
      { accountId: admin },
      db,
    );
    const futureFin = await finalizeDraft(
      {
        draftId: futureDraft.id,
        actorId: admin,
        idempotencyKey: `sc-future-${futureDraft.id}`,
      },
      pool,
      db,
    );
    assert.equal(futureFin.outcome, "finalized");
    if (futureFin.outcome !== "finalized") throw new Error("unreachable");
    assert.equal(futureFin.status, "Scheduled");
    assert.equal(hookCalls, 1);
    assert.equal(lastApply, false, "Scheduled must not apply current projection");

    const futureEvt = await getBusinessEventById(pool, futureFin.eventId);
    assert.ok(futureEvt);
    assert.equal(futureEvt!.status, "Scheduled");

    // --- Cancel Scheduled ---
    hookCalls = 0;
    const cancel1 = await cancelPersonnelEvent(
      futureFin.eventId,
      { actorId: admin, reason: "لغو تست selfcheck" },
      pool,
      db,
    );
    assert.equal(cancel1.resolvedStatus, "Cancelled");
    assert.equal(cancel1.idempotentReplay, false);
    assert.equal(hookCalls, 1);
    assert.equal(lastApply, false);

    const afterCancel = await loadEventWithResolvedStatus(
      pool,
      futureFin.eventId,
    );
    assert.ok(afterCancel);
    assert.equal(afterCancel!.resolvedStatus, "Cancelled");
    // Original row untouched
    const origAfterCancel = await getBusinessEventById(pool, futureFin.eventId);
    assert.equal(origAfterCancel!.status, "Scheduled");

    // Idempotent Cancel
    const cancel2 = await cancelPersonnelEvent(
      futureFin.eventId,
      { actorId: admin, reason: "دوباره" },
      pool,
      db,
    );
    assert.equal(cancel2.idempotentReplay, true);
    assert.equal(cancel2.neutralizingEventId, cancel1.neutralizingEventId);

    const links = await listChainLinksForEvent(pool, futureFin.eventId);
    assert.equal(links.cancellations.length, 1, "exact cardinality 1 Cancel");

    // Cancel without reason
    await assert.rejects(
      () =>
        cancelPersonnelEvent(
          futureFin.eventId,
          { actorId: admin, reason: "   " },
          pool,
          db,
        ),
      (err: unknown) =>
        err instanceof PersonnelEventError && err.code === "REASON_REQUIRED",
    );

    // --- Finalize past → Effective; Reverse ---
    hookCalls = 0;
    const pastDraft = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: pastDate(5),
        payload: { note: "past-effective" },
      },
      { accountId: admin },
      db,
    );
    const pastFin = await finalizeDraft(
      {
        draftId: pastDraft.id,
        actorId: admin,
        idempotencyKey: `sc-past-${pastDraft.id}`,
      },
      pool,
      db,
    );
    assert.equal(pastFin.outcome, "finalized");
    if (pastFin.outcome !== "finalized") throw new Error("unreachable");
    assert.equal(pastFin.status, "Effective");
    assert.equal(lastApply, true);

    // Cancel after effect → reject
    await assert.rejects(
      () =>
        cancelPersonnelEvent(
          pastFin.eventId,
          { actorId: admin, reason: "نباید مجاز باشد" },
          pool,
          db,
        ),
      (err: unknown) =>
        err instanceof PersonnelEventError &&
        (err.code === "CANCEL_AFTER_EFFECT" ||
          err.code === "CANCEL_WRONG_STATE"),
    );

    hookCalls = 0;
    const rev = await reversePersonnelEvent(
      pastFin.eventId,
      { actorId: admin, reason: "بازگشت تست" },
      pool,
      db,
    );
    assert.equal(rev.resolvedStatus, "Reversed");
    assert.equal(hookCalls, 1);
    const origAfterRev = await getBusinessEventById(pool, pastFin.eventId);
    assert.equal(origAfterRev!.status, "Effective");

    // --- Correction link + self-ref/cycle ---
    const baseDraft = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: pastDate(2),
        payload: { note: "correction-target" },
      },
      { accountId: admin },
      db,
    );
    const baseFin = await finalizeDraft(
      {
        draftId: baseDraft.id,
        actorId: admin,
        idempotencyKey: `sc-corr-base-${baseDraft.id}`,
      },
      pool,
      db,
    );
    assert.equal(baseFin.outcome, "finalized");
    if (baseFin.outcome !== "finalized") throw new Error("unreachable");

    const corr = await correctPersonnelEvent(
      baseFin.eventId,
      {
        actorId: admin,
        reason: "اصلاح واقعیت",
        idempotencyKey: `sc-corr-${baseFin.eventId}`,
        correctionPayload: { note: "fixed" },
      },
      pool,
      db,
    );
    assert.ok(corr.neutralizingEventId);
    const corrEvt = await getBusinessEventById(pool, corr.neutralizingEventId);
    assert.equal(corrEvt!.correctsEventId, baseFin.eventId);

    // Self-ref reject
    await assert.rejects(
      () =>
        correctPersonnelEvent(
          baseFin.eventId,
          {
            actorId: admin,
            reason: "self",
            prospectiveEventId: baseFin.eventId,
          },
          pool,
          db,
        ),
      (err: unknown) =>
        err instanceof PersonnelEventError && err.code === "CORRECTION_SELF_REF",
    );

    // Broken target
    await assert.rejects(
      () =>
        correctPersonnelEvent(
          randomUUID(),
          { actorId: admin, reason: "missing" },
          pool,
          db,
        ),
      (err: unknown) =>
        err instanceof PersonnelEventError && err.code === "EVENT_NOT_FOUND",
    );

    // --- Cancel ↔ effect exclusive: future Scheduled with asOf after effective ---
    const raceDraft = await createDraft(
      {
        personId: demo.id,
        eventType: "ScaffoldChangeRecorded",
        effectiveDate: futureDate(10),
        payload: { note: "race" },
      },
      { accountId: admin },
      db,
    );
    const raceFin = await finalizeDraft(
      {
        draftId: raceDraft.id,
        actorId: admin,
        idempotencyKey: `sc-race-${raceDraft.id}`,
      },
      pool,
      db,
    );
    assert.equal(raceFin.outcome, "finalized");
    if (raceFin.outcome !== "finalized") throw new Error("unreachable");
    assert.equal(raceFin.status, "Scheduled");

    // Simulate effect won via asOfDate past the effective date
    await assert.rejects(
      () =>
        cancelPersonnelEvent(
          raceFin.eventId,
          {
            actorId: admin,
            reason: "دیر شده",
            asOfDate: futureDate(11),
          },
          pool,
          db,
        ),
      (err: unknown) =>
        err instanceof PersonnelEventError && err.code === "CANCEL_AFTER_EFFECT",
    );

    // Cancel still wins when still pre-effect
    const raceCancel = await cancelPersonnelEvent(
      raceFin.eventId,
      { actorId: admin, reason: "به‌موقع", asOfDate: todayDateOnlyTehran() },
      pool,
      db,
    );
    assert.equal(raceCancel.resolvedStatus, "Cancelled");

    // Append-only: UPDATE original still fails
    await assert.rejects(
      () =>
        pool.query(
          `UPDATE kernel_events SET status = 'Cancelled' WHERE id = $1::uuid`,
          [raceFin.eventId],
        ),
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        return /append.?only|kernel_events/i.test(msg);
      },
    );

    // evaluation helper
    assert.equal(
      evaluationStatusAsOf(
        { status: "Scheduled", effectiveDate: pastDate(1) },
        todayDateOnlyTehran(),
      ),
      "Effective",
    );

    // resolveLifecycleStatus with empty links
    const resolved = resolveLifecycleStatus(
      futureEvt!,
      { cancellations: [], reversals: [], corrections: [] },
      todayDateOnlyTehran(),
    );
    assert.ok(
      resolved === "Scheduled" || resolved === "Effective",
      "display status derived",
    );

    console.log("personnel-event-lifecycle selfcheck: OK");
  } finally {
    resetProjectionRefreshHook();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
