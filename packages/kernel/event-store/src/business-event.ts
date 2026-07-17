import { randomUUID } from "node:crypto";

import { parseDateOnly } from "@divan/temporal-engine";
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
