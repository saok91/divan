/**
 * Headcount Approval lifecycle (Story 4.12 / FR-28).
 * Draft → Active → Cancelled|Expired; gates block new consume/reserve on non-active.
 * Does NOT invent AR-HEADCOUNT disposition, Matching, exemptions, or Override.
 */

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient, PrismaClient } from "@divan/db";
import { parseDateOnly, todayDateOnlyTehran } from "@divan/temporal-engine";

export const HEADCOUNT_APPROVAL_READ_PERMISSION = "headcount.approval.read";
export const HEADCOUNT_APPROVAL_WRITE_PERMISSION = "headcount.approval.write";
export const HEADCOUNT_APPROVAL_DATA_CATEGORY = "organization.headcount_approval";

export const MSG_HEADCOUNT_APPROVAL_PERMISSION_REQUIRED_FA = "دسترسی ندارید.";
export const MSG_HEADCOUNT_APPROVAL_NOT_FOUND_FA = "مجوز ظرفیت یافت نشد.";
export const MSG_HEADCOUNT_APPROVAL_DUPLICATE_CODE_FA =
  "کد نیازمندی تکراری است.";
export const MSG_HEADCOUNT_APPROVAL_INVALID_VALIDITY_FA =
  "بازه اعتبار نامعتبر یا خالی است.";
export const MSG_HEADCOUNT_APPROVAL_INVALID_ALLOWED_FA =
  "سقف مجاز باید عدد صحیح غیرمنفی باشد.";
export const MSG_HEADCOUNT_APPROVAL_INVALID_REFS_FA =
  "تیم، عنوان شغلی یا ارشدیت نامعتبر است.";
export const MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA =
  "انتقال وضعیت مجوز ظرفیت مجاز نیست.";
export const MSG_HEADCOUNT_APPROVAL_ORPHAN_CLAIMS_FA =
  "مجوز ظرفیت دارای مصرف یا رزرو فعال است؛ تا تعیین تکلیف AR-HEADCOUNT قابل تغییر/لغو/کاهش نیست.";
export const MSG_HEADCOUNT_APPROVAL_NOT_CONSUMABLE_FA =
  "مجوز ظرفیت در وضعیت قابل مصرف نیست؛ رزرو یا مصرف جدید مجاز نیست.";
export const MSG_HEADCOUNT_APPROVAL_IDENTITY_LOCKED_FA =
  "تغییر هویت مجوز ظرفیت با ادعای فعال مجاز نیست.";

export type HeadcountApprovalStatus =
  | "draft"
  | "active"
  | "cancelled"
  | "expired";

export type HeadcountApprovalErrorCode =
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "DUPLICATE_CODE"
  | "VALIDATION"
  | "INVALID_STATUS"
  | "ORPHAN_CLAIMS"
  | "IDENTITY_LOCKED"
  | "NOT_CONSUMABLE";

export class HeadcountApprovalError extends Error {
  readonly code: HeadcountApprovalErrorCode;
  readonly messageFa: string;

  constructor(
    code: HeadcountApprovalErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "HeadcountApprovalError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

type Queryable = Pool | PoolClient;

function isPool(db: Queryable): db is Pool {
  return typeof (db as Pool).connect === "function";
}

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "23505"
  );
}

/** Run fn in a transaction when `db` is a Pool; reuse client when already transactional. */
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

