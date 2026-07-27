/**
 * Read-only audit evidence query over kernel_events (Story 7.1 / FR-42).
 * Append-only store — no UPDATE/DELETE helpers. Access rows never feed projections (AD-3).
 */
import type { Pool, PoolClient } from "pg";

type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

type EventClass = "business" | "access";
type AccessResult = "allow" | "deny";
type AccessEventScope = Record<string, unknown>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/** Typed investigation DTO — distinct from AppendAccessEventInput. */
export type AuditEvidenceRecord = {
  id: string;
  eventClass: EventClass;
  correlationId: string;
  actorAccountId: string | null;
  occurredAt: Date;
  operation: string;
  scope: AccessEventScope;
  result: AccessResult | null;
  reason: string | null;
  entityType: string | null;
  entityId: string | null;
  /** Non-sensitive metadata only — never HR field values. */
  payload: Record<string, unknown>;
};

export type QueryAuditEvidenceFilters = {
  actorAccountId?: string;
  occurredAtFrom?: Date;
  occurredAtTo?: Date;
  /** Exact operation match. */
  operation?: string;
  /** Prefix match via `operation LIKE $x || '%'`. */
  operationPrefix?: string;
  entityType?: string;
  entityId?: string;
  result?: AccessResult;
  correlationId?: string;
  /** Default both when omitted. */
  eventClass?: EventClass;
  /**
   * JSONB containment (`scope @> $json`). Prefer over `scope->>'k' =`
   * so default/GIN-friendly plans remain valid.
   */
  scopeContains?: AccessEventScope;
  limit?: number;
  offset?: number;
};

type KernelEventRow = {
  id: string;
  event_class: string;
  correlation_id: string;
  actor_account_id: string | null;
  occurred_at: Date | string;
  operation: string;
  scope: AccessEventScope | string;
  result: string | null;
  reason: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | string;
};

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function toOccurredAt(value: Date | string): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError("Invalid occurred_at Date from kernel_events");
    }
    return value;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError("Invalid occurred_at value from kernel_events");
  }
  return d;
}

function mapRow(row: KernelEventRow): AuditEvidenceRecord {
  const eventClass =
    row.event_class === "business" ? "business" : "access";
  const result =
    row.result === "allow" || row.result === "deny" ? row.result : null;
  return {
    id: row.id,
    eventClass,
    correlationId: row.correlation_id,
    actorAccountId: row.actor_account_id,
    occurredAt: toOccurredAt(row.occurred_at),
    operation: row.operation,
    scope: parseJsonObject(row.scope),
    result,
    reason: row.reason,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: parseJsonObject(row.payload),
  };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  const n = Math.floor(limit);
  if (n < 1) return 1;
  return Math.min(n, MAX_LIMIT);
}

function clampOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.floor(offset));
}

/** Escape `%`, `_`, and `\` for PostgreSQL `LIKE … ESCAPE '\'`. */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function toSafeIso(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("Invalid Date for audit evidence filter");
  }
  return value.toISOString();
}

/**
 * Read-only query of business + access evidence from kernel_events.
 * Never invents rows; never UPDATE/DELETE.
 */
export async function queryAuditEvidence(
  db: PgQueryable,
  filters: QueryAuditEvidenceFilters = {},
): Promise<AuditEvidenceRecord[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters.eventClass === "access" || filters.eventClass === "business") {
    where.push(`event_class = $${i++}`);
    params.push(filters.eventClass);
  } else {
    where.push(`event_class IN ('access', 'business')`);
  }

  if (filters.actorAccountId !== undefined) {
    where.push(`actor_account_id = $${i++}`);
    params.push(filters.actorAccountId);
  }

  if (filters.occurredAtFrom) {
    where.push(`occurred_at >= $${i++}::timestamptz`);
    params.push(toSafeIso(filters.occurredAtFrom));
  }

  if (filters.occurredAtTo) {
    where.push(`occurred_at <= $${i++}::timestamptz`);
    params.push(toSafeIso(filters.occurredAtTo));
  }

  if (filters.operation !== undefined && filters.operation.trim()) {
    where.push(`operation = $${i++}`);
    params.push(filters.operation.trim());
  } else if (
    filters.operationPrefix !== undefined &&
    filters.operationPrefix.trim()
  ) {
    where.push(`operation LIKE $${i++} ESCAPE '\\'`);
    params.push(`${escapeLikePattern(filters.operationPrefix.trim())}%`);
  }

  if (filters.entityType !== undefined && filters.entityType.trim()) {
    where.push(`entity_type = $${i++}`);
    params.push(filters.entityType.trim());
  }

  if (filters.entityId !== undefined && filters.entityId.trim()) {
    where.push(`entity_id = $${i++}`);
    params.push(filters.entityId.trim());
  }

  if (filters.result === "allow" || filters.result === "deny") {
    where.push(`result = $${i++}`);
    params.push(filters.result);
  }

  if (filters.correlationId !== undefined && filters.correlationId.trim()) {
    const cid = filters.correlationId.trim();
    if (!UUID_RE.test(cid)) {
      return [];
    }
    where.push(`correlation_id = $${i++}::uuid`);
    params.push(cid);
  }

  if (
    filters.scopeContains &&
    Object.keys(filters.scopeContains).length > 0
  ) {
    where.push(`scope @> $${i++}::jsonb`);
    params.push(JSON.stringify(filters.scopeContains));
  }

  const limit = clampLimit(filters.limit);
  const offset = clampOffset(filters.offset);
  params.push(limit);
  const limitIdx = i++;
  params.push(offset);
  const offsetIdx = i++;

  const sql = `
    SELECT
      id::text AS id,
      event_class,
      correlation_id::text AS correlation_id,
      actor_account_id,
      occurred_at,
      operation,
      scope,
      result,
      reason,
      entity_type,
      entity_id,
      payload
    FROM kernel_events
    WHERE ${where.join(" AND ")}
    ORDER BY occurred_at DESC, id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const result = await db.query(sql, params);
  return (result.rows as KernelEventRow[]).map(mapRow);
}

/**
 * Load a single access/business evidence row by id (self-review gate binding).
 */
export async function getAuditEvidenceById(
  db: PgQueryable,
  id: string,
): Promise<AuditEvidenceRecord | null> {
  const trimmed = id.trim();
  if (!UUID_RE.test(trimmed)) return null;

  const sql = `
    SELECT
      id::text AS id,
      event_class,
      correlation_id::text AS correlation_id,
      actor_account_id,
      occurred_at,
      operation,
      scope,
      result,
      reason,
      entity_type,
      entity_id,
      payload
    FROM kernel_events
    WHERE id = $1::uuid
      AND event_class IN ('access', 'business')
    LIMIT 1
  `;
  const result = await db.query(sql, [trimmed]);
  const row = (result.rows as KernelEventRow[])[0];
  return row ? mapRow(row) : null;
}

/**
 * Access-class only convenience wrapper (FR-42 access evidence).
 */
export async function listAccessEvents(
  db: PgQueryable,
  filters: Omit<QueryAuditEvidenceFilters, "eventClass"> = {},
): Promise<AuditEvidenceRecord[]> {
  return queryAuditEvidence(db, { ...filters, eventClass: "access" });
}
