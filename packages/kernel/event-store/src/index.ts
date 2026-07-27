import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  appendBusinessEvent,
  getBusinessEventById,
  lockBusinessEventForUpdate,
  listChainLinksForEvent,
  listChainLinksForEvents,
  listBusinessEventsForPerson,
  listBusinessEventsForPersonForApply,
  type AppendBusinessEventInput,
  type AppendBusinessEventResult,
  type BusinessEventRecord,
  type BusinessEventStatus,
  BusinessEventValidationError,
  assertNoSensitiveEvidence,
  assertValidBusinessEventType,
} from "./business-event";
import {
  escapeLikePattern,
  getAuditEvidenceById,
  listAccessEvents,
  queryAuditEvidence,
  type AuditEvidenceRecord,
  type QueryAuditEvidenceFilters,
} from "./access-event-query";

export {
  appendBusinessEvent,
  getBusinessEventById,
  lockBusinessEventForUpdate,
  listChainLinksForEvent,
  listChainLinksForEvents,
  listBusinessEventsForPerson,
  listBusinessEventsForPersonForApply,
  BusinessEventValidationError,
  assertNoSensitiveEvidence,
  assertValidBusinessEventType,
  escapeLikePattern,
  getAuditEvidenceById,
  listAccessEvents,
  queryAuditEvidence,
};
export type {
  AppendBusinessEventInput,
  AppendBusinessEventResult,
  BusinessEventRecord,
  BusinessEventStatus,
  AuditEvidenceRecord,
  QueryAuditEvidenceFilters,
};

/** Queryable surface shared by Pool and PoolClient. */
export type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type EventClass = "business" | "access";
export type AccessResult = "allow" | "deny";

export type AccessEventScope = Record<string, unknown>;

export type AppendAccessEventInput = {
  correlationId: string;
  actorAccountId: string | null;
  operation: string;
  scope: AccessEventScope;
  result: AccessResult;
  reason?: string;
  entityType?: string;
  entityId?: string;
  occurredAt?: Date;
  /** Optional non-sensitive metadata only — never HR field values. */
  payload?: Record<string, unknown>;
};

export type AppendAccessEventResult = {
  id: string;
};

/**
 * Append an `event_class=access` row. Append-only — no update/delete helpers.
 * Access events must never feed projections / derived state (AD-3).
 */
export async function appendAccessEvent(
  db: PgQueryable,
  input: AppendAccessEventInput,
): Promise<AppendAccessEventResult> {
  const id = randomUUID();
  const occurredAt = input.occurredAt ?? new Date();
  const payload = input.payload ?? {};

  await db.query(
    `INSERT INTO kernel_events (
       id, event_class, correlation_id, actor_account_id, occurred_at,
       operation, scope, result, reason, entity_type, entity_id, payload
     ) VALUES (
       $1::uuid, 'access', $2::uuid, $3, $4,
       $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb
     )`,
    [
      id,
      input.correlationId,
      input.actorAccountId,
      occurredAt.toISOString(),
      input.operation,
      JSON.stringify(input.scope),
      input.result,
      input.reason ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      JSON.stringify(payload),
    ],
  );

  return { id };
}

/**
 * Run `fn` inside a single transaction on the given pool.
 * Used by audit-envelope so decision + access append are atomic.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw err;
  } finally {
    client.release();
  }
}
