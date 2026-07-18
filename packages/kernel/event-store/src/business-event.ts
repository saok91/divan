import { randomUUID } from "node:crypto";

import { parseDateOnly, APPLY_ORDER_SQL_ORDER_BY } from "@divan/temporal-engine";
import type { Pool, PoolClient } from "pg";

type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

/** Provisional lifecycle tokens — transitions owned by Stories 4.2 / 4.3. */
export type BusinessEventStatus =
  | "Draft"
  | "Scheduled"
  | "Effective"
  | "Cancelled"
  | "Reversed";

/**
 * Personnel Event type names: PascalCase, past-tense convention
 * (e.g. `TransferRecorded`, `EmploymentStarted`). Application enforces
 * PascalCase shape; past-tense is documented convention for authors.
 */
const EVENT_TYPE_PASCAL_RE = /^[A-Z][A-Za-z0-9]*$/;

/** UUID string shape for bind params (application-level refs; no Prisma FK). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Obvious sensitive keys — fail closed rather than store.
 * Matched case-insensitively after stripping underscores (`Amount` ≡ `amount`,
 * `base_salary` ≡ `baseSalary`).
 */
const SENSITIVE_EVIDENCE_KEYS = new Set([
  "amount",
  "compensation",
  "salary",
  "basesalary",
  "nationalid",
  "ssn",
  "iban",
  "bankaccount",
  "accountnumber",
  "password",
  "secret",
  "token",
  "religion",
  "health",
]);

const MAX_SENSITIVE_WALK_DEPTH = 32;

function normalizeSensitiveKey(key: string): string {
  return key.toLowerCase().replace(/_/g, "");
}

export type AppendBusinessEventInput = {
  correlationId: string;
  /** PascalCase past-tense Personnel Event type (SoT in `event_type` column). */
  eventType: string;
  personId: string;
  /**
   * Applicable Employment. Nullable when Draft / Start has not bound
   * Employment yet (FR-14); set once Employment is assigned.
   */
  employmentId?: string | null;
  /** Business Effective Date as YYYY-MM-DD (DATE column — not timestamptz). */
  effectiveDate: string;
  /** Registration actor InternalAccount id (TEXT cuid). Dual-written to `actor_account_id`. */
  registeredBy: string;
  /** Registration clock; defaults to now. Mapped to `registered_at` and `occurred_at`. */
  registeredAt?: Date;
  /** Defaults to `Draft` for scaffolding inserts (product transitions = 4.2+). */
  status?: BusinessEventStatus;
  reason?: string;
  referenceCode?: string;
  provenance?: Record<string, unknown>;
  /** Structural refs / codes only — never sensitive field values. */
  beforeEvidence?: Record<string, unknown> | null;
  afterEvidence?: Record<string, unknown> | null;
  /** Allowed for column-role selfcheck; product finalize = Story 4.2. */
  finalizedBy?: string | null;
  finalizedAt?: Date | null;
  correctsEventId?: string | null;
  cancelsEventId?: string | null;
  reversesEventId?: string | null;
  supersedesEventId?: string | null;
  scope?: Record<string, unknown>;
  /** Non-sensitive structural payload only. */
  payload?: Record<string, unknown>;
};

export type AppendBusinessEventResult = {
  id: string;
};

export class BusinessEventValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BusinessEventValidationError";
    this.code = code;
  }
}

export function assertValidBusinessEventType(eventType: string): void {
  if (typeof eventType !== "string" || !eventType.trim()) {
    throw new BusinessEventValidationError(
      "invalid_event_type",
      "eventType is required (PascalCase past-tense, e.g. TransferRecorded)",
    );
  }
  const trimmed = eventType.trim();
  if (!EVENT_TYPE_PASCAL_RE.test(trimmed)) {
    throw new BusinessEventValidationError(
      "invalid_event_type",
      `eventType must be PascalCase past-tense (rejected: ${JSON.stringify(trimmed)})`,
    );
  }
}

/**
 * Reject objects that embed known sensitive keys (fail-closed).
 * Evidence / provenance / scope / payload hold refs and codes only —
 * never amounts or national IDs.
 */
