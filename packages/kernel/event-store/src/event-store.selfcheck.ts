/**
 * Self-check for append-only access + business events (Story 4.1).
 * Run: pnpm --filter @divan/event-store selfcheck
 * Requires DATABASE_URL and applied sql/001…003 (via sql/apply.mjs).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import pg from "pg";

import {
  appendAccessEvent,
  appendBusinessEvent,
  BusinessEventValidationError,
  withTransaction,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

/** Prefer SQL `::text` for DATE columns — JS Date can shift calendar day via TZ. */
function dateOnlyFromDb(value: unknown): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  throw new Error(`unexpected date value: ${String(value)}`);
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const pool = new pg.Pool({ connectionString: url });
  try {
    // --- Access path still green ---
    const accessCorrelationId = randomUUID();
    const { id: accessId } = await withTransaction(pool, async (client) => {
      return appendAccessEvent(client, {
        correlationId: accessCorrelationId,
        actorAccountId: null,
        operation: "selfcheck.event_store",
        scope: { fixture: true },
        result: "deny",
        reason: "selfcheck",
      });
    });

    assert.ok(accessId);
    const accessRows = await pool.query(
      `SELECT event_class, result, operation, event_type, person_id, effective_date, status, registered_at
       FROM kernel_events WHERE id = $1::uuid`,
      [accessId],
    );
    assert.equal(accessRows.rows[0]?.event_class, "access");
    assert.equal(accessRows.rows[0]?.result, "deny");
    assert.equal(accessRows.rows[0]?.operation, "selfcheck.event_store");
    assert.equal(accessRows.rows[0]?.event_type, null);
    assert.equal(accessRows.rows[0]?.person_id, null);
    assert.equal(accessRows.rows[0]?.effective_date, null);
    assert.equal(accessRows.rows[0]?.status, null);
    assert.equal(accessRows.rows[0]?.registered_at, null);

    // --- Reject invalid event types ---
    await assert.rejects(
      () =>
        appendBusinessEvent(pool, {
          correlationId: randomUUID(),
          eventType: "transfer_recorded",
          personId: randomUUID(),
          effectiveDate: "2026-07-01",
          registeredBy: "clselfcheck000000000000001",
        }),
      (err: unknown) =>
        err instanceof BusinessEventValidationError &&
        err.code === "invalid_event_type",
    );
    await assert.rejects(
      () =>
        appendBusinessEvent(pool, {
          correlationId: randomUUID(),
          eventType: "foo",
          personId: randomUUID(),
          effectiveDate: "2026-07-01",
          registeredBy: "clselfcheck000000000000001",
        }),
      (err: unknown) =>
        err instanceof BusinessEventValidationError &&
        err.code === "invalid_event_type",
    );

    // --- Reject sensitive evidence (fail-closed) ---
    await assert.rejects(
      () =>
        appendBusinessEvent(pool, {
          correlationId: randomUUID(),
          eventType: "TransferRecorded",
          personId: randomUUID(),
          effectiveDate: "2026-07-01",
          registeredBy: "clselfcheck000000000000001",
          afterEvidence: { amount: 1_000_000 },
        }),
      (err: unknown) =>
        err instanceof BusinessEventValidationError &&
        err.code === "sensitive_evidence_forbidden",
    );
    await assert.rejects(
      () =>
        appendBusinessEvent(pool, {
          correlationId: randomUUID(),
          eventType: "TransferRecorded",
          personId: randomUUID(),
          effectiveDate: "2026-07-01",
          registeredBy: "clselfcheck000000000000001",
          afterEvidence: { Amount: 1_000_000 },
        }),
      (err: unknown) =>
        err instanceof BusinessEventValidationError &&
        err.code === "sensitive_evidence_forbidden",
    );
    await assert.rejects(
      () =>
        appendBusinessEvent(pool, {
          correlationId: randomUUID(),
          eventType: "TransferRecorded",
          personId: randomUUID(),
          effectiveDate: "2026-07-01",
          registeredBy: "clselfcheck000000000000001",
          scope: { national_id: "x" },
        }),
      (err: unknown) =>
        err instanceof BusinessEventValidationError &&
        err.code === "sensitive_evidence_forbidden",
    );
    await assert.rejects(
      () =>
        appendBusinessEvent(pool, {
          correlationId: randomUUID(),
          eventType: "TransferRecorded",
          personId: randomUUID(),
          effectiveDate: "2026-07-01",
          registeredBy: "clselfcheck000000000000001",
          finalizedAt: new Date("2026-07-18T09:00:00.000Z"),
        }),
      (err: unknown) =>
        err instanceof BusinessEventValidationError &&
        err.code === "invalid_finalized_pair",
    );

    // --- Business append with full attributable fields ---
    const personId = randomUUID();
    const registeredAt = new Date("2026-07-18T08:30:00.000Z");
    const finalizedAt = new Date("2026-07-18T09:00:00.000Z");
    const effectiveDate = "2026-07-01";
    const correlationId = randomUUID();

    const { id: businessId } = await withTransaction(pool, async (client) => {
      return appendBusinessEvent(client, {
        correlationId,
        eventType: "TransferRecorded",
        personId,
        employmentId: null, // Draft/Start may omit Employment binding
        effectiveDate,
        registeredBy: "clselfcheck000000000000001",
        registeredAt,
        status: "Draft",
        reason: "selfcheck transferable scaffold",
        referenceCode: "SC-4.1",
        provenance: { source: "selfcheck", importBatch: null },
        beforeEvidence: { teamId: "team-src" },
        afterEvidence: { teamId: "team-dst" },
        finalizedBy: "clselfcheck000000000000002",
        finalizedAt,
      });
    });

    assert.ok(businessId);
    const biz = await pool.query(
      `SELECT
         event_class, result, operation, event_type, person_id, employment_id,
         effective_date::text AS effective_date,
         registered_at, registered_by, finalized_at, finalized_by,
         status, reference_code, provenance, before_evidence, after_evidence,
         actor_account_id, occurred_at,
         pg_typeof(effective_date)::text AS effective_date_type,
         pg_typeof(registered_at)::text AS registered_at_type,
         pg_typeof(finalized_at)::text AS finalized_at_type
       FROM kernel_events WHERE id = $1::uuid`,
      [businessId],
    );
    const row = biz.rows[0];
    assert.ok(row);
    assert.equal(row.event_class, "business");
    assert.equal(row.result, null);
    assert.equal(row.event_type, "TransferRecorded");
    assert.equal(row.operation, "TransferRecorded");
    assert.equal(row.person_id, personId);
    assert.equal(row.employment_id, null);
    assert.equal(dateOnlyFromDb(row.effective_date), effectiveDate);
    assert.equal(row.status, "Draft");
    assert.equal(row.registered_by, "clselfcheck000000000000001");
    assert.equal(row.actor_account_id, "clselfcheck000000000000001");
    assert.equal(row.reference_code, "SC-4.1");
    assert.equal(row.provenance?.source, "selfcheck");
    assert.equal(row.before_evidence?.teamId, "team-src");
    assert.equal(row.after_evidence?.teamId, "team-dst");

    // Column roles: DATE vs timestamptz (Effective Date ≠ registration/finalization clocks)
    assert.equal(row.effective_date_type, "date");
    assert.match(String(row.registered_at_type), /timestamp with time zone/);
    assert.match(String(row.finalized_at_type), /timestamp with time zone/);
    assert.notEqual(
      dateOnlyFromDb(row.effective_date),
      new Date(row.registered_at).toISOString().slice(0, 10),
    );
    assert.ok(row.registered_at instanceof Date || typeof row.registered_at === "string");
    assert.ok(row.finalized_at instanceof Date || typeof row.finalized_at === "string");
    assert.notEqual(String(row.registered_at), String(row.effective_date));
    assert.notEqual(String(row.finalized_at), String(row.effective_date));

    // --- No UPDATE API; raw UPDATE blocked by append-only trigger ---
    await assert.rejects(
      () =>
        pool.query(
          `UPDATE kernel_events SET reason = 'tamper' WHERE id = $1::uuid`,
          [businessId],
        ),
      (err: unknown) =>
        err instanceof Error && /append-only/i.test(err.message),
    );

    // Confirm module surface has no update/delete business helpers
    const mod = await import("./index");
    assert.equal(
      "updateBusinessEvent" in mod,
      false,
      "no updateBusinessEvent API",
    );
    assert.equal(
      "deleteBusinessEvent" in mod,
      false,
      "no deleteBusinessEvent API",
    );

    console.log("event-store.selfcheck: ok");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
