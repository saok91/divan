/**
 * Self-check for read-only audit evidence query (Story 7.1).
 * Run: pnpm --filter @divan/event-store selfcheck:audit-query
 * Requires DATABASE_URL and applied sql/001….
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import pg from "pg";

import {
  appendAccessEvent,
  escapeLikePattern,
  listAccessEvents,
  queryAuditEvidence,
  withTransaction,
} from "./index";

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
    const correlationId = randomUUID();
    const actorId = "clauditquery00000000000001";
    const marker = `selfcheck.audit_query.${randomUUID().slice(0, 8)}`;

    const { id: seededId } = await withTransaction(pool, async (client) => {
      return appendAccessEvent(client, {
        correlationId,
        actorAccountId: actorId,
        operation: marker,
        scope: { fixture: true, channel: "audit" },
        result: "allow",
        reason: "selfcheck_seed",
        entityType: "audit_selfcheck",
        entityId: "seed-1",
      });
    });

    const byOp = await queryAuditEvidence(pool, {
      operation: marker,
      eventClass: "access",
      limit: 10,
    });
    assert.ok(byOp.some((r) => r.id === seededId), "exact operation filter");
    const hit = byOp.find((r) => r.id === seededId)!;
    assert.equal(hit.actorAccountId, actorId);
    assert.equal(hit.correlationId, correlationId);
    assert.equal(hit.result, "allow");
    assert.equal(hit.entityType, "audit_selfcheck");
    assert.ok(hit.scope.fixture === true);

    const byPrefix = await listAccessEvents(pool, {
      operationPrefix: "selfcheck.audit_query.",
      actorAccountId: actorId,
      limit: 50,
    });
    assert.ok(byPrefix.some((r) => r.id === seededId), "prefix + actor filter");

    const byCorrelation = await queryAuditEvidence(pool, {
      correlationId,
      limit: 20,
    });
    assert.ok(
      byCorrelation.some((r) => r.id === seededId),
      "correlation filter",
    );

    const byScope = await queryAuditEvidence(pool, {
      operation: marker,
      scopeContains: { channel: "audit" },
      limit: 10,
    });
    assert.ok(byScope.some((r) => r.id === seededId), "scope @> containment");

    const empty = await queryAuditEvidence(pool, {
      operation: `missing.${randomUUID()}`,
      limit: 10,
    });
    assert.equal(empty.length, 0, "empty filter returns []");

    assert.equal(escapeLikePattern("a%b_c\\d"), "a\\%b\\_c\\\\d");

    // No UPDATE/DELETE helpers exported — surface check via package index shape.
    const api = await import("./index");
    assert.equal(
      typeof (api as { updateAccessEvent?: unknown }).updateAccessEvent,
      "undefined",
    );
    assert.equal(
      typeof (api as { deleteAccessEvent?: unknown }).deleteAccessEvent,
      "undefined",
    );

    console.log("access-event-query selfcheck: ok");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
