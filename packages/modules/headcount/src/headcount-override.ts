/**
 * Headcount Override catalogue (Story 4.14 / FR-32).
 * Explicit rule violation with audit; free may go negative.
 * Does NOT overload Exemption (coverage without consume).
 */

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient, PrismaClient } from "@divan/db";

export const HEADCOUNT_OVERRIDE_READ_PERMISSION = "headcount.override.read";
export const HEADCOUNT_OVERRIDE_WRITE_PERMISSION = "headcount.override.write";
export const HEADCOUNT_OVERRIDE_DATA_CATEGORY =
  "organization.headcount_override";

export const MSG_HEADCOUNT_OVERRIDE_PERMISSION_REQUIRED_FA = "دسترسی ندارید.";
export const MSG_HEADCOUNT_OVERRIDE_NOT_FOUND_FA = "لغو محدودیت ظرفیت یافت نشد.";
export const MSG_HEADCOUNT_OVERRIDE_INVALID_REASON_FA =
  "دلیل لغو محدودیت الزامی است.";
export const MSG_HEADCOUNT_OVERRIDE_INVALID_RULE_FA =
  "قاعدة نقض‌شده نامعتبر است.";
export const MSG_HEADCOUNT_OVERRIDE_INVALID_STATUS_FA =
  "انتقال وضعیت لغو محدودیت مجاز نیست.";
export const MSG_HEADCOUNT_OVERRIDE_INVALID_REFS_FA =
  "مراجع تیم/عنوان شغلی برای لغو محدودیت نامعتبر است.";
export const MSG_HEADCOUNT_OVERRIDE_CONSUME_FAILED_FA =
  "مصرف ظرفیت با لغو محدودیت ناموفق بود.";
export const MSG_HEADCOUNT_OVERRIDE_RESERVE_FAILED_FA =
  "رزرو ظرفیت با لغو محدودیت ناموفق بود.";
export const MSG_HEADCOUNT_OVERRIDE_VOID_LINKED_CLAIM_FA =
  "لغو محدودیت با claim فعال (مصرف یا رزرو) باطل نمی‌شود؛ ابتدا رویداد را لغو/تصحیح کنید.";

export type HeadcountViolatedRule =
  | "shortage"
  | "validity"
  | "job_title"
  | "seniority";

export type HeadcountOverrideStatus = "active" | "superseded" | "voided";

export type HeadcountOverrideErrorCode =
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_STATUS";

export class HeadcountOverrideError extends Error {
  readonly code: HeadcountOverrideErrorCode;
  readonly messageFa: string;