async function lockApprovalRow(
  db: Queryable,
  id: string,
): Promise<ApprovalRow | null> {
  const rows = await query<ApprovalRow>(
    db,
    `SELECT id, requirement_code, team_id, job_title_id, seniority_id,
            allowed_count, validity_start, validity_end_exclusive, status,
            approval_reference, owner_account_id, created_by, updated_by,
            created_at, updated_at
     FROM headcount_approval WHERE id = $1::uuid FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

function dateOnlyFromPg(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type HeadcountApprovalRecord = {
  id: string;
  requirementCode: string;
  teamId: string;
  jobTitleId: string;
  seniorityId: string | null;
  allowedCount: number;
  validityStart: string;
  validityEndExclusive: string;
  status: HeadcountApprovalStatus;
  approvalReference: string | null;
  ownerAccountId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  slotId: string | null;
  used: number;
  reserved: number;
  free: number;
};

type ApprovalRow = {
  id: string;
  requirement_code: string;
  team_id: string;
  job_title_id: string;
  seniority_id: string | null;
  allowed_count: number;
  validity_start: Date | string;
  validity_end_exclusive: Date | string;
  status: string;
  approval_reference: string | null;
  owner_account_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

/** Ensure Approval + slot.approval_id schema (idempotent). Capacity tables must exist. */
export async function ensureHeadcountApprovalSchema(
  db: Queryable,
): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS headcount_approval (
      id                       UUID PRIMARY KEY,
      requirement_code         TEXT NOT NULL,
      team_id                  UUID NOT NULL,
      job_title_id             UUID NOT NULL,
      seniority_id             UUID,
      allowed_count            INTEGER NOT NULL CHECK (allowed_count >= 0),
      validity_start           DATE NOT NULL,
      validity_end_exclusive   DATE NOT NULL,
      status                   TEXT NOT NULL
                                 CHECK (status IN ('draft', 'active', 'cancelled', 'expired')),
      approval_reference       TEXT,
      owner_account_id         UUID,
      created_by               TEXT,
      updated_by               TEXT,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT headcount_approval_validity_nonempty
        CHECK (validity_end_exclusive > validity_start)
    )
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS headcount_approval_requirement_code_uidx
      ON headcount_approval (requirement_code)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_approval_team_idx
      ON headcount_approval (team_id)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_approval_status_idx
      ON headcount_approval (status)
  `);
  await db.query(`
    ALTER TABLE headcount_capacity_slot
      ADD COLUMN IF NOT EXISTS approval_id UUID
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS headcount_capacity_slot_approval_uidx
      ON headcount_capacity_slot (approval_id)
      WHERE approval_id IS NOT NULL
  `);
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'headcount_capacity_slot_approval_id_fkey'
      ) THEN
        ALTER TABLE headcount_capacity_slot
          ADD CONSTRAINT headcount_capacity_slot_approval_id_fkey
          FOREIGN KEY (approval_id) REFERENCES headcount_approval(id) ON DELETE RESTRICT;
      END IF;
    END $$
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

export async function assertActorHasHeadcountApprovalRead(
  accountId: string,
  prisma: PrismaClient,
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    HEADCOUNT_APPROVAL_READ_PERMISSION,
    prisma,
  );
  if (!has) {
    throw new HeadcountApprovalError(
      "PERMISSION_DENIED",
      MSG_HEADCOUNT_APPROVAL_PERMISSION_REQUIRED_FA,
      "headcount_approval_read_required",
    );
  }
}

export async function assertActorHasHeadcountApprovalWrite(
  accountId: string,
  prisma: PrismaClient,
): Promise<void> {
  const has = await actorHoldsPermission(
    accountId,
    HEADCOUNT_APPROVAL_WRITE_PERMISSION,
    prisma,
  );
  if (!has) {
    throw new HeadcountApprovalError(
      "PERMISSION_DENIED",
      MSG_HEADCOUNT_APPROVAL_PERMISSION_REQUIRED_FA,
      "headcount_approval_write_required",
    );
  }
}

