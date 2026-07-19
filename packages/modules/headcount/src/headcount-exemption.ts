/**
 * Headcount Exemption lifecycle (Story 4.13 / FR-29).
 * Audited Primary coverage without consuming Approval capacity.
 * Does NOT invent Override / negative free (→ 4.14).
 */

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient, PrismaClient } from "@divan/db";
import { parseDateOnly, todayDateOnlyTehran } from "@divan/temporal-engine";

export const HEADCOUNT_EXEMPTION_READ_PERMISSION = "headcount.exemption.read";
export const HEADCOUNT_EXEMPTION_WRITE_PERMISSION = "headcount.exemption.write";
export const HEADCOUNT_MATCH_RESELECT_PERMISSION = "headcount.match.reselect";
export const HEADCOUNT_EXEMPTION_DATA_CATEGORY =
  "organization.headcount_exemption";

export const MSG_HEADCOUNT_EXEMPTION_PERMISSION_REQUIRED_FA = "دسترسی ندارید.";
export const MSG_HEADCOUNT_EXEMPTION_NOT_FOUND_FA = "معافیت ظرفیت یافت نشد.";
export const MSG_HEADCOUNT_EXEMPTION_INVALID_VALIDITY_FA =
  "بازه اعتبار معافیت نامعتبر یا خالی است.";
export const MSG_HEADCOUNT_EXEMPTION_INVALID_REASON_FA =
  "دلیل معافیت الزامی است.";
export const MSG_HEADCOUNT_EXEMPTION_INVALID_STATUS_FA =
  "انتقال وضعیت معافیت مجاز نیست.";
export const MSG_HEADCOUNT_EXEMPTION_UNCOVER_FA =
  "لغو معافیت انتصاب را بدون مجوز ظرفیت پوشش‌نداده رها می‌کند؛ تا تعیین تکلیف مسدود است.";
export const MSG_HEADCOUNT_EXEMPTION_INVALID_TREATMENT_FA =
  "نحوه گزارش‌دهی معافیت نامعتبر است.";
export const MSG_HEADCOUNT_EXEMPTION_INVALID_REFS_FA =
  "انتصاب اصلی یا شناسه افراد معافیت نامعتبر است.";
export const MSG_HEADCOUNT_EXEMPTION_OVERLAP_FA =
  "معافیت فعال هم‌پوشان برای این انتصاب اصلی از قبل وجود دارد.";
export const MSG_HEADCOUNT_EXEMPTION_PRIMARY_MISMATCH_FA =
  "انتصاب اصلی به این فرد تعلق ندارد یا یافت نشد.";

export type HeadcountExemptionStatus =
  | "draft"
  | "active"
  | "revoked"
  | "expired";

export type HeadcountReportingTreatment =
  | "exclude_from_used"
  | "count_as_used_exempt"
  | "other";

export type HeadcountExemptionErrorCode =
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_STATUS"
  | "UNCOVER";

export class HeadcountExemptionError extends Error {
  readonly code: HeadcountExemptionErrorCode;
  readonly messageFa: string;

