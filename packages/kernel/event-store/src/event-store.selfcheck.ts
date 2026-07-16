/**
 * Self-check for append-only access events (Story 2.1).
 * Run: pnpm --filter @divan/event-store selfcheck
 * Requires DATABASE_URL and applied sql/001_kernel_events.sql.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import pg from "pg";

import { appendAccessEvent, appendBusinessEvent, withTransaction } from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const pool = new pg.Pool({ connectionString: url });
  try {
    await assert.rejects(
      () =>
        appendBusinessEvent(pool, {
          correlationId: randomUUID(),
          operation: "noop",
        }),
      /not implemented/,
    );

    const correlationId = randomUUID();
    const { id } = await withTransaction(pool, async (client) => {
      return appendAccessEvent(client, {
        correlationId,
        actorAccountId: null,
        operation: "selfcheck.event_store",
        scope: { fixture: true },
        result: "deny",
        reason: "selfcheck",
      });
    });

    assert.ok(id);
    const { rows } = await pool.query(
      `SELECT event_class, result, operation FROM kernel_events WHERE id = $1::uuid`,
      [id],
    );
    assert.equal(rows[0]?.event_class, "access");
    assert.equal(rows[0]?.result, "deny");
    assert.equal(rows[0]?.operation, "selfcheck.event_store");

    console.log("event-store.selfcheck: ok");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