function parseValidity(
  start: string,
  endExclusive: string,
): { start: string; endExclusive: string } {
  const s = parseDateOnly(start);
  const e = parseDateOnly(endExclusive);
  if (!s.ok || !e.ok) {
    throw new HeadcountApprovalError(
      "VALIDATION",
      MSG_HEADCOUNT_APPROVAL_INVALID_VALIDITY_FA,
      !s.ok ? s.reason : !e.ok ? e.reason : undefined,
    );
  }
  if (e.value <= s.value) {
    throw new HeadcountApprovalError(
      "VALIDATION",
      MSG_HEADCOUNT_APPROVAL_INVALID_VALIDITY_FA,
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

/** Natural expiry when validity_end ≤ today even if row still `active`. */
export function effectiveApprovalStatus(
  status: HeadcountApprovalStatus,
  validityEndExclusive: string,
  today: string = todayDateOnlyTehran(),
): HeadcountApprovalStatus {
  if (status === "active" && validityEndExclusive <= today) {
    return "expired";
  }
  return status;
}

export function isApprovalConsumableAt(
  status: HeadcountApprovalStatus,
  validityStart: string,
  validityEndExclusive: string,
  evaluationDate: string,
  today: string = todayDateOnlyTehran(),
): boolean {
  const gate = effectiveApprovalStatus(status, validityEndExclusive, today);
  if (gate !== "active") return false;
  return validityContains(validityStart, validityEndExclusive, evaluationDate);
}

async function validateRefs(
  db: Queryable,
  input: {
    teamId: string;
    jobTitleId: string;
    seniorityId?: string | null;
  },
): Promise<void> {
  const team = await query<{ id: string; unitType: string }>(
    db,
    `SELECT id, "unitType" FROM "OrganizationalUnit" WHERE id = $1`,
    [input.teamId],
  );
  if (!team[0] || team[0].unitType !== "TEAM") {
    throw new HeadcountApprovalError(
      "VALIDATION",
      MSG_HEADCOUNT_APPROVAL_INVALID_REFS_FA,
      "invalid_team",
    );
  }
  const title = await query<{ id: string }>(
    db,
    `SELECT id FROM "JobTitle" WHERE id = $1`,
    [input.jobTitleId],
  );
  if (!title[0]) {
    throw new HeadcountApprovalError(
      "VALIDATION",
      MSG_HEADCOUNT_APPROVAL_INVALID_REFS_FA,
      "invalid_job_title",
    );
  }
  if (input.seniorityId?.trim()) {
    const sen = await query<{ id: string }>(
      db,
      `SELECT id FROM "Seniority" WHERE id = $1`,
      [input.seniorityId.trim()],
    );
    if (!sen[0]) {
      throw new HeadcountApprovalError(
        "VALIDATION",
        MSG_HEADCOUNT_APPROVAL_INVALID_REFS_FA,
        "invalid_seniority",
      );
    }
  }
}

async function loadSlotClaims(
  db: Queryable,
  slotId: string,
): Promise<{ used: number; reserved: number; free: number }> {
  const slot = await query<{
    free_units: number;
    reserved_units: number;
  }>(
    db,
    `SELECT free_units, reserved_units FROM headcount_capacity_slot WHERE id = $1::uuid`,
    [slotId],
  );
  if (!slot[0]) {
    return { used: 0, reserved: 0, free: 0 };
  }
  const usedRows = await query<{ c: string }>(
    db,
    `SELECT COUNT(*)::text AS c FROM headcount_capacity_consumption
     WHERE slot_id = $1::uuid AND release_event_id IS NULL`,
    [slotId],
  );
  return {
    used: Number(usedRows[0]?.c ?? 0),
    reserved: Number(slot[0].reserved_units),
    free: Number(slot[0].free_units),
  };
}

async function mapApproval(
  db: Queryable,
  row: ApprovalRow,
): Promise<HeadcountApprovalRecord> {
  const slotRows = await query<{ id: string }>(
    db,
    `SELECT id FROM headcount_capacity_slot WHERE approval_id = $1::uuid`,
    [row.id],
  );
  const slotId = slotRows[0]?.id ?? null;
  let used = 0;
  let reserved = 0;
  let free = Number(row.allowed_count);
  if (slotId) {
    const claims = await loadSlotClaims(db, slotId);
    used = claims.used;
    reserved = claims.reserved;
    free = claims.free;
  }
  const validityEnd = dateOnlyFromPg(row.validity_end_exclusive);
  const status = effectiveApprovalStatus(
    row.status as HeadcountApprovalStatus,
    validityEnd,
  );
  return {
    id: row.id,
    requirementCode: row.requirement_code,
    teamId: row.team_id,
    jobTitleId: row.job_title_id,
    seniorityId: row.seniority_id,
    allowedCount: Number(row.allowed_count),
    validityStart: dateOnlyFromPg(row.validity_start),
    validityEndExclusive: validityEnd,
    status,
    approvalReference: row.approval_reference,
    ownerAccountId: row.owner_account_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slotId,
    used,
    reserved,
    free,
  };
}

async function getApprovalRow(
  db: Queryable,
  id: string,
): Promise<ApprovalRow | null> {
  const rows = await query<ApprovalRow>(
    db,
    `SELECT id, requirement_code, team_id, job_title_id, seniority_id,
            allowed_count, validity_start, validity_end_exclusive, status,
            approval_reference, owner_account_id, created_by, updated_by,
            created_at, updated_at
     FROM headcount_approval WHERE id = $1::uuid`,
    [id],
  );
  return rows[0] ?? null;
}

export type CreateApprovalInput = {
  requirementCode: string;
  teamId: string;
  jobTitleId: string;
  seniorityId?: string | null;
  allowedCount: number;
  validityStart: string;
  validityEndExclusive: string;
  approvalReference?: string | null;
  ownerAccountId?: string | null;
  actorId: string;
};

export async function createApproval(
  db: Queryable,
  input: CreateApprovalInput,
): Promise<HeadcountApprovalRecord> {
  await ensureHeadcountApprovalSchema(db);
  const code = input.requirementCode.trim();
  if (!code) {
    throw new HeadcountApprovalError(
      "VALIDATION",
      MSG_HEADCOUNT_APPROVAL_INVALID_REFS_FA,
      "empty_requirement_code",
    );
  }
  if (!Number.isInteger(input.allowedCount) || input.allowedCount < 0) {
    throw new HeadcountApprovalError(
      "VALIDATION",
      MSG_HEADCOUNT_APPROVAL_INVALID_ALLOWED_FA,
    );
  }
  const validity = parseValidity(
    input.validityStart,
    input.validityEndExclusive,
  );
  await validateRefs(db, {
    teamId: input.teamId,
    jobTitleId: input.jobTitleId,
    seniorityId: input.seniorityId,
  });

  const dup = await query<{ id: string }>(
    db,
    `SELECT id FROM headcount_approval WHERE requirement_code = $1`,
    [code],
  );
  if (dup[0]) {
    throw new HeadcountApprovalError(
      "DUPLICATE_CODE",
      MSG_HEADCOUNT_APPROVAL_DUPLICATE_CODE_FA,
    );
  }

  const id = randomUUID();
  try {
    await db.query(
      `INSERT INTO headcount_approval (
         id, requirement_code, team_id, job_title_id, seniority_id,
         allowed_count, validity_start, validity_end_exclusive, status,
         approval_reference, owner_account_id, created_by, updated_by
       ) VALUES (
         $1::uuid, $2, $3::uuid, $4::uuid, $5::uuid,
         $6::int, $7::date, $8::date, 'draft',
         $9, $10::uuid, $11, $11
       )`,
      [
        id,
        code,
        input.teamId,
        input.jobTitleId,
        input.seniorityId?.trim() || null,
        input.allowedCount,
        validity.start,
        validity.endExclusive,
        input.approvalReference?.trim() || null,
        input.ownerAccountId?.trim() || null,
        input.actorId,
      ],
    );
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new HeadcountApprovalError(
        "DUPLICATE_CODE",
        MSG_HEADCOUNT_APPROVAL_DUPLICATE_CODE_FA,
      );
    }
    throw err;
  }
  const row = await getApprovalRow(db, id);
  return mapApproval(db, row!);
}

async function syncSlotCeiling(
  db: Queryable,
  slotId: string,
  allowedCount: number,
): Promise<void> {
  await db.query(
    `SELECT id FROM headcount_capacity_slot WHERE id = $1::uuid FOR UPDATE`,
    [slotId],
  );
  const claims = await loadSlotClaims(db, slotId);
  const claimed = claims.used + claims.reserved;
  if (allowedCount < claimed) {
    throw new HeadcountApprovalError(
      "ORPHAN_CLAIMS",
      MSG_HEADCOUNT_APPROVAL_ORPHAN_CLAIMS_FA,
      `allowed=${allowedCount};claimed=${claimed}`,
    );
  }
  const free = allowedCount - claimed;
  await db.query(
    `UPDATE headcount_capacity_slot
     SET free_units = $2::int,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid`,
    [slotId, free],
  );
}

export async function activateApproval(
  db: Queryable,
  input: { id: string; actorId: string },
): Promise<HeadcountApprovalRecord> {
  await ensureHeadcountApprovalSchema(db);
  return runInTransaction(db, async (tx) => {
    const row = await lockApprovalRow(tx, input.id);
    if (!row) {
      throw new HeadcountApprovalError(
        "NOT_FOUND",
        MSG_HEADCOUNT_APPROVAL_NOT_FOUND_FA,
      );
    }
    if (row.status !== "draft") {
      throw new HeadcountApprovalError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA,
        `from=${row.status}`,
      );
    }
    const validityEnd = dateOnlyFromPg(row.validity_end_exclusive);
    const today = todayDateOnlyTehran();
    if (validityEnd <= today) {
      throw new HeadcountApprovalError(
        "VALIDATION",
        MSG_HEADCOUNT_APPROVAL_INVALID_VALIDITY_FA,
        "cannot_activate_already_elapsed",
      );
    }

    const existingSlot = await query<{ id: string }>(
      tx,
      `SELECT id FROM headcount_capacity_slot WHERE approval_id = $1::uuid FOR UPDATE`,
      [row.id],
    );

    let slotId = existingSlot[0]?.id;
    if (!slotId) {
      slotId = randomUUID();
      try {
        await tx.query(
          `INSERT INTO headcount_capacity_slot
             (id, team_id, job_title_id, ladder_id, grade_id,
              start_date, end_date_exclusive, free_units, reserved_units, label, approval_id)
           VALUES
             ($1::uuid, $2::uuid, $3::uuid, NULL, NULL,
              $4::date, $5::date, $6::int, 0, $7, $8::uuid)`,
          [
            slotId,
            row.team_id,
            row.job_title_id,
            dateOnlyFromPg(row.validity_start),
            validityEnd,
            Number(row.allowed_count),
            `approval:${row.requirement_code}`,
            row.id,
          ],
        );
      } catch (err) {
        if (isPgUniqueViolation(err)) {
          const raced = await query<{ id: string }>(
            tx,
            `SELECT id FROM headcount_capacity_slot WHERE approval_id = $1::uuid`,
            [row.id],
          );
          if (!raced[0]) throw err;
          slotId = raced[0].id;
          await syncSlotCeiling(tx, slotId, Number(row.allowed_count));
        } else {
          throw err;
        }
      }
    } else {
      await syncSlotCeiling(tx, slotId, Number(row.allowed_count));
      await tx.query(
        `UPDATE headcount_capacity_slot
         SET team_id = $2::uuid,
             job_title_id = $3::uuid,
             start_date = $4::date,
             end_date_exclusive = $5::date,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid`,
        [
          slotId,
          row.team_id,
          row.job_title_id,
          dateOnlyFromPg(row.validity_start),
          validityEnd,
        ],
      );
    }

    const upd = await tx.query(
      `UPDATE headcount_approval
       SET status = 'active',
           updated_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid AND status = 'draft'
       RETURNING id`,
      [row.id, input.actorId],
    );
    if (upd.rowCount !== 1) {
      throw new HeadcountApprovalError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA,
        "activate_race",
      );
    }

    const updated = await getApprovalRow(tx, row.id);
    return mapApproval(tx, updated!);
  });
}

