/**
 * Heavy historical recalculation substrate (Story 4.4 / AD-6 / NFR3).
 * Durable pending/failed/stale signal + enqueue seam for pg-boss `temporal.recalculate`.
 * Does not mutate kernel_events; rebuilds via ordered apply + projection hook.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import {
  listBusinessEventsForPersonForApply,
  listChainLinksForEvents,
  type BusinessEventRecord,
} from "@divan/event-store";
import {
  orderBusinessEventsForApply,
  todayDateOnlyTehran,
} from "@divan/temporal-engine";
import type { Pool, PoolClient } from "@divan/db";

import {
  runProjectionRefreshHook,
  type ProjectionRefreshContext,
} from "./personnel-event-projection-hook";
import { evaluationStatusAsOf } from "./personnel-event-resolve";

/** Domain-prefixed queue name (architecture Consistency Conventions). */
export const TEMPORAL_RECALCULATE_QUEUE = "temporal.recalculate" as const;

export type RecalculationRowStatus =
  | "pending"
  | "failed"
  | "stale"
  | "clear";

export type RecalculationStatusRow = {
  personId: string;
  fromEffectiveDate: string;
  status: RecalculationRowStatus;
  generation: number;
  jobKey: string;
  lastError: string | null;
  updatedAt: Date;
  createdAt: Date;
};

export type RecalcJobPayload = {
  personId: string;
  fromEffectiveDate: string;
  generation: number;
  jobKey: string;
};

export type PlatformRecalcSignal = {
  /** Any person with pending recalc — drives UX-DR5 banner + gold CTA block. */
  recalculationPending: boolean;
  /** failed or stale — never serve as current (blocking). */
  blockingStale: boolean;
  /**
   * Ops/debug sample from MAX(updated_at) — never render as a UI deadline.
   * Kept for diagnostics only (Story 8.9).
   */
  stalePendingUntil: string;
  /**
   * Distinct persons in recalculation_status with status in
   * (pending, failed, stale) — banner copy N (Story 8.9).
   * `null` = unknown (fail-closed / query error) — never invent a count.
   */
  affectedPersonCount: number | null;
};

/** Queryable surface shared by Pool and PoolClient. */
export type RecalcQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type RecalcEnqueueFn = (payload: RecalcJobPayload) => Promise<void>;

const enqueueAls = new AsyncLocalStorage<RecalcEnqueueFn>();
let testEnqueueFallback: RecalcEnqueueFn | null = null;
/** Production enqueue (set by workers / app bootstrap). */
let productionEnqueue: RecalcEnqueueFn | null = null;

export function setRecalcEnqueue(fn: RecalcEnqueueFn | null): void {
  productionEnqueue = fn;
}

export function setRecalcEnqueueForTest(fn: RecalcEnqueueFn | null): void {
  testEnqueueFallback = fn;
}

export function runWithRecalcEnqueue<T>(
  fn: RecalcEnqueueFn,
  work: () => Promise<T>,
): Promise<T> {
  return enqueueAls.run(fn, work);
}

function resolveEnqueue(): RecalcEnqueueFn | null {
  return enqueueAls.getStore() ?? testEnqueueFallback ?? productionEnqueue;
}