export function assertNoSensitiveEvidence(
  label: string,
  value: Record<string, unknown> | null | undefined,
): void {
  if (value == null) return;
  walkRejectSensitive(label, value, "", new WeakSet(), 0);
}

function walkRejectSensitive(
  label: string,
  value: unknown,
  path: string,
  seen: WeakSet<object>,
  depth: number,
): void {
  if (value == null || typeof value !== "object") return;
  if (depth > MAX_SENSITIVE_WALK_DEPTH) {
    throw new BusinessEventValidationError(
      "sensitive_evidence_too_deep",
      `${label} nesting exceeds ${MAX_SENSITIVE_WALK_DEPTH} at ${path || "(root)"}`,
    );
  }
  if (seen.has(value)) {
    throw new BusinessEventValidationError(
      "sensitive_evidence_cycle",
      `${label} must not contain cyclic references at ${path || "(root)"}`,
    );
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, i) =>
      walkRejectSensitive(label, item, `${path}[${i}]`, seen, depth + 1),
    );
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if (SENSITIVE_EVIDENCE_KEYS.has(normalizeSensitiveKey(key))) {
      throw new BusinessEventValidationError(
        "sensitive_evidence_forbidden",
        `${label} must not include sensitive key ${JSON.stringify(key)} at ${next}`,
      );
    }
    walkRejectSensitive(label, child, next, seen, depth + 1);
  }
}

function assertUuid(label: string, code: string, value: string): void {
  if (!UUID_RE.test(value)) {
    throw new BusinessEventValidationError(
      code,
      `${label} must be a UUID (rejected: ${JSON.stringify(value)})`,
    );
  }
}

/** Empty / whitespace-only optional UUID → null; otherwise trim + validate. */
function optionalUuid(
  label: string,
  code: string,
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  assertUuid(label, code, trimmed);
  return trimmed;
}

function assertValidInstant(label: string, code: string, value: Date): void {
  if (Number.isNaN(value.getTime())) {
    throw new BusinessEventValidationError(
      code,
      `${label} must be a valid Date`,
    );
  }
}

/**
 * Append an `event_class=business` Personnel Event row.
 * Append-only — there is no updateBusinessEvent / deleteBusinessEvent.
 */
