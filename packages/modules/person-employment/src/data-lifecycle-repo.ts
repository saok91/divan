/**
 * Data lifecycle persistence (Story 7.3 / FR-50).
 * Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
 * Schema: data_lifecycle. Hold rows are never DELETE'd (release = status flip).
 */

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "@divan/db";
import type {
  DisposalRunRecord,
  DisposalRunStatus,
  LegalHoldRecord,
  LegalHoldScopeKind,
  LegalHoldStatus,
  PropagationOutcome,
  PropagationTargetResult,
} from "@divan/audit-envelope";

export type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type DisposalScope = {
  scopeKind: LegalHoldScopeKind | "mixed";
  scopeRef: string;
  /** Optional person ids when scope is broader than a single person. */
  personIds?: string[];
  /** Optional artifact ids in scope. */
  artifactIds?: string[];
  /** Optional element category (e.g. identity.person). */
  elementCategory?: string;
};

function mapHoldRow(row: Record<string, unknown>): LegalHoldRecord {
  return {
    id: String(row.id),
    scopeKind: String(row.scope_kind) as LegalHoldScopeKind,
    scopeRef: String(row.scope_ref),
    reason: String(row.reason),
    placedBy: String(row.placed_by),
    placedAt: new Date(String(row.placed_at)).toISOString(),
    releasedBy: row.released_by != null ? String(row.released_by) : null,
    releasedAt:
      row.released_at != null
        ? new Date(String(row.released_at)).toISOString()
        : null,
    status: String(row.status) as LegalHoldStatus,
    correlationId: String(row.correlation_id),
  };
}

function mapRunRow(row: Record<string, unknown>): DisposalRunRecord {
  return {
    id: String(row.id),
    trigger: String(row.trigger),
    scopeKind: String(row.scope_kind) as DisposalRunRecord["scopeKind"],
    scopeRef: String(row.scope_ref),
    actorAccountId: String(row.actor_account_id),
    startedAt: new Date(String(row.started_at)).toISOString(),
    completedAt:
      row.completed_at != null
        ? new Date(String(row.completed_at)).toISOString()
        : null,
    status: String(row.status) as DisposalRunStatus,
    correlationId: String(row.correlation_id),
    restoreCatchUpRequired: Boolean(row.restore_catchup_required),
  };
}