  constructor(
    code: HeadcountOverrideErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "HeadcountOverrideError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export const VIOLATED_RULE_LABEL_FA: Record<HeadcountViolatedRule, string> = {
  shortage: "کمبود ظرفیت",
  validity: "اعتبار مجوز",
  job_title: "عنوان شغلی",
  seniority: "ارشدیت",
};

export const OVERRIDE_STATUS_LABEL_FA: Record<HeadcountOverrideStatus, string> =
  {
    active: "فعال",
    superseded: "جایگزین‌شده",
    voided: "باطل",
  };

export type CapacitySnapshot = {
  used: number;
  reserved: number;
  freeBefore: number;
  freeAfter: number;
  approved?: number | null;
};

export type HeadcountOverrideRecord = {
  id: string;
  violatedRule: HeadcountViolatedRule;
  reason: string;
  actorAccountId: string;
  relatedEventId: string | null;
  relatedAssignmentId: string | null;
  teamId: string;
  jobTitleId: string;
  seniorityId: string | null;
  approvalId: string | null;
  slotId: string | null;
  capacitySnapshot: CapacitySnapshot;
  status: HeadcountOverrideStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Queryable = Pool | PoolClient;

type OverrideRow = {
  id: string;
  violated_rule: string;
  reason: string;
  actor_account_id: string;
  related_event_id: string | null;
  related_assignment_id: string | null;
  team_id: string;
  job_title_id: string;
  seniority_id: string | null;
  approval_id: string | null;
  slot_id: string | null;
  capacity_snapshot: CapacitySnapshot | string;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

const RULES = new Set<HeadcountViolatedRule>([
  "shortage",
  "validity",
  "job_title",
  "seniority",
]);

function isPool(db: Queryable): db is Pool {
  // PoolClient also has connect(); prefer release() as the client discriminator.
  return (
    typeof (db as Pool).connect === "function" &&
    typeof (db as { release?: unknown }).release !== "function"
  );
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

function parseSnapshot(
  raw: CapacitySnapshot | string,
): CapacitySnapshot {
  if (typeof raw === "string") {
    return JSON.parse(raw) as CapacitySnapshot;
  }
  return raw;
}

function mapOverride(row: OverrideRow): HeadcountOverrideRecord {
  return {
    id: row.id,
    violatedRule: row.violated_rule as HeadcountViolatedRule,
    reason: row.reason,
    actorAccountId: row.actor_account_id,
    relatedEventId: row.related_event_id,
    relatedAssignmentId: row.related_assignment_id,
    teamId: row.team_id,
    jobTitleId: row.job_title_id,
    seniorityId: row.seniority_id,
    approvalId: row.approval_id,
    slotId: row.slot_id,
    capacitySnapshot: parseSnapshot(row.capacity_snapshot),
    status: row.status as HeadcountOverrideStatus,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Ensure override table + drop free_units >= 0 check (idempotent).
 */
export async function ensureHeadcountOverrideSchema(
  db: Queryable,
): Promise<void> {
  await db.query(`
    ALTER TABLE headcount_capacity_slot
      DROP CONSTRAINT IF EXISTS headcount_capacity_slot_free_units_check
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS headcount_override (
      id                       UUID PRIMARY KEY,
      violated_rule            TEXT NOT NULL
                                 CHECK (violated_rule IN (
                                   'shortage',
                                   'validity',
                                   'job_title',
                                   'seniority'
                                 )),
      reason                   TEXT NOT NULL,
      actor_account_id         TEXT NOT NULL,
      related_event_id         UUID,
      related_assignment_id    TEXT,
      team_id                  TEXT NOT NULL,
      job_title_id             TEXT NOT NULL,
      seniority_id             TEXT,
      approval_id              UUID,
      slot_id                  UUID,
      capacity_snapshot        JSONB NOT NULL,
      status                   TEXT NOT NULL
                                 CHECK (status IN ('active', 'superseded', 'voided')),
      created_by               TEXT,
      updated_by               TEXT,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_override_status_idx
      ON headcount_override (status)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_override_team_idx
      ON headcount_override (team_id)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_override_rule_idx
      ON headcount_override (violated_rule)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_override_event_idx
      ON headcount_override (related_event_id)
      WHERE related_event_id IS NOT NULL
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_override_slot_idx
      ON headcount_override (slot_id)
      WHERE slot_id IS NOT NULL
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

export async function assertActorHasHeadcountOverrideRead(
  accountId: string,
  db: PrismaClient,
): Promise<void> {
  const ok = await actorHoldsPermission(
    accountId,
    HEADCOUNT_OVERRIDE_READ_PERMISSION,
    db,
  );
  if (!ok) {
    throw new HeadcountOverrideError(
      "PERMISSION_DENIED",
      MSG_HEADCOUNT_OVERRIDE_PERMISSION_REQUIRED_FA,
      "headcount_override_read_required",
    );
  }
}

export async function assertActorHasHeadcountOverrideWrite(
  accountId: string,
  db: PrismaClient,
): Promise<void> {
  const ok = await actorHoldsPermission(
    accountId,
    HEADCOUNT_OVERRIDE_WRITE_PERMISSION,
    db,
  );
  if (!ok) {
    throw new HeadcountOverrideError(
      "PERMISSION_DENIED",
      MSG_HEADCOUNT_OVERRIDE_PERMISSION_REQUIRED_FA,
      "headcount_override_write_required",
    );
  }
}

async function getOverrideRow(
  db: Queryable,
  id: string,
): Promise<OverrideRow | null> {
  const rows = await query<OverrideRow>(
    db,
    `SELECT id, violated_rule, reason, actor_account_id,
            related_event_id, related_assignment_id,
            team_id, job_title_id, seniority_id,
            approval_id, slot_id, capacity_snapshot, status,
            created_by, updated_by, created_at, updated_at
     FROM headcount_override WHERE id = $1::uuid`,
    [id],
  );
  return rows[0] ?? null;
}

export type CreateOverrideInput = {
  violatedRule: HeadcountViolatedRule;
  reason: string;
  actorAccountId: string;
  teamId: string;
  jobTitleId: string;
  seniorityId?: string | null;
  approvalId?: string | null;
  slotId?: string | null;
  relatedEventId?: string | null;
  relatedAssignmentId?: string | null;
  capacitySnapshot: CapacitySnapshot;
  actorId: string;
};

export async function createOverride(
  db: Queryable,
  input: CreateOverrideInput,
): Promise<HeadcountOverrideRecord> {
  await ensureHeadcountOverrideSchema(db);
  const reason = input.reason.trim();
  if (!reason) {
    throw new HeadcountOverrideError(
      "VALIDATION",
      MSG_HEADCOUNT_OVERRIDE_INVALID_REASON_FA,
    );
  }
  if (!RULES.has(input.violatedRule)) {
    throw new HeadcountOverrideError(
      "VALIDATION",
      MSG_HEADCOUNT_OVERRIDE_INVALID_RULE_FA,
    );
  }
  const teamId = input.teamId.trim();
  const jobTitleId = input.jobTitleId.trim();
  if (!teamId || !jobTitleId) {
    throw new HeadcountOverrideError(
      "VALIDATION",
      MSG_HEADCOUNT_OVERRIDE_INVALID_REFS_FA,
    );
  }

  const id = randomUUID();
  await db.query(
    `INSERT INTO headcount_override (
       id, violated_rule, reason, actor_account_id,
       related_event_id, related_assignment_id,
       team_id, job_title_id, seniority_id,
       approval_id, slot_id, capacity_snapshot, status,
       created_by, updated_by
     ) VALUES (
       $1::uuid, $2, $3, $4,
       $5::uuid, $6, $7, $8, $9,
       $10::uuid, $11::uuid, $12::jsonb, 'active', $13, $13
     )`,
    [
      id,
      input.violatedRule,
      reason,
      input.actorAccountId.trim(),
      input.relatedEventId?.trim() || null,
      input.relatedAssignmentId?.trim() || null,
      teamId,
      jobTitleId,
      input.seniorityId?.trim() || null,
      input.approvalId?.trim() || null,
      input.slotId?.trim() || null,
      JSON.stringify(input.capacitySnapshot),
      input.actorId,
    ],
  );
  const row = await getOverrideRow(db, id);
  return mapOverride(row!);
}

export async function getOverride(
  db: Queryable,
  id: string,
): Promise<HeadcountOverrideRecord | null> {
  await ensureHeadcountOverrideSchema(db);
  const row = await getOverrideRow(db, id);
  return row ? mapOverride(row) : null;
}

export type ListOverridesFilter = {
  status?: HeadcountOverrideStatus | null;
  violatedRule?: HeadcountViolatedRule | null;
  teamId?: string | null;
  slotId?: string | null;
  relatedEventId?: string | null;
  limit?: number;
};

export async function listOverrides(
  db: Queryable,
  filter: ListOverridesFilter = {},
): Promise<HeadcountOverrideRecord[]> {
  await ensureHeadcountOverrideSchema(db);
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (filter.status) {
    clauses.push(`status = $${i++}`);
    params.push(filter.status);
  }
  if (filter.violatedRule) {
    clauses.push(`violated_rule = $${i++}`);
    params.push(filter.violatedRule);
  }
  if (filter.teamId?.trim()) {
    clauses.push(`team_id = $${i++}`);
    params.push(filter.teamId.trim());
  }
  if (filter.slotId?.trim()) {
    clauses.push(`slot_id = $${i++}::uuid`);
    params.push(filter.slotId.trim());
  }
  if (filter.relatedEventId?.trim()) {
    clauses.push(`related_event_id = $${i++}::uuid`);
    params.push(filter.relatedEventId.trim());
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  params.push(limit);
  const rows = await query<OverrideRow>(
    db,
    `SELECT id, violated_rule, reason, actor_account_id,
            related_event_id, related_assignment_id,
            team_id, job_title_id, seniority_id,
            approval_id, slot_id, capacity_snapshot, status,
            created_by, updated_by, created_at, updated_at
     FROM headcount_override
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${i}`,
    params,
  );
  return rows.map(mapOverride);
}

export async function countActiveOverridesForSlot(
  db: Queryable,
  slotId: string,
): Promise<number> {
  await ensureHeadcountOverrideSchema(db);
  const rows = await query<{ c: string }>(
    db,
    `SELECT COUNT(*)::text AS c FROM headcount_override
     WHERE slot_id = $1::uuid AND status = 'active'`,
    [slotId],
  );
  return Number(rows[0]?.c ?? 0);
}

export async function voidOverride(
  db: Queryable,
  input: { id: string; actorId: string },
): Promise<HeadcountOverrideRecord> {
  await ensureHeadcountOverrideSchema(db);
  return runInTransaction(db, async (tx) => {
    const rows = await query<OverrideRow>(
      tx,
      `SELECT id, violated_rule, reason, actor_account_id,
              related_event_id, related_assignment_id,
              team_id, job_title_id, seniority_id,
              approval_id, slot_id, capacity_snapshot, status,
              created_by, updated_by, created_at, updated_at
       FROM headcount_override WHERE id = $1::uuid FOR UPDATE`,
      [input.id],
    );
    const row = rows[0];
    if (!row) {
      throw new HeadcountOverrideError(
        "NOT_FOUND",
        MSG_HEADCOUNT_OVERRIDE_NOT_FOUND_FA,
      );
    }
    if (row.status !== "active") {
      throw new HeadcountOverrideError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_OVERRIDE_INVALID_STATUS_FA,
        `from=${row.status}`,
      );
    }
    // Fail-closed: do not void while a linked capacity claim is still live
    // (catalogue-only void would lie about governing Override vs ledger).
    if (row.related_event_id) {
      const linked = await query<{ kind: string }>(
        tx,
        `SELECT 'consumption' AS kind FROM headcount_capacity_consumption
         WHERE event_id = $1::uuid AND release_event_id IS NULL
         UNION ALL
         SELECT 'reservation' AS kind FROM headcount_capacity_reservation
         WHERE event_id = $1::uuid AND status = 'reserved'
         LIMIT 1`,
        [row.related_event_id],
      );
      if (linked.length > 0) {
        throw new HeadcountOverrideError(
          "INVALID_STATUS",
          MSG_HEADCOUNT_OVERRIDE_VOID_LINKED_CLAIM_FA,
          `linked=${linked[0]?.kind}`,
        );
      }
    }
    await tx.query(
      `UPDATE headcount_override
       SET status = 'voided', updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [input.id, input.actorId],
    );
    const updated = await getOverrideRow(tx, input.id);
    return mapOverride(updated!);
  });
}

export type OverrideMutateContext = {
  violatedRule: HeadcountViolatedRule;
  reason: string;
  actorAccountId: string;
  teamId: string;
  jobTitleId: string;
  seniorityId?: string | null;
  approvalId?: string | null;
  relatedAssignmentId?: string | null;
  /** Skip Approval consumable gate (validity Override). */
  skipApprovalGate?: boolean;
};