export async function appendBusinessEvent(
  db: PgQueryable,
  input: AppendBusinessEventInput,
): Promise<AppendBusinessEventResult> {
  assertValidBusinessEventType(input.eventType);
  const eventType = input.eventType.trim();

  const dateParsed = parseDateOnly(input.effectiveDate);
  if (!dateParsed.ok) {
    throw new BusinessEventValidationError(
      "invalid_effective_date",
      `effectiveDate must be YYYY-MM-DD date-only (${dateParsed.reason})`,
    );
  }

  const personId = input.personId?.trim() ?? "";
  if (!personId) {
    throw new BusinessEventValidationError(
      "invalid_person_id",
      "personId is required",
    );
  }
  assertUuid("personId", "invalid_person_id", personId);

  const registeredBy = input.registeredBy?.trim() ?? "";
  if (!registeredBy) {
    throw new BusinessEventValidationError(
      "invalid_registered_by",
      "registeredBy is required",
    );
  }

  const correlationId = input.correlationId?.trim() ?? "";
  if (!correlationId) {
    throw new BusinessEventValidationError(
      "invalid_correlation_id",
      "correlationId is required",
    );
  }
  assertUuid("correlationId", "invalid_correlation_id", correlationId);

  const employmentId = optionalUuid(
    "employmentId",
    "invalid_employment_id",
    input.employmentId,
  );
  const correctsEventId = optionalUuid(
    "correctsEventId",
    "invalid_corrects_event_id",
    input.correctsEventId,
  );
  const cancelsEventId = optionalUuid(
    "cancelsEventId",
    "invalid_cancels_event_id",
    input.cancelsEventId,
  );
  const reversesEventId = optionalUuid(
    "reversesEventId",
    "invalid_reverses_event_id",
    input.reversesEventId,
  );
  const supersedesEventId = optionalUuid(
    "supersedesEventId",
    "invalid_supersedes_event_id",
    input.supersedesEventId,
  );

  const status: BusinessEventStatus = input.status ?? "Draft";
  const registeredAt = input.registeredAt ?? new Date();
  assertValidInstant("registeredAt", "invalid_registered_at", registeredAt);

  const finalizedByRaw = input.finalizedBy?.trim() ?? "";
  const hasFinalizedBy = finalizedByRaw.length > 0;
  const hasFinalizedAt = input.finalizedAt != null;
  if (hasFinalizedAt !== hasFinalizedBy) {
    throw new BusinessEventValidationError(
      "invalid_finalized_pair",
      "finalizedAt and finalizedBy must both be set or both omitted",
    );
  }
  let finalizedAtIso: string | null = null;
  let finalizedBy: string | null = null;
  if (hasFinalizedAt && hasFinalizedBy) {
    assertValidInstant("finalizedAt", "invalid_finalized_at", input.finalizedAt!);
    finalizedAtIso = input.finalizedAt!.toISOString();
    finalizedBy = finalizedByRaw;
  }

  const provenance = input.provenance ?? {};
  const scope = input.scope ?? {};
  const payload = input.payload ?? {};

  assertNoSensitiveEvidence("provenance", provenance);
  assertNoSensitiveEvidence("beforeEvidence", input.beforeEvidence);
  assertNoSensitiveEvidence("afterEvidence", input.afterEvidence);
  assertNoSensitiveEvidence("payload", payload);
  assertNoSensitiveEvidence("scope", scope);

  const id = randomUUID();

  await db.query(
    `INSERT INTO kernel_events (
       id, event_class, correlation_id, actor_account_id, occurred_at,
       operation, scope, result, reason, entity_type, entity_id, payload,
       event_type, person_id, employment_id, effective_date,
       registered_at, registered_by, finalized_at, finalized_by,
       status, reference_code, provenance, before_evidence, after_evidence,
       corrects_event_id, cancels_event_id, reverses_event_id, supersedes_event_id
     ) VALUES (
       $1::uuid, 'business', $2::uuid, $3, $4,
       $5, $6::jsonb, NULL, $7, 'person', $8, $9::jsonb,
       $10, $11::uuid, $12::uuid, $13::date,
       $14, $15, $16, $17,
       $18, $19, $20::jsonb, $21::jsonb, $22::jsonb,
       $23::uuid, $24::uuid, $25::uuid, $26::uuid
     )`,
    [
      id,
      correlationId,
      registeredBy,
      registeredAt.toISOString(),
      // operation NOT NULL: mirror event type; event_type column is SoT for type
      eventType,
      JSON.stringify(scope),
      input.reason ?? null,
      personId,
      JSON.stringify(payload),
      eventType,
      personId,
      employmentId,
      dateParsed.value,
      registeredAt.toISOString(),
      registeredBy,
      finalizedAtIso,
      finalizedBy,
      status,
      input.referenceCode ?? null,
      JSON.stringify(provenance),
      input.beforeEvidence == null
        ? null
        : JSON.stringify(input.beforeEvidence),
      input.afterEvidence == null ? null : JSON.stringify(input.afterEvidence),
      correctsEventId,
      cancelsEventId,
      reversesEventId,
      supersedesEventId,
    ],
  );

  return { id };
}

/** Business event row shape for thin reads (Story 4.3). */
export type BusinessEventRecord = {
  id: string;
  eventType: string;
  personId: string;
  employmentId: string | null;
  effectiveDate: string;
  status: BusinessEventStatus;
  registeredBy: string;
  registeredAt: Date;
  finalizedBy: string | null;
  finalizedAt: Date | null;
  reason: string | null;
  correctsEventId: string | null;
  cancelsEventId: string | null;
  reversesEventId: string | null;
  supersedesEventId: string | null;
  payload: Record<string, unknown>;
  correlationId: string;
};

type KernelBusinessRow = {
  id: string;
  event_type: string;
  person_id: string;
  employment_id: string | null;
  effective_date: Date | string;
  status: string;
  registered_by: string;
  registered_at: Date;
  finalized_by: string | null;
  finalized_at: Date | null;
  reason: string | null;
  corrects_event_id: string | null;
  cancels_event_id: string | null;
  reverses_event_id: string | null;
  supersedes_event_id: string | null;
  payload: unknown;
  correlation_id: string;
};