export type UpdateApprovalInput = {
  id: string;
  actorId: string;
  requirementCode?: string;
  teamId?: string;
  jobTitleId?: string;
  seniorityId?: string | null;
  allowedCount?: number;
  validityStart?: string;
  validityEndExclusive?: string;
  approvalReference?: string | null;
};

export async function updateApproval(
  db: Queryable,
  input: UpdateApprovalInput,
): Promise<HeadcountApprovalRecord> {
  await ensureHeadcountApprovalSchema(db);
  return runInTransaction(db, async (tx) => {
    const row = await lockApprovalRow(tx, input.id);
    if (!row) {
      throw new HeadcountApprovalError(
        "NOT_FOUND",
        MSG_HEADCOUNT_APPROVAL_NOT_FOUND_FA,
      );
    }
    if (row.status !== "draft" && row.status !== "active") {
      throw new HeadcountApprovalError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA,
        `update_from=${row.status}`,
      );
    }

    const slotRows = await query<{ id: string }>(
      tx,
      `SELECT id FROM headcount_capacity_slot WHERE approval_id = $1::uuid FOR UPDATE`,
      [row.id],
    );
    const slotId = slotRows[0]?.id ?? null;
    const claims = slotId
      ? await loadSlotClaims(tx, slotId)
      : { used: 0, reserved: 0, free: 0 };
    const hasClaims = claims.used + claims.reserved > 0;

    const nextCode = input.requirementCode?.trim() ?? row.requirement_code;
    const nextTeam = input.teamId ?? row.team_id;
    const nextTitle = input.jobTitleId ?? row.job_title_id;
    const nextSeniority =
      input.seniorityId !== undefined
        ? input.seniorityId?.trim() || null
        : row.seniority_id;
    const nextAllowed =
      input.allowedCount !== undefined
        ? input.allowedCount
        : Number(row.allowed_count);
    const nextStart =
      input.validityStart !== undefined
        ? input.validityStart
        : dateOnlyFromPg(row.validity_start);
    const nextEnd =
      input.validityEndExclusive !== undefined
        ? input.validityEndExclusive
        : dateOnlyFromPg(row.validity_end_exclusive);
    const nextRef =
      input.approvalReference !== undefined
        ? input.approvalReference?.trim() || null
        : row.approval_reference;

    if (!Number.isInteger(nextAllowed) || nextAllowed < 0) {
      throw new HeadcountApprovalError(
        "VALIDATION",
        MSG_HEADCOUNT_APPROVAL_INVALID_ALLOWED_FA,
      );
    }
    const validity = parseValidity(nextStart, nextEnd);

    if (row.status === "active" && hasClaims) {
      const identityChanged =
        nextCode !== row.requirement_code ||
        nextTeam !== row.team_id ||
        nextTitle !== row.job_title_id ||
        nextSeniority !== row.seniority_id;
      if (identityChanged) {
        throw new HeadcountApprovalError(
          "IDENTITY_LOCKED",
          MSG_HEADCOUNT_APPROVAL_IDENTITY_LOCKED_FA,
        );
      }
      if (nextAllowed < claims.used + claims.reserved) {
        throw new HeadcountApprovalError(
          "ORPHAN_CLAIMS",
          MSG_HEADCOUNT_APPROVAL_ORPHAN_CLAIMS_FA,
          "reduce_with_claims",
        );
      }
      const oldStart = dateOnlyFromPg(row.validity_start);
      const oldEnd = dateOnlyFromPg(row.validity_end_exclusive);
      if (validity.start > oldStart || validity.endExclusive < oldEnd) {
        throw new HeadcountApprovalError(
          "ORPHAN_CLAIMS",
          MSG_HEADCOUNT_APPROVAL_ORPHAN_CLAIMS_FA,
          "validity_shrink_with_claims",
        );
      }
    }

    await validateRefs(tx, {
      teamId: nextTeam,
      jobTitleId: nextTitle,
      seniorityId: nextSeniority,
    });

    if (nextCode !== row.requirement_code) {
      const dup = await query<{ id: string }>(
        tx,
        `SELECT id FROM headcount_approval WHERE requirement_code = $1 AND id <> $2::uuid`,
        [nextCode, row.id],
      );
      if (dup[0]) {
        throw new HeadcountApprovalError(
          "DUPLICATE_CODE",
          MSG_HEADCOUNT_APPROVAL_DUPLICATE_CODE_FA,
        );
      }
    }

    let upd;
    try {
      upd = await tx.query(
        `UPDATE headcount_approval
         SET requirement_code = $2,
             team_id = $3::uuid,
             job_title_id = $4::uuid,
             seniority_id = $5::uuid,
             allowed_count = $6::int,
             validity_start = $7::date,
             validity_end_exclusive = $8::date,
             approval_reference = $9,
             updated_by = $10,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid AND status IN ('draft', 'active')
         RETURNING id`,
        [
          row.id,
          nextCode,
          nextTeam,
          nextTitle,
          nextSeniority,
          nextAllowed,
          validity.start,
          validity.endExclusive,
          nextRef,
          input.actorId,
        ],
      );
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        throw new HeadcountApprovalError(
          "DUPLICATE_CODE",
          MSG_HEADCOUNT_APPROVAL_DUPLICATE_CODE_FA,
        );
      }
      throw err;
    }
    if (upd.rowCount !== 1) {
      throw new HeadcountApprovalError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA,
        "update_race",
      );
    }

    if (slotId && row.status === "active") {
      await syncSlotCeiling(tx, slotId, nextAllowed);
      await tx.query(
        `UPDATE headcount_capacity_slot
         SET team_id = $2::uuid,
             job_title_id = $3::uuid,
             start_date = $4::date,
             end_date_exclusive = $5::date,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid`,
        [slotId, nextTeam, nextTitle, validity.start, validity.endExclusive],
      );
    }

    const updated = await getApprovalRow(tx, row.id);
    return mapApproval(tx, updated!);
  });
}

