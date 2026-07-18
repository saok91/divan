/**
 * Pure FR-18 ordering selfcheck (no DB).
 * Run: pnpm --filter @divan/temporal-engine selfcheck:ordering
 */
import assert from "node:assert/strict";

import {
  APPLY_ORDER_SQL_ORDER_BY,
  compareBusinessEventsForApply,
  orderBusinessEventsForApply,
} from "./order-business-events";

function main() {
  const t0 = new Date("2026-01-15T08:00:00.000Z");
  const t1 = new Date("2026-01-15T09:00:00.000Z");
  const tSame = new Date("2026-01-15T10:00:00.000Z");

  const a = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    effectiveDate: "2026-03-01",
    registeredAt: t1,
    finalizedAt: t1,
  };
  const b = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    effectiveDate: "2026-02-01",
    registeredAt: t0,
    finalizedAt: null,
  };
  const c = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    effectiveDate: "2026-03-01",
    registeredAt: t0,
    finalizedAt: t0,
  };
  // Same effectiveDate + same coalesce time → UUID ASC tie-break
  const d = {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    effectiveDate: "2026-03-01",
    registeredAt: tSame,
    finalizedAt: tSame,
  };
  const e = {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    effectiveDate: "2026-03-01",
    registeredAt: tSame,
    finalizedAt: null, // coalesce → registeredAt = tSame
  };

  const ordered = orderBusinessEventsForApply([a, b, c, e, d]);
  assert.deepEqual(
    ordered.map((x) => x.id),
    [b.id, c.id, a.id, d.id, e.id],
    "apply order: date ASC, time ASC, id ASC",
  );

  // Stability: reshuffle repeatedly
  for (let i = 0; i < 5; i++) {
    const shuffled = [e, d, a, c, b].sort(() => Math.random() - 0.5);
    const again = orderBusinessEventsForApply(shuffled);
    assert.deepEqual(
      again.map((x) => x.id),
      [b.id, c.id, a.id, d.id, e.id],
    );
  }

  // finalizedAt preferred over registeredAt when present
  const earlyRegLateFin = {
    id: "11111111-1111-4111-8111-111111111111",
    effectiveDate: "2026-04-01",
    registeredAt: t0,
    finalizedAt: t1,
  };
  const lateRegEarlyFin = {
    id: "22222222-2222-4222-8222-222222222222",
    effectiveDate: "2026-04-01",
    registeredAt: t1,
    finalizedAt: t0,
  };
  assert.ok(
    compareBusinessEventsForApply(lateRegEarlyFin, earlyRegLateFin) < 0,
    "coalesce uses finalizedAt when set",
  );

  assert.ok(
    APPLY_ORDER_SQL_ORDER_BY.includes("effective_date ASC") &&
      APPLY_ORDER_SQL_ORDER_BY.includes("COALESCE(finalized_at, registered_at)") &&
      APPLY_ORDER_SQL_ORDER_BY.includes("id ASC"),
  );

  // Exclusive interval helpers remain the calendar contract (imported elsewhere)
  assert.equal(compareBusinessEventsForApply(a, a), 0);

  // Invalid / NaN timestamps collapse to epoch 0 (deterministic vs SQL twin)
  const badDate = {
    id: "33333333-3333-4333-8333-333333333333",
    effectiveDate: "2026-05-01",
    registeredAt: new Date("not-a-date"),
    finalizedAt: null,
  };
  const goodEarly = {
    id: "44444444-4444-4444-8444-444444444444",
    effectiveDate: "2026-05-01",
    registeredAt: new Date("2026-01-01T00:00:00.000Z"),
    finalizedAt: null,
  };
  assert.ok(
    compareBusinessEventsForApply(badDate, goodEarly) < 0,
    "Invalid Date sorts as epoch 0 before valid timestamps",
  );

  console.log("temporal-engine ordering selfcheck: OK");
}

main();