function dateOnlyFromPg(value: Date | string): string {
  if (typeof value === "string") {
    // DATE drivers may return 'YYYY-MM-DD' already
    return value.slice(0, 10);
  }
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapBusinessRow(row: KernelBusinessRow): BusinessEventRecord {
  const status = row.status as BusinessEventStatus;
  return {
    id: row.id,
    eventType: row.event_type,
    personId: row.person_id,
    employmentId: row.employment_id,
    effectiveDate: dateOnlyFromPg(row.effective_date),
    status,
    registeredBy: row.registered_by,
    registeredAt: row.registered_at,
    finalizedBy: row.finalized_by,
    finalizedAt: row.finalized_at,
    reason: row.reason,
    correctsEventId: row.corrects_event_id,
    cancelsEventId: row.cancels_event_id,
    reversesEventId: row.reverses_event_id,
    supersedesEventId: row.supersedes_event_id,
    payload: asRecord(row.payload),
    correlationId: row.correlation_id,
  };
}

const BUSINESS_SELECT = `
  id, event_type, person_id, employment_id, effective_date, status,
  registered_by, registered_at, finalized_by, finalized_at, reason,
  corrects_event_id, cancels_event_id, reverses_event_id, supersedes_event_id,
  payload, correlation_id
`;

/**
 * Load one business event by id (no lock).
 * Returns null when missing or not `event_class=business`.
 */
export async function getBusinessEventById(
  db: PgQueryable,
  eventId: string,
): Promise<BusinessEventRecord | null> {
  assertUuid("eventId", "invalid_event_id", eventId.trim());
  const result = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT}
     FROM kernel_events
     WHERE id = $1::uuid AND event_class = 'business'`,
    [eventId.trim()],
  );
  const row = result.rows[0];
  return row ? mapBusinessRow(row) : null;
}

/**
 * Lock a business event row for Cancel/Reverse race decisions (`FOR UPDATE`).
 */
export async function lockBusinessEventForUpdate(
  db: PgQueryable,
  eventId: string,
): Promise<BusinessEventRecord | null> {
  assertUuid("eventId", "invalid_event_id", eventId.trim());
  const result = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT}
     FROM kernel_events
     WHERE id = $1::uuid AND event_class = 'business'
     FOR UPDATE`,
    [eventId.trim()],
  );
  const row = result.rows[0];
  return row ? mapBusinessRow(row) : null;
}