async function assertNoActiveClaims(
  db: Queryable,
  approvalId: string,
): Promise<void> {
  const slotRows = await query<{ id: string }>(
    db,
    `SELECT id FROM headcount_capacity_slot WHERE approval_id = $1::uuid`,
    [approvalId],
  );
  const slotId = slotRows[0]?.id;
  if (!slotId) return;
  const claims = await loadSlotClaims(db, slotId);
  if (claims.used + claims.reserved > 0) {
    throw new HeadcountApprovalError(
      "ORPHAN_CLAIMS",
      MSG_HEADCOUNT_APPROVAL_ORPHAN_CLAIMS_FA,
    );
  }
}

export async function cancelApproval(
  db: Queryable,
  input: { id: string; actorId: string },
): Promise<HeadcountApprovalRecord> {
  await ensureHeadcountApprovalSchema(db);
  return runInTransaction(db, async (tx) => {
    const row = await lockApprovalRow(tx, input.id);
    if (!row) {
      throw new HeadcountApprovalError(
        "NOT_FOUND",
        MSG_HEADCOUNT_APPROVAL_NOT_FOUND_FA,
      );
    }
    if (row.status !== "draft" && row.status !== "active") {
      throw new HeadcountApprovalError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA,
        `cancel_from=${row.status}`,
      );
    }
    await assertNoActiveClaims(tx, row.id);

    const upd = await tx.query(
      `UPDATE headcount_approval
       SET status = 'cancelled',
           updated_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid AND status IN ('draft', 'active')
       RETURNING id`,
      [row.id, input.actorId],
    );
    if (upd.rowCount !== 1) {
      throw new HeadcountApprovalError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA,
        "cancel_race",
      );
    }
    const updated = await getApprovalRow(tx, row.id);
    return mapApproval(tx, updated!);
  });
}