export async function insertLegalHold(
  db: PgQueryable,
  input: {
    scopeKind: LegalHoldScopeKind;
    scopeRef: string;
    reason: string;
    placedBy: string;
    correlationId: string;
  },
): Promise<LegalHoldRecord> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO data_lifecycle.legal_hold (
       id, scope_kind, scope_ref, reason, placed_by, status, correlation_id
     ) VALUES ($1::uuid, $2, $3, $4, $5, 'active', $6::uuid)
     RETURNING *`,
    [
      id,
      input.scopeKind,
      input.scopeRef,
      input.reason,
      input.placedBy,
      input.correlationId,
    ],
  );
  return mapHoldRow(result.rows[0] as Record<string, unknown>);
}

export async function releaseLegalHold(
  db: PgQueryable,
  input: {
    holdId: string;
    releasedBy: string;
    correlationId: string;
  },
): Promise<LegalHoldRecord | null> {
  const result = await db.query(
    `UPDATE data_lifecycle.legal_hold
     SET status = 'released',
         released_by = $2,
         released_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid AND status = 'active'
     RETURNING *`,
    [input.holdId, input.releasedBy],
  );
  if (!result.rows[0]) return null;
  return mapHoldRow(result.rows[0] as Record<string, unknown>);
}

export async function listLegalHolds(
  db: PgQueryable,
  opts?: { status?: LegalHoldStatus },
): Promise<LegalHoldRecord[]> {
  const result = opts?.status
    ? await db.query(
        `SELECT * FROM data_lifecycle.legal_hold
         WHERE status = $1
         ORDER BY placed_at DESC`,
        [opts.status],
      )
    : await db.query(
        `SELECT * FROM data_lifecycle.legal_hold
         ORDER BY placed_at DESC`,
      );
  return (result.rows as Record<string, unknown>[]).map(mapHoldRow);
}

export async function getLegalHoldById(
  db: PgQueryable,
  holdId: string,
): Promise<LegalHoldRecord | null> {
  const result = await db.query(
    `SELECT * FROM data_lifecycle.legal_hold WHERE id = $1::uuid`,
    [holdId],
  );
  if (!result.rows[0]) return null;
  return mapHoldRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Active holds intersecting a disposal/export scope.
 * Matches: exact artifact, person ids, element_category, or org_scope ref.
 */
export async function findActiveHoldsIntersecting(
  db: PgQueryable,
  scope: {
    artifactId?: string;
    personIds?: string[];
    elementCategory?: string;
    orgScopeRef?: string;
    scopeKind?: LegalHoldScopeKind;
    scopeRef?: string;
  },
): Promise<LegalHoldRecord[]> {
  const clauses: string[] = [`status = 'active'`];
  const params: unknown[] = [];
  const orParts: string[] = [];

  if (scope.artifactId) {
    params.push(scope.artifactId);
    orParts.push(
      `(scope_kind = 'artifact' AND scope_ref = $${params.length})`,
    );
  }
  if (scope.personIds && scope.personIds.length > 0) {
    params.push(scope.personIds);
    orParts.push(
      `(scope_kind = 'person' AND scope_ref = ANY($${params.length}::text[]))`,
    );
  }
  if (scope.elementCategory) {
    params.push(scope.elementCategory);
    orParts.push(
      `(scope_kind = 'element_category' AND scope_ref = $${params.length})`,
    );
  }
  if (scope.orgScopeRef) {
    params.push(scope.orgScopeRef);
    orParts.push(
      `(scope_kind = 'org_scope' AND scope_ref = $${params.length})`,
    );
  }
  if (scope.scopeKind && scope.scopeRef) {
    params.push(scope.scopeKind, scope.scopeRef);
    orParts.push(
      `(scope_kind = $${params.length - 1} AND scope_ref = $${params.length})`,
    );
  }

  if (orParts.length === 0) {
    return [];
  }
  clauses.push(`(${orParts.join(" OR ")})`);

  const result = await db.query(
    `SELECT * FROM data_lifecycle.legal_hold
     WHERE ${clauses.join(" AND ")}
     ORDER BY placed_at ASC`,
    params,
  );
  return (result.rows as Record<string, unknown>[]).map(mapHoldRow);
}

export async function insertDisposalRun(
  db: PgQueryable,
  input: {
    trigger: string;
    scopeKind: string;
    scopeRef: string;
    actorAccountId: string;
    correlationId: string;
    status?: DisposalRunStatus;
  },
): Promise<DisposalRunRecord> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO data_lifecycle.disposal_run (
       id, trigger, scope_kind, scope_ref, actor_account_id,
       status, correlation_id, restore_catchup_required
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, TRUE)
     RETURNING *`,
    [
      id,
      input.trigger,
      input.scopeKind,
      input.scopeRef,
      input.actorAccountId,
      input.status ?? "running",
      input.correlationId,
    ],
  );
  return mapRunRow(result.rows[0] as Record<string, unknown>);
}

export async function completeDisposalRun(
  db: PgQueryable,
  runId: string,
  status: DisposalRunStatus,
): Promise<DisposalRunRecord | null> {
  const result = await db.query(
    `UPDATE data_lifecycle.disposal_run
     SET status = $2, completed_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid
     RETURNING *`,
    [runId, status],
  );
  if (!result.rows[0]) return null;
  return mapRunRow(result.rows[0] as Record<string, unknown>);
}

export async function getDisposalRun(
  db: PgQueryable,
  runId: string,
): Promise<DisposalRunRecord | null> {
  const result = await db.query(
    `SELECT * FROM data_lifecycle.disposal_run WHERE id = $1::uuid`,
    [runId],
  );
  if (!result.rows[0]) return null;
  return mapRunRow(result.rows[0] as Record<string, unknown>);
}

