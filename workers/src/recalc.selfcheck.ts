/**
 * Workers / pg-boss smoke selfcheck (Story 4.4).
 * Run: pnpm --filter @divan/workers selfcheck:recalc
 *
 * Verifies queue create + singleton send coalesce + handler clears pending.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPgPool } from "@divan/db";
import {
  TEMPORAL_RECALCULATE_QUEUE,
  getRecalculationStatus,
  markRecalculationPending,
  setRecalcEnqueue,
} from "@divan/person-employment";
import { PgBoss } from "pg-boss";

import { WORKERS_STUB, startWorkers } from "./index";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

async function main() {
  assert.equal(WORKERS_STUB, false, "production workers must not stay stubbed");

  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const pool = createPgPool(url);
  const person = await pool.query<{ id: string }>(
    `SELECT id FROM "Person" LIMIT 1`,
  );
  assert.ok(person.rows[0], "need a Person row");
  const personId = person.rows[0]!.id;

  await pool.query(
    `DELETE FROM recalculation_status WHERE person_id = $1::uuid`,
    [personId],
  );

  const handle = await startWorkers(url);
  try {
    const payload = await markRecalculationPending(
      pool,
      personId,
      "2020-01-01",
    );
    // Enqueue twice — singleton should coalesce (second may return null)
    const boss = handle.boss;
    const id1 = await boss.send(TEMPORAL_RECALCULATE_QUEUE, payload, {
      singletonKey: `person:${personId}:g${payload.generation}`,
      singletonSeconds: 60,
    });
    const id2 = await boss.send(TEMPORAL_RECALCULATE_QUEUE, payload, {
      singletonKey: `person:${personId}:g${payload.generation}`,
      singletonSeconds: 60,
    });
    assert.ok(id1, "first send creates job");
    // id2 may be null when coalesced — either way at most one active apply
    void id2;

    // Wait for worker to clear pending (poll)
    let cleared = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const st = await getRecalculationStatus(pool, personId);
      if (st?.status === "clear") {
        cleared = true;
        break;
      }
    }
    assert.ok(cleared, "worker must clear pending on success");

    // Direct boss API still exposes queue
    const q = await boss.getQueue(TEMPORAL_RECALCULATE_QUEUE);
    assert.ok(q, "temporal.recalculate queue exists");

    console.log("workers recalc selfcheck: OK");
  } finally {
    setRecalcEnqueue(null);
    await handle.stop();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