export async function expireApproval(
  db: Queryable,
  input: { id: string; actorId: string },
): Promise<HeadcountApprovalRecord> {
  await ensureHeadcountApprovalSchema(db);
  return runInTransaction(db, async (tx) => {
    const row = await lockApprovalRow(tx, input.id);
    if (!row) {
      throw new HeadcountApprovalError(
        "NOT_FOUND",
        MSG_HEADCOUNT_APPROVAL_NOT_FOUND_FA,
      );
    }
    if (row.status !== "active") {
      throw new HeadcountApprovalError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA,
        `expire_from=${row.status}`,
      );
    }
    await assertNoActiveClaims(tx, row.id);

    const upd = await tx.query(
      `UPDATE headcount_approval
       SET status = 'expired',
           updated_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid AND status = 'active'
       RETURNING id`,
      [row.id, input.actorId],
    );
    if (upd.rowCount !== 1) {
      throw new HeadcountApprovalError(
        "INVALID_STATUS",
        MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA,
        "expire_race",
      );
    }
    const updated = await getApprovalRow(tx, row.id);
    return mapApproval(tx, updated!);
  });
}

export async function getApproval(
  db: Queryable,
  id: string,
): Promise<HeadcountApprovalRecord | null> {
  await ensureHeadcountApprovalSchema(db);
  const row = await getApprovalRow(db, id);
  if (!row) return null;
  return mapApproval(db, row);
}