/** Children that cancel / reverse / correct a target event. */
export async function listChainLinksForEvent(
  db: PgQueryable,
  targetEventId: string,
): Promise<{
  cancellations: BusinessEventRecord[];
  reversals: BusinessEventRecord[];
  corrections: BusinessEventRecord[];
}> {
  assertUuid("targetEventId", "invalid_event_id", targetEventId.trim());
  const id = targetEventId.trim();
  const cancels = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT} FROM kernel_events
     WHERE event_class = 'business' AND cancels_event_id = $1::uuid
     ORDER BY registered_at ASC, id ASC`,
    [id],
  );
  const reverses = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT} FROM kernel_events
     WHERE event_class = 'business' AND reverses_event_id = $1::uuid
     ORDER BY registered_at ASC, id ASC`,
    [id],
  );
  const corrects = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT} FROM kernel_events
     WHERE event_class = 'business' AND corrects_event_id = $1::uuid
     ORDER BY registered_at ASC, id ASC`,
    [id],
  );
  return {
    cancellations: cancels.rows.map(mapBusinessRow),
    reversals: reverses.rows.map(mapBusinessRow),
    corrections: corrects.rows.map(mapBusinessRow),
  };
}

/**
 * Batch chain links for many targets (avoids N×3 queries on list screens).
 * Keys are target event ids; missing targets get empty link lists.
 */
export async function listChainLinksForEvents(
  db: PgQueryable,
  targetEventIds: string[],
): Promise<
  Map<
    string,
    {
      cancellations: BusinessEventRecord[];
      reversals: BusinessEventRecord[];
      corrections: BusinessEventRecord[];
    }
  >
> {
  const unique = [
    ...new Set(
      targetEventIds.map((id) => id.trim()).filter((id) => id.length > 0),
    ),
  ];
  const empty = (): {
    cancellations: BusinessEventRecord[];
    reversals: BusinessEventRecord[];
    corrections: BusinessEventRecord[];
  } => ({ cancellations: [], reversals: [], corrections: [] });
  const map = new Map<string, ReturnType<typeof empty>>();
  for (const id of unique) {
    assertUuid("targetEventId", "invalid_event_id", id);
    map.set(id, empty());
  }
  if (unique.length === 0) return map;

  const cancels = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT} FROM kernel_events
     WHERE event_class = 'business' AND cancels_event_id = ANY($1::uuid[])
     ORDER BY registered_at ASC, id ASC`,
    [unique],
  );
  const reverses = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT} FROM kernel_events
     WHERE event_class = 'business' AND reverses_event_id = ANY($1::uuid[])
     ORDER BY registered_at ASC, id ASC`,
    [unique],
  );
  const corrects = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT} FROM kernel_events
     WHERE event_class = 'business' AND corrects_event_id = ANY($1::uuid[])
     ORDER BY registered_at ASC, id ASC`,
    [unique],
  );

  for (const row of cancels.rows) {
    const mapped = mapBusinessRow(row);
    const key = mapped.cancelsEventId;
    if (!key) continue;
    const bucket = map.get(key) ?? empty();
    bucket.cancellations.push(mapped);
    map.set(key, bucket);
  }
  for (const row of reverses.rows) {
    const mapped = mapBusinessRow(row);
    const key = mapped.reversesEventId;
    if (!key) continue;
    const bucket = map.get(key) ?? empty();
    bucket.reversals.push(mapped);
    map.set(key, bucket);
  }
  for (const row of corrects.rows) {
    const mapped = mapBusinessRow(row);
    const key = mapped.correctsEventId;
    if (!key) continue;
    const bucket = map.get(key) ?? empty();
    bucket.corrections.push(mapped);
    map.set(key, bucket);
  }
  return map;
}

/** Authoritative business events for a person (excludes pure Draft storage rows). */
export async function listBusinessEventsForPerson(
  db: PgQueryable,
  personId: string,
  opts: { limit?: number } = {},
): Promise<BusinessEventRecord[]> {
  assertUuid("personId", "invalid_person_id", personId.trim());
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const result = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT} FROM kernel_events
     WHERE event_class = 'business' AND person_id = $1::uuid
     ORDER BY effective_date DESC, registered_at DESC, id DESC
     LIMIT $2`,
    [personId.trim(), limit],
  );
  return result.rows.map(mapBusinessRow);
}

/**
 * Authoritative apply / reconstruct load order (Story 4.4 / FR-18).
 * SQL twin of `@divan/temporal-engine` `orderBusinessEventsForApply` —
 * never reuse the DESC UI list sort for reconstruction.
 *
 * Optional `fromEffectiveDate`: include events with effective_date >= from.
 */
export async function listBusinessEventsForPersonForApply(
  db: PgQueryable,
  personId: string,
  opts: { fromEffectiveDate?: string; limit?: number } = {},
): Promise<BusinessEventRecord[]> {
  assertUuid("personId", "invalid_person_id", personId.trim());
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 2000);
  const from = opts.fromEffectiveDate?.trim();
  if (from) {
    const result = await db.query<KernelBusinessRow>(
      `SELECT ${BUSINESS_SELECT} FROM kernel_events
       WHERE event_class = 'business' AND person_id = $1::uuid
         AND effective_date >= $2::date
       ORDER BY ${APPLY_ORDER_SQL_ORDER_BY}
       LIMIT $3`,
      [personId.trim(), from, limit],
    );
    return result.rows.map(mapBusinessRow);
  }
  const result = await db.query<KernelBusinessRow>(
    `SELECT ${BUSINESS_SELECT} FROM kernel_events
     WHERE event_class = 'business' AND person_id = $1::uuid
     ORDER BY ${APPLY_ORDER_SQL_ORDER_BY}
     LIMIT $2`,
    [personId.trim(), limit],
  );
  return result.rows.map(mapBusinessRow);
}