function dateOnlyFromDb(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mapStatusRow(row: {
  person_id: string;
  from_effective_date: Date | string;
  status: string;
  generation: string | number | bigint;
  job_key: string;
  last_error: string | null;
  updated_at: Date;
  created_at: Date;
}): RecalculationStatusRow {
  const fromEffectiveDate =
    typeof row.from_effective_date === "string"
      ? row.from_effective_date.slice(0, 10)
      : dateOnlyFromDb(row.from_effective_date);
  return {
    personId: row.person_id,
    fromEffectiveDate,
    status: row.status as RecalculationRowStatus,
    generation: Number(row.generation),
    jobKey: row.job_key,
    lastError: row.last_error,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

/**
 * True when Effective Date is strictly before Tehran as-of (past-dated → heavy path).
 */
export function isPastDatedEffective(
  effectiveDate: string,
  asOfDate: string = todayDateOnlyTehran(),
): boolean {
  return effectiveDate < asOfDate;
}

export function recalcJobKey(personId: string, generation: number): string {
  return `recalc:${personId}:g${generation}`;
}

/**
 * Mark durable pending inside the same txn as append (exactly-once guard for UI).
 * Earliest affected date wins when an older pending already exists.
 */
export async function markRecalculationPending(
  db: RecalcQueryable,
  personId: string,
  fromEffectiveDate: string,
): Promise<RecalcJobPayload> {
  const result = await db.query<{
    person_id: string;
    from_effective_date: string;
    status: string;
    generation: string | number | bigint;
    job_key: string;
    last_error: string | null;
    updated_at: Date;
    created_at: Date;
  }>(
    `INSERT INTO recalculation_status (
       person_id, from_effective_date, status, generation, job_key, last_error, updated_at
     ) VALUES (
       $1::uuid, $2::date, 'pending', 1, $3, NULL, now()
     )
     ON CONFLICT (person_id) DO UPDATE SET
       from_effective_date = LEAST(
         recalculation_status.from_effective_date,
         EXCLUDED.from_effective_date
       ),
       status = 'pending',
       generation = recalculation_status.generation + 1,
       job_key = 'recalc:' || $1::text || ':g' || (recalculation_status.generation + 1)::text,
       last_error = NULL,
       updated_at = now()
     RETURNING
       person_id,
       to_char(from_effective_date, 'YYYY-MM-DD') AS from_effective_date,
       status,
       generation,
       job_key,
       last_error,
       updated_at,
       created_at`,
    [personId, fromEffectiveDate, recalcJobKey(personId, 1)],
  );
  const row = mapStatusRow(result.rows[0]!);
  return {
    personId: row.personId,
    fromEffectiveDate: row.fromEffectiveDate,
    generation: row.generation,
    jobKey: row.jobKey,
  };
}

export async function clearRecalculationStatus(
  db: RecalcQueryable,
  personId: string,
  generation?: number,
): Promise<void> {
  if (generation != null) {
    await db.query(
      `UPDATE recalculation_status
       SET status = 'clear', last_error = NULL, updated_at = now()
       WHERE person_id = $1::uuid AND generation = $2`,
      [personId, generation],
    );
    return;
  }
  await db.query(
    `UPDATE recalculation_status
     SET status = 'clear', last_error = NULL, updated_at = now()
     WHERE person_id = $1::uuid`,
    [personId],
  );
}

export async function markRecalculationFailed(
  db: RecalcQueryable,
  personId: string,
  errorMessage: string,
  generation?: number,
): Promise<void> {
  if (generation != null) {
    await db.query(
      `UPDATE recalculation_status
       SET status = 'failed', last_error = $2, updated_at = now()
       WHERE person_id = $1::uuid AND generation = $3`,
      [personId, errorMessage.slice(0, 2000), generation],
    );
    return;
  }
  await db.query(
    `UPDATE recalculation_status
     SET status = 'failed', last_error = $2, updated_at = now()
     WHERE person_id = $1::uuid`,
    [personId, errorMessage.slice(0, 2000)],
  );
}

export async function markRecalculationStale(
  db: RecalcQueryable,
  personId: string,
  errorMessage?: string,
): Promise<void> {
  await db.query(
    `UPDATE recalculation_status
     SET status = 'stale', last_error = COALESCE($2, last_error), updated_at = now()
     WHERE person_id = $1::uuid`,
    [personId, errorMessage?.slice(0, 2000) ?? null],
  );
}

export async function getRecalculationStatus(
  db: RecalcQueryable,
  personId: string,
): Promise<RecalculationStatusRow | null> {
  const result = await db.query<{
    person_id: string;
    from_effective_date: string;
    status: string;
    generation: string | number | bigint;
    job_key: string;
    last_error: string | null;
    updated_at: Date;
    created_at: Date;
  }>(
    `SELECT
       person_id,
       to_char(from_effective_date, 'YYYY-MM-DD') AS from_effective_date,
       status,
       generation,
       job_key,
       last_error,
       updated_at,
       created_at
     FROM recalculation_status WHERE person_id = $1::uuid`,
    [personId],
  );
  const row = result.rows[0];
  return row ? mapStatusRow(row) : null;
}

/** Platform-wide signal for UX-DR5 — any pending/failed/stale person. */
export async function getPlatformRecalcSignal(
  db: RecalcQueryable,
): Promise<PlatformRecalcSignal> {
  const result = await db.query<{
    has_pending: boolean;
    has_blocking: boolean;
    latest: Date | null;
    affected_person_count: string | number;
  }>(
    `SELECT
       EXISTS (
         SELECT 1 FROM recalculation_status WHERE status = 'pending'
       ) AS has_pending,
       EXISTS (
         SELECT 1 FROM recalculation_status WHERE status IN ('failed', 'stale')
       ) AS has_blocking,
       (
         SELECT MAX(updated_at) FROM recalculation_status
         WHERE status IN ('pending', 'failed', 'stale')
       ) AS latest,
       (
         SELECT COUNT(DISTINCT person_id)::int FROM recalculation_status
         WHERE status IN ('pending', 'failed', 'stale')
       ) AS affected_person_count`,
  );
  const row = result.rows[0];
  const recalculationPending = Boolean(row?.has_pending);
  const blockingStale = Boolean(row?.has_blocking);
  const stalePendingUntil = formatPendingUntil(row?.latest ?? new Date());
  const affectedPersonCount = Number(row?.affected_person_count ?? 0);
  return {
    recalculationPending,
    blockingStale,
    stalePendingUntil,
    affectedPersonCount: Number.isFinite(affectedPersonCount)
      ? affectedPersonCount
      : 0,
  };
}

/** Count-only recalc aggregate for ops dashboard — never returns personId. */
export type OpsRecalcAggregate = {
  pendingCount: number;
  failedCount: number;
  staleCount: number;
  /** Opaque job keys only (personId stripped) — for correlation, optional. */
  sampleJobKeys: string[];
  signal: PlatformRecalcSignal;
};

/**
 * Ops-safe recalc aggregate. Prefer this over listPendingRecalculationJobs
 * (which includes personId) for any SysAdmin / ops surface.
 */
export async function getOpsRecalcAggregate(
  db: RecalcQueryable,
): Promise<OpsRecalcAggregate> {
  const counts = await db.query<{
    pending_count: string | number;
    failed_count: string | number;
    stale_count: string | number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
       COUNT(*) FILTER (WHERE status = 'stale')::int AS stale_count
     FROM recalculation_status`,
  );
  const row = counts.rows[0];
  const pendingCount = Number(row?.pending_count ?? 0);
  const failedCount = Number(row?.failed_count ?? 0);
  const staleCount = Number(row?.stale_count ?? 0);

  const keys = await db.query<{ generation: string | number | bigint }>(
    `SELECT generation
     FROM recalculation_status
     WHERE status IN ('pending', 'failed', 'stale')
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 5`,
  );
  // Opaque generation-only keys — never embed personId (job_key is recalc:<personId>:gN).
  const sampleJobKeys = keys.rows
    .map((r) => {
      const generation = Number(r.generation);
      return Number.isFinite(generation)
        ? `recalc:g${generation}`
        : null;
    })
    .filter((k): k is string => typeof k === "string" && k.length > 0);

  const signal = await getPlatformRecalcSignal(db);
  return {
    pendingCount,
    failedCount,
    staleCount,
    sampleJobKeys,
    signal,
  };
}

/**
 * All blocking rows that still need a job (worker reclaim / idempotent replay).
 * Matches getPlatformRecalcSignal blocking set: pending | failed | stale.
 */
export async function listPendingRecalculationJobs(
  db: RecalcQueryable,
): Promise<RecalcJobPayload[]> {
  const result = await db.query<{
    person_id: string;
    from_effective_date: string;
    generation: string | number | bigint;
    job_key: string;
  }>(
    `SELECT
       person_id,
       to_char(from_effective_date, 'YYYY-MM-DD') AS from_effective_date,
       generation,
       job_key
     FROM recalculation_status
     WHERE status IN ('pending', 'failed', 'stale')
     ORDER BY from_effective_date ASC, person_id ASC`,
  );
  return result.rows.map((row) => ({
    personId: row.person_id,
    fromEffectiveDate: row.from_effective_date,
    generation: Number(row.generation),
    jobKey: row.job_key,
  }));
}

/**
 * If person still has pending/failed/stale status, re-enqueue current generation.
 * Used after idempotent Reverse/Correct replay and by worker reclaim.
 */
export async function reenqueuePendingRecalculationIfNeeded(
  db: RecalcQueryable,
  personId: string,
): Promise<RecalcJobPayload | null> {
  const current = await getRecalculationStatus(db, personId);
  if (
    !current ||
    (current.status !== "pending" &&
      current.status !== "failed" &&
      current.status !== "stale")
  ) {
    return null;
  }
  const payload: RecalcJobPayload = {
    personId: current.personId,
    fromEffectiveDate: current.fromEffectiveDate,
    generation: current.generation,
    jobKey: current.jobKey,
  };
  await enqueueRecalculationAfterCommit(payload);
  return payload;
}

function formatPendingUntil(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

/**
 * After commit: enqueue pg-boss job when a port is registered.
 * Durable pending row already set in-txn — UI blocks even if enqueue is deferred.
 * Callers in the API process must register a send port (see web `recalc-enqueue.ts`);
 * workers reclaim orphan pending on bootstrap.
 */
export async function enqueueRecalculationAfterCommit(
  payload: RecalcJobPayload,
): Promise<void> {
  const enqueue = resolveEnqueue();
  if (!enqueue) {
    console.warn(
      `[recalc] enqueue port unset — pending left for reclaim person=${payload.personId} g=${payload.generation}`,
    );
    return;
  }
  await enqueue(payload);
}

/**
 * Mark pending in-txn and schedule enqueue after the caller commits.
 * Returns the job payload for post-commit enqueue.
 */
export async function scheduleHeavyRecalculation(
  db: RecalcQueryable,
  personId: string,
  fromEffectiveDate: string,
): Promise<RecalcJobPayload> {
  return markRecalculationPending(db, personId, fromEffectiveDate);
}

/**
 * Idempotent historical recalc handler body (invoked by pg-boss worker).
 * Loads authoritative set from earliest point, applies FR-18 order, runs projection seam.
 */
export async function runHistoricalRecalculation(
  db: Pool | PoolClient,
  payload: RecalcJobPayload,
): Promise<{ applied: number; skipped: boolean }> {
  const current = await getRecalculationStatus(db, payload.personId);
  if (!current) {
    return { applied: 0, skipped: true };
  }
  // Stale generation — a newer pending superseded this job
  if (current.generation !== payload.generation) {
    return { applied: 0, skipped: true };
  }
  if (current.status === "clear") {
    return { applied: 0, skipped: true };
  }

  // Cap matches listBusinessEventsForPersonForApply default/max — never clear on truncation.
  const applyLimit = 2000;
  const events = await listBusinessEventsForPersonForApply(
    db,
    payload.personId,
    { fromEffectiveDate: payload.fromEffectiveDate, limit: applyLimit },
  );
  if (events.length >= applyLimit) {
    const message = `apply set truncated at ${applyLimit} events; refusing to clear pending`;
    await markRecalculationFailed(
      db,
      payload.personId,
      message,
      payload.generation,
    );
    throw new Error(message);
  }
  const ordered = orderBusinessEventsForApply(events);

  const client =
    "connect" in db
      ? await (db as Pool).connect()
      : (db as PoolClient);
  const release = "connect" in db;
  try {
    if (release) await client.query("BEGIN");
    // Re-validate generation under row lock — TOCTOU after domain projectors (4.5+)
    const locked = await client.query<{
      generation: string | number | bigint;
      status: string;
    }>(
      `SELECT generation, status FROM recalculation_status
       WHERE person_id = $1::uuid FOR UPDATE`,
      [payload.personId],
    );
    const lockedRow = locked.rows[0];
    if (
      !lockedRow ||
      Number(lockedRow.generation) !== payload.generation ||
      lockedRow.status === "clear"
    ) {
      if (release) await client.query("ROLLBACK");
      return { applied: 0, skipped: true };
    }

    const chainById = await listChainLinksForEvents(
      client,
      ordered.map((e) => e.id),
    );

    let applied = 0;
    for (const event of ordered) {
      const links = chainById.get(event.id);
      if (
        links &&
        (links.cancellations.length > 0 || links.reversals.length > 0)
      ) {
        continue;
      }
      if (
        event.eventType === "EventCancelled" ||
        event.eventType === "EventReversed" ||
        event.eventType === "EventCorrected"
      ) {
        continue;
      }

      const asOf = todayDateOnlyTehran();
      const hookCtx: ProjectionRefreshContext = {
        client,
        eventId: event.id,
        eventType: event.eventType,
        // Evaluation-by-date: storage-Scheduled with ED ≤ asOf applies as Effective (UJ-1 / 4.7).
        // Do NOT UPDATE kernel status — storage may remain Scheduled (4.3).
        applyToCurrentProjection:
          evaluationStatusAsOf(event, asOf) === "Effective",
      };
      await runProjectionRefreshHook(hookCtx);
      applied += 1;
    }
    await clearRecalculationStatus(client, payload.personId, payload.generation);
    if (release) await client.query("COMMIT");
    return { applied, skipped: false };
  } catch (err) {
    if (release) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // keep original
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    await markRecalculationFailed(
      db,
      payload.personId,
      message,
      payload.generation,
    );
    throw err;
  } finally {
    if (release) client.release();
  }
}

/** Expose ordered load for selfchecks / workers. */
export async function loadOrderedEventsForRecalc(
  db: RecalcQueryable,
  personId: string,
  fromEffectiveDate: string,
): Promise<BusinessEventRecord[]> {
  const events = await listBusinessEventsForPersonForApply(db, personId, {
    fromEffectiveDate,
  });
  return orderBusinessEventsForApply(events);
}