export async function listDisposalRuns(
  db: PgQueryable,
  limit = 50,
): Promise<DisposalRunRecord[]> {
  const result = await db.query(
    `SELECT * FROM data_lifecycle.disposal_run
     ORDER BY started_at DESC
     LIMIT $1`,
    [limit],
  );
  return (result.rows as Record<string, unknown>[]).map(mapRunRow);
}

export async function insertPropagationResult(
  db: PgQueryable,
  input: {
    runId: string;
    targetKind: string;
    targetId?: string;
    outcome: PropagationOutcome;
    detailFa?: string;
    correlationId: string;
  },
): Promise<PropagationTargetResult> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO data_lifecycle.propagation_result (
       id, run_id, target_kind, target_id, outcome, detail_fa, correlation_id
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid)`,
    [
      id,
      input.runId,
      input.targetKind,
      input.targetId ?? null,
      input.outcome,
      input.detailFa ?? null,
      input.correlationId,
    ],
  );
  return {
    target: `${input.targetKind}:${input.targetId ?? "*"}`,
    targetKind: input.targetKind,
    targetId: input.targetId,
    outcome: input.outcome,
    detailFa: input.detailFa,
    correlationId: input.correlationId,
  };
}

export async function listPropagationResults(
  db: PgQueryable,
  runId: string,
): Promise<PropagationTargetResult[]> {
  const result = await db.query(
    `SELECT * FROM data_lifecycle.propagation_result
     WHERE run_id = $1::uuid
     ORDER BY created_at ASC`,
    [runId],
  );
  return (result.rows as Record<string, unknown>[]).map((row) => ({
    target: `${String(row.target_kind)}:${row.target_id != null ? String(row.target_id) : "*"}`,
    targetKind: String(row.target_kind),
    targetId: row.target_id != null ? String(row.target_id) : undefined,
    outcome: String(row.outcome) as PropagationOutcome,
    detailFa: row.detail_fa != null ? String(row.detail_fa) : undefined,
    correlationId: String(row.correlation_id),
  }));
}

export async function upsertDisposedField(
  db: PgQueryable,
  input: {
    personId: string;
    fieldKey: string;
    elementId?: string;
    action: "anonymize" | "delete" | "restrict";
    runId: string;
    correlationId: string;
  },
): Promise<void> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO data_lifecycle.disposed_field (
       id, person_id, field_key, element_id, action, run_id, correlation_id
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7::uuid)
     ON CONFLICT (person_id, field_key) DO UPDATE SET
       action = EXCLUDED.action,
       element_id = EXCLUDED.element_id,
       run_id = EXCLUDED.run_id,
       disposed_at = CURRENT_TIMESTAMP,
       correlation_id = EXCLUDED.correlation_id`,
    [
      id,
      input.personId,
      input.fieldKey,
      input.elementId ?? null,
      input.action,
      input.runId,
      input.correlationId,
    ],
  );
}

export type DisposedFieldMarker = {
  personId: string;
  fieldKey: string;
  elementId: string | null;
  action: "anonymize" | "delete" | "restrict";
  disposedAt: string;
};

export async function listDisposedFieldsForPerson(
  db: PgQueryable,
  personId: string,
): Promise<DisposedFieldMarker[]> {
  const result = await db.query(
    `SELECT * FROM data_lifecycle.disposed_field
     WHERE person_id = $1::uuid
     ORDER BY disposed_at ASC`,
    [personId],
  );
  return (result.rows as Record<string, unknown>[]).map((row) => ({
    personId: String(row.person_id),
    fieldKey: String(row.field_key),
    elementId: row.element_id != null ? String(row.element_id) : null,
    action: String(row.action) as DisposedFieldMarker["action"],
    disposedAt: new Date(String(row.disposed_at)).toISOString(),
  }));
}

/**
 * Run work in a single DB transaction when `db` is a Pool with `connect`.
 * PoolClient / mocks without connect run inline (no nested BEGIN).
 */
export async function withLifecycleTransaction<T>(
  db: PgQueryable,
  fn: (client: PgQueryable) => Promise<T>,
): Promise<T> {
  const maybePool = db as Pool;
  if (typeof maybePool.connect !== "function") {
    return fn(db);
  }
  const client = await maybePool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