export async function listApprovals(
  db: Queryable,
  opts?: { status?: HeadcountApprovalStatus; teamId?: string },
): Promise<HeadcountApprovalRecord[]> {
  await ensureHeadcountApprovalSchema(db);
  const params: unknown[] = [];
  let sql = `
    SELECT id, requirement_code, team_id, job_title_id, seniority_id,
           allowed_count, validity_start, validity_end_exclusive, status,
           approval_reference, owner_account_id, created_by, updated_by,
           created_at, updated_at
    FROM headcount_approval WHERE 1=1`;
  if (opts?.teamId?.trim()) {
    params.push(opts.teamId.trim());
    sql += ` AND team_id = $${params.length}::uuid`;
  }
  // Soft-expire: SQL prefilter; mapApproval applies effectiveApprovalStatus.
  if (opts?.status === "active") {
    const today = todayDateOnlyTehran();
    params.push(today);
    sql += ` AND status = 'active' AND validity_end_exclusive > $${params.length}::date`;
  } else if (opts?.status === "expired") {
    const today = todayDateOnlyTehran();
    params.push(today);
    sql += ` AND (status = 'expired' OR (status = 'active' AND validity_end_exclusive <= $${params.length}::date))`;
  } else if (opts?.status) {
    params.push(opts.status);
    sql += ` AND status = $${params.length}`;
  }
  sql += ` ORDER BY created_at DESC, requirement_code ASC`;
  const rows = await query<ApprovalRow>(db, sql, params);
  const out: HeadcountApprovalRecord[] = [];
  for (const row of rows) {
    out.push(await mapApproval(db, row));
  }
  if (!opts?.status) return out;
  return out.filter((r) => r.status === opts.status);
}