  constructor(
    code: HeadcountExemptionErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "HeadcountExemptionError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export const REPORTING_TREATMENT_LABEL_FA: Record<
  HeadcountReportingTreatment,
  string
> = {
  exclude_from_used: "خارج از مصرف‌شده",
  count_as_used_exempt: "مصرف‌شدهٔ معاف",
  other: "سایر",
};

export const EXEMPTION_STATUS_LABEL_FA: Record<
  HeadcountExemptionStatus,
  string
> = {
  draft: "پیش‌نویس",
  active: "فعال",
  revoked: "لغوشده",
  expired: "منقضی",
};

type Queryable = Pool | PoolClient;

function isPool(db: Queryable): db is Pool {
  return typeof (db as Pool).connect === "function";
}

async function runInTransaction<T>(
  db: Queryable,
  fn: (client: Queryable) => Promise<T>,
): Promise<T> {
  if (!isPool(db)) {
    return fn(db);
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function query<T extends Record<string, unknown>>(
  db: Queryable,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await db.query(sql, params);
  return r.rows as T[];
}

function dateOnlyFromPg(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseValidity(
  startRaw: string,
  endRaw: string,
): { start: string; endExclusive: string } {
  const s = parseDateOnly(startRaw);
  const e = parseDateOnly(endRaw);
  if (!s.ok || !e.ok) {
    throw new HeadcountExemptionError(
      "VALIDATION",
      MSG_HEADCOUNT_EXEMPTION_INVALID_VALIDITY_FA,
      !s.ok ? s.reason : !e.ok ? e.reason : undefined,
    );
  }
  if (e.value <= s.value) {
    throw new HeadcountExemptionError(
      "VALIDATION",
      MSG_HEADCOUNT_EXEMPTION_INVALID_VALIDITY_FA,
      "empty_or_inverted_validity",
    );
  }
  return { start: s.value, endExclusive: e.value };
}

function validityContains(
  start: string,
  endExclusive: string,
  asOf: string,
): boolean {
  return asOf >= start && asOf < endExclusive;
}

export function effectiveExemptionStatus(
  status: HeadcountExemptionStatus,
  validityEndExclusive: string,
  today: string = todayDateOnlyTehran(),
): HeadcountExemptionStatus {
  if (status === "active" && validityEndExclusive <= today) {
    return "expired";
  }
  return status;
}

export type HeadcountExemptionRecord = {
  id: string;
  policyCode: string;
  primaryAssignmentId: string;
  personId: string;
  actorAccountId: string;
  approverAccountId: string;
  reason: string;
  validityStart: string;
  validityEndExclusive: string;
  reportingTreatment: HeadcountReportingTreatment;
  status: HeadcountExemptionStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExemptionRow = {
  id: string;
  policy_code: string;
  primary_assignment_id: string;
  person_id: string;
  actor_account_id: string;
  approver_account_id: string;
  reason: string;
  validity_start: Date | string;
  validity_end_exclusive: Date | string;
  reporting_treatment: string;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapExemption(row: ExemptionRow): HeadcountExemptionRecord {
  const validityEnd = dateOnlyFromPg(row.validity_end_exclusive);
  const stored = row.status as HeadcountExemptionStatus;
  return {
    id: row.id,
    policyCode: row.policy_code,
    primaryAssignmentId: row.primary_assignment_id,
    personId: row.person_id,
    actorAccountId: row.actor_account_id,
    approverAccountId: row.approver_account_id,
    reason: row.reason,
    validityStart: dateOnlyFromPg(row.validity_start),
    validityEndExclusive: validityEnd,
    reportingTreatment: row.reporting_treatment as HeadcountReportingTreatment,
    status: effectiveExemptionStatus(stored, validityEnd),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureHeadcountExemptionSchema(
  db: Queryable,
): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS headcount_exemption (
      id                       UUID PRIMARY KEY,
      policy_code              TEXT NOT NULL,
      primary_assignment_id    TEXT NOT NULL,
      person_id                UUID NOT NULL,
      actor_account_id         TEXT NOT NULL,
      approver_account_id      TEXT NOT NULL,
      reason                   TEXT NOT NULL,
      validity_start           DATE NOT NULL,
      validity_end_exclusive   DATE NOT NULL,
      reporting_treatment      TEXT NOT NULL
                                 CHECK (reporting_treatment IN (
                                   'exclude_from_used',
                                   'count_as_used_exempt',
                                   'other'
                                 )),
      status                   TEXT NOT NULL
                                 CHECK (status IN ('draft', 'active', 'revoked', 'expired')),
      created_by               TEXT,
      updated_by               TEXT,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT headcount_exemption_validity_nonempty
        CHECK (validity_end_exclusive > validity_start)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_exemption_primary_idx
      ON headcount_exemption (primary_assignment_id)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_exemption_person_idx
      ON headcount_exemption (person_id)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_exemption_status_idx
      ON headcount_exemption (status)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_exemption_policy_idx
      ON headcount_exemption (policy_code)
  `);
  // Account ids are cuid TEXT (InternalAccount), not UUID
  await db.query(`
    ALTER TABLE headcount_exemption
      ALTER COLUMN actor_account_id TYPE TEXT USING actor_account_id::text,
      ALTER COLUMN approver_account_id TYPE TEXT USING approver_account_id::text
  `);
}

async function actorHoldsPermission(
  accountId: string,
  permission: string,
  prisma: PrismaClient,
): Promise<boolean> {
  const rows = await prisma.accountAccessRole.findMany({
    where: { accountId },
    include: {
      accessRole: { include: { permissionSet: true } },
    },
  });
  return rows.some((row) =>
    (row.accessRole.permissionSet?.permissions ?? []).includes(permission),
  );
}

export async function assertActorHasHeadcountExemptionRead(
  accountId: string,
  db: PrismaClient,
): Promise<void> {
  const ok = await actorHoldsPermission(
    accountId,
    HEADCOUNT_EXEMPTION_READ_PERMISSION,
    db,
  );
  if (!ok) {
    throw new HeadcountExemptionError(
      "PERMISSION_DENIED",
      MSG_HEADCOUNT_EXEMPTION_PERMISSION_REQUIRED_FA,
      "headcount_exemption_read_required",
    );
  }
}

export async function assertActorHasHeadcountExemptionWrite(
  accountId: string,
  db: PrismaClient,
): Promise<void> {
  const ok = await actorHoldsPermission(
    accountId,
    HEADCOUNT_EXEMPTION_WRITE_PERMISSION,
    db,
  );
  if (!ok) {
    throw new HeadcountExemptionError(
      "PERMISSION_DENIED",
      MSG_HEADCOUNT_EXEMPTION_PERMISSION_REQUIRED_FA,
      "headcount_exemption_write_required",
    );
  }
}

export async function assertActorHasHeadcountMatchReselect(
  accountId: string,
  db: PrismaClient,
): Promise<void> {
  const ok = await actorHoldsPermission(
    accountId,
    HEADCOUNT_MATCH_RESELECT_PERMISSION,
    db,
  );
  if (!ok) {
    throw new HeadcountExemptionError(
      "PERMISSION_DENIED",
      MSG_HEADCOUNT_EXEMPTION_PERMISSION_REQUIRED_FA,
      "headcount_match_reselect_required",
    );
  }
}

const TREATMENTS = new Set<HeadcountReportingTreatment>([
  "exclude_from_used",
  "count_as_used_exempt",
  "other",
]);

async function lockExemptionRow(
  db: Queryable,
  id: string,
): Promise<ExemptionRow | null> {
  const rows = await query<ExemptionRow>(
    db,
    `SELECT id, policy_code, primary_assignment_id, person_id,
            actor_account_id, approver_account_id, reason,
            validity_start, validity_end_exclusive, reporting_treatment,
            status, created_by, updated_by, created_at, updated_at
     FROM headcount_exemption WHERE id = $1::uuid FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

async function getExemptionRow(
  db: Queryable,
  id: string,
): Promise<ExemptionRow | null> {
  const rows = await query<ExemptionRow>(
    db,
    `SELECT id, policy_code, primary_assignment_id, person_id,
            actor_account_id, approver_account_id, reason,
            validity_start, validity_end_exclusive, reporting_treatment,
            status, created_by, updated_by, created_at, updated_at
     FROM headcount_exemption WHERE id = $1::uuid`,
    [id],
  );
  return rows[0] ?? null;
}

export type CreateExemptionInput = {
  policyCode: string;
  primaryAssignmentId: string;
  personId: string;
  actorAccountId: string;
  approverAccountId: string;
  reason: string;
  validityStart: string;
  validityEndExclusive: string;
  reportingTreatment: HeadcountReportingTreatment;
  actorId: string;
};

export async function createExemption(
  db: Queryable,
  input: CreateExemptionInput,
): Promise<HeadcountExemptionRecord> {
  await ensureHeadcountExemptionSchema(db);
  const reason = input.reason.trim();
  if (!reason) {
    throw new HeadcountExemptionError(
      "VALIDATION",
      MSG_HEADCOUNT_EXEMPTION_INVALID_REASON_FA,
    );
  }
  if (!TREATMENTS.has(input.reportingTreatment)) {
    throw new HeadcountExemptionError(
      "VALIDATION",
      MSG_HEADCOUNT_EXEMPTION_INVALID_TREATMENT_FA,
    );
  }
  const validity = parseValidity(
    input.validityStart,
    input.validityEndExclusive,
  );
  const primaryId = input.primaryAssignmentId.trim();
  const personId = input.personId.trim();
  if (!primaryId || !personId) {
    throw new HeadcountExemptionError(
      "VALIDATION",
      MSG_HEADCOUNT_EXEMPTION_INVALID_REFS_FA,
    );
  }

  const id = randomUUID();
  await db.query(
    `INSERT INTO headcount_exemption (
       id, policy_code, primary_assignment_id, person_id,
       actor_account_id, approver_account_id, reason,
       validity_start, validity_end_exclusive, reporting_treatment,
       status, created_by, updated_by
     ) VALUES (
       $1::uuid, $2, $3, $4::uuid, $5, $6, $7,
       $8::date, $9::date, $10, 'draft', $11, $11
     )`,
    [
      id,
      input.policyCode.trim(),
      primaryId,
      personId,
      input.actorAccountId.trim(),
      input.approverAccountId.trim(),
      reason,
      validity.start,
      validity.endExclusive,
      input.reportingTreatment,
      input.actorId,
    ],
  );
  const row = await getExemptionRow(db, id);
  return mapExemption(row!);
}

export async function activateExemption(
  db: Queryable,
  input: { id: string; actorId: string },
): Promise<HeadcountExemptionRecord> {
  await ensureHeadcountExemptionSchema(db);
  return runInTransaction(db, async (tx) => {
    const row = await lockExemptionRow(tx, input.id);
    if (!row) {
      throw new HeadcountExemptionError(
        "NOT_FOUND",
        MSG_HEADCOUNT_EXEMPTION_NOT_FOUND_FA,
      );
    }
    if (row.status !== "draft") {
      throw new HeadcountExemptionError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_EXEMPTION_INVALID_STATUS_FA,
        `from=${row.status}`,
      );
    }
    const validityEnd = dateOnlyFromPg(row.validity_end_exclusive);
    if (validityEnd <= todayDateOnlyTehran()) {
      throw new HeadcountExemptionError(
        "VALIDATION",
        MSG_HEADCOUNT_EXEMPTION_INVALID_VALIDITY_FA,
        "already_ended",
      );
    }
    const overlapping = await findCoveringExemption(tx, {
      primaryAssignmentId: row.primary_assignment_id,
      evaluationDate: todayDateOnlyTehran(),
    });
    if (overlapping && overlapping.id !== row.id) {
      throw new HeadcountExemptionError(
        "VALIDATION",
        MSG_HEADCOUNT_EXEMPTION_OVERLAP_FA,
        "overlapping_active_exemption",
      );
    }
    // Also reject if another active covers any day of this row's validity
    const otherActive = await query<{ id: string }>(
      tx,
      `SELECT id FROM headcount_exemption
       WHERE primary_assignment_id = $1
         AND status = 'active'
         AND id <> $2::uuid
         AND validity_start < $4::date
         AND validity_end_exclusive > $3::date
       LIMIT 1`,
      [
        row.primary_assignment_id,
        row.id,
        dateOnlyFromPg(row.validity_start),
        validityEnd,
      ],
    );
    if (otherActive[0]) {
      throw new HeadcountExemptionError(
        "VALIDATION",
        MSG_HEADCOUNT_EXEMPTION_OVERLAP_FA,
        "overlapping_active_exemption",
      );
    }
    await tx.query(
      `UPDATE headcount_exemption
       SET status = 'active', updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [input.id, input.actorId],
    );
    const updated = await getExemptionRow(tx, input.id);
    return mapExemption(updated!);
  });
}

/**
 * True when an active (soft-expire aware) exemption covers the Primary at date.
 */
export async function findCoveringExemption(
  db: Queryable,
  input: {
    primaryAssignmentId: string;
    evaluationDate: string;
  },
): Promise<HeadcountExemptionRecord | null> {
  await ensureHeadcountExemptionSchema(db);
  const rows = await query<ExemptionRow>(
    db,
    `SELECT id, policy_code, primary_assignment_id, person_id,
            actor_account_id, approver_account_id, reason,
            validity_start, validity_end_exclusive, reporting_treatment,
            status, created_by, updated_by, created_at, updated_at
     FROM headcount_exemption
     WHERE primary_assignment_id = $1
       AND status IN ('draft', 'active', 'expired')
     ORDER BY validity_start ASC, created_at ASC`,
    [input.primaryAssignmentId],
  );
  for (const row of rows) {
    const mapped = mapExemption(row);
    if (mapped.status !== "active") continue;
    if (
      validityContains(
        mapped.validityStart,
        mapped.validityEndExclusive,
        input.evaluationDate,
      )
    ) {
      return mapped;
    }
  }
  return null;
}

export async function assertExemptionCovers(
  db: Queryable,
  input: {
    primaryAssignmentId: string;
    evaluationDate: string;
  },
): Promise<HeadcountExemptionRecord> {
  const hit = await findCoveringExemption(db, input);
  if (!hit) {
    throw new HeadcountExemptionError(
      "NOT_FOUND",
      MSG_HEADCOUNT_EXEMPTION_NOT_FOUND_FA,
      "no_covering_exemption",
    );
  }
  return hit;
}

/**
 * Count active covering exemptions for panel foreshadow (person+team optional).
 */
export async function countActiveExemptionsAsOf(
  db: Queryable,
  input: { evaluationDate: string; personId?: string },
): Promise<number> {
  await ensureHeadcountExemptionSchema(db);
  const today = todayDateOnlyTehran();
  const rows = await query<{ c: string }>(
    db,
    `SELECT COUNT(*)::text AS c
     FROM headcount_exemption
     WHERE status = 'active'
       AND validity_start <= $1::date
       AND validity_end_exclusive > $1::date
       AND validity_end_exclusive > $2::date
       AND ($3::uuid IS NULL OR person_id = $3::uuid)`,
    [input.evaluationDate, today, input.personId?.trim() || null],
  );
  return Number(rows[0]?.c ?? 0);
}

export async function listExemptions(
  db: Queryable,
  filter?: {
    status?: HeadcountExemptionStatus;
    primaryAssignmentId?: string;
    personId?: string;
  },
): Promise<HeadcountExemptionRecord[]> {
  await ensureHeadcountExemptionSchema(db);
  const rows = await query<ExemptionRow>(
    db,
    `SELECT id, policy_code, primary_assignment_id, person_id,
            actor_account_id, approver_account_id, reason,
            validity_start, validity_end_exclusive, reporting_treatment,
            status, created_by, updated_by, created_at, updated_at
     FROM headcount_exemption
     WHERE ($1::text IS NULL OR primary_assignment_id = $1)
       AND ($2::uuid IS NULL OR person_id = $2::uuid)
     ORDER BY created_at DESC`,
    [
      filter?.primaryAssignmentId?.trim() || null,
      filter?.personId?.trim() || null,
    ],
  );
  let mapped = rows.map(mapExemption);
  if (filter?.status) {
    mapped = mapped.filter((r) => r.status === filter.status);
  }
  return mapped;
}

export async function getExemption(
  db: Queryable,
  id: string,
): Promise<HeadcountExemptionRecord> {
  await ensureHeadcountExemptionSchema(db);
  const row = await getExemptionRow(db, id);
  if (!row) {
    throw new HeadcountExemptionError(
      "NOT_FOUND",
      MSG_HEADCOUNT_EXEMPTION_NOT_FOUND_FA,
    );
  }
  return mapExemption(row);
}

/**
 * Revoke fail-closed when Assignment would become uncovered mid-interval
 * without an Approval rebind (same spirit as 4.12 orphan reject).
 *
 * `hasApprovalRebind` / `allowUncover` are trusted server flags only —
 * callers (tRPC) must verify Primary rebound before setting them.
 */
export async function revokeExemption(
  db: Queryable,
  input: {
    id: string;
    actorId: string;
    /** When true, skip uncover check (draft cancel or verified Approval rebind). */
    allowUncover?: boolean;
    /** True only after server verified Primary.headcountApprovalId is set. */
    hasApprovalRebind?: boolean;
  },
): Promise<HeadcountExemptionRecord> {
  await ensureHeadcountExemptionSchema(db);
  return runInTransaction(db, async (tx) => {
    const row = await lockExemptionRow(tx, input.id);
    if (!row) {
      throw new HeadcountExemptionError(
        "NOT_FOUND",
        MSG_HEADCOUNT_EXEMPTION_NOT_FOUND_FA,
      );
    }
    const mapped = mapExemption(row);
    if (mapped.status !== "active" && mapped.status !== "draft") {
      throw new HeadcountExemptionError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_EXEMPTION_INVALID_STATUS_FA,
        `from=${mapped.status}`,
      );
    }
    if (
      mapped.status === "active" &&
      !input.allowUncover &&
      !input.hasApprovalRebind
    ) {
      throw new HeadcountExemptionError(
        "UNCOVER",
        MSG_HEADCOUNT_EXEMPTION_UNCOVER_FA,
      );
    }
    await tx.query(
      `UPDATE headcount_exemption
       SET status = 'revoked', updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [input.id, input.actorId],
    );
    const updated = await getExemptionRow(tx, input.id);
    return mapExemption(updated!);
  });
}

/**
 * Move active covering exemption from source Primary to successor after close+open.
 * Returns the rebound row, or null when nothing covered the source at evaluationDate.
 */
export async function rebindCoveringExemptionToSuccessor(
  db: Queryable,
  input: {
    fromPrimaryAssignmentId: string;
    toPrimaryAssignmentId: string;
    evaluationDate: string;
    actorId: string;
  },
): Promise<HeadcountExemptionRecord | null> {
  await ensureHeadcountExemptionSchema(db);
  const fromId = input.fromPrimaryAssignmentId.trim();
  const toId = input.toPrimaryAssignmentId.trim();
  if (!fromId || !toId || fromId === toId) return null;

  return runInTransaction(db, async (tx) => {
    const covering = await findCoveringExemption(tx, {
      primaryAssignmentId: fromId,
      evaluationDate: input.evaluationDate,
    });
    if (!covering) return null;

    const destOverlap = await findCoveringExemption(tx, {
      primaryAssignmentId: toId,
      evaluationDate: input.evaluationDate,
    });
    if (destOverlap && destOverlap.id !== covering.id) {
      throw new HeadcountExemptionError(
        "VALIDATION",
        MSG_HEADCOUNT_EXEMPTION_OVERLAP_FA,
        "successor_already_covered",
      );
    }

    await tx.query(
      `UPDATE headcount_exemption
       SET primary_assignment_id = $2,
           updated_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid AND status = 'active'`,
      [covering.id, toId, input.actorId],
    );
    const updated = await getExemptionRow(tx, covering.id);
    return updated ? mapExemption(updated) : null;
  });
}