/**
 * Gate for evaluate/reserve/consume when slot has approval_id.
 * Legacy fixture slots (approval_id NULL) pass through.
 */
export async function assertSlotApprovalConsumable(
  db: Queryable,
  slotId: string,
  evaluationDate: string,
): Promise<void> {
  const slots = await query<{
    approval_id: string | null;
  }>(
    db,
    `SELECT approval_id FROM headcount_capacity_slot WHERE id = $1::uuid`,
    [slotId],
  );
  const slot = slots[0];
  if (!slot?.approval_id) return;

  const row = await getApprovalRow(db, slot.approval_id);
  if (!row) {
    throw new HeadcountApprovalError(
      "NOT_CONSUMABLE",
      MSG_HEADCOUNT_APPROVAL_NOT_CONSUMABLE_FA,
      "missing_approval",
    );
  }
  const start = dateOnlyFromPg(row.validity_start);
  const end = dateOnlyFromPg(row.validity_end_exclusive);
  if (
    !isApprovalConsumableAt(
      row.status as HeadcountApprovalStatus,
      start,
      end,
      evaluationDate,
    )
  ) {
    throw new HeadcountApprovalError(
      "NOT_CONSUMABLE",
      MSG_HEADCOUNT_APPROVAL_NOT_CONSUMABLE_FA,
      `status=${row.status};eval=${evaluationDate}`,
    );
  }
}

export async function slotApprovalAllowsConsume(
  db: Queryable,
  slotId: string,
  evaluationDate: string,
): Promise<boolean> {
  try {
    await assertSlotApprovalConsumable(db, slotId, evaluationDate);
    return true;
  } catch (err) {
    if (err instanceof HeadcountApprovalError) return false;
    throw err;
  }
}

export const APPROVAL_STATUS_LABEL_FA: Record<HeadcountApprovalStatus, string> =
  {
    draft: "پیش‌نویس",
    active: "فعال",
    cancelled: "لغوشده",
    expired: "منقضی",
  };
