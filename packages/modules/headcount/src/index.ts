/**
 * Narrow headcount capacity port (Stories 4.5–4.7 / FR-20 / FR-30 / FR-31 boundary).
 * Story 4.12: Approval lifecycle + consume/reserve status gates.
 * NOT Matching matrix, Reservation expiry, or Override catalogue (→ 4.13 / 4.14).
 * Story 4.11: historical ledger reconstruct via reconstructHeadcountQuantitiesAsOf —
 * readHeadcountCapacityPanel remains live/finalize-only (do not use for asOf < today).
 */

export {
  reconstructHeadcountQuantitiesAsOf,
  headcountQuantitiesFactsForCompare,
  HeadcountLedgerError,
  MSG_HEADCOUNT_ASOF_INVALID_FA,
  MSG_HEADCOUNT_LEDGER_AMBIGUOUS_FA,
  MSG_HEADCOUNT_CONSERVATION_FA,
  MSG_HEADCOUNT_MISSING_APPROVAL_FA,
} from "./historical-headcount";

export type {
  ReconstructHeadcountQuantitiesInput,
  ReconstructHeadcountQuantitiesResult,
  HeadcountSlotQuantities,
} from "./historical-headcount";

export {
  HEADCOUNT_APPROVAL_READ_PERMISSION,
  HEADCOUNT_APPROVAL_WRITE_PERMISSION,
  HEADCOUNT_APPROVAL_DATA_CATEGORY,
  HeadcountApprovalError,
  MSG_HEADCOUNT_APPROVAL_PERMISSION_REQUIRED_FA,
  MSG_HEADCOUNT_APPROVAL_NOT_FOUND_FA,
  MSG_HEADCOUNT_APPROVAL_DUPLICATE_CODE_FA,
  MSG_HEADCOUNT_APPROVAL_INVALID_VALIDITY_FA,
  MSG_HEADCOUNT_APPROVAL_INVALID_ALLOWED_FA,
  MSG_HEADCOUNT_APPROVAL_INVALID_REFS_FA,
  MSG_HEADCOUNT_APPROVAL_INVALID_STATUS_FA,
  MSG_HEADCOUNT_APPROVAL_ORPHAN_CLAIMS_FA,
  MSG_HEADCOUNT_APPROVAL_NOT_CONSUMABLE_FA,
  MSG_HEADCOUNT_APPROVAL_IDENTITY_LOCKED_FA,
  APPROVAL_STATUS_LABEL_FA,
  ensureHeadcountApprovalSchema,
  assertActorHasHeadcountApprovalRead,
  assertActorHasHeadcountApprovalWrite,
  createApproval,
  activateApproval,
  updateApproval,
  cancelApproval,
  expireApproval,
  getApproval,
  listApprovals,
  assertSlotApprovalConsumable,
  slotApprovalAllowsConsume,
  effectiveApprovalStatus,
  isApprovalConsumableAt,
} from "./headcount-approval";

export type {
  HeadcountApprovalStatus,
  HeadcountApprovalRecord,
  HeadcountApprovalErrorCode,
  CreateApprovalInput,
  UpdateApprovalInput,
} from "./headcount-approval";

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient, PrismaClient } from "@divan/db";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  assertSlotApprovalConsumable,
  HeadcountApprovalError,
  slotApprovalAllowsConsume,
} from "./headcount-approval";

export const MSG_HEADCOUNT_NO_CAPACITY_FA =
  "ظرفیت نیروی انسانی سازگار برای این انتصاب وجود ندارد؛ بدون Override نهایی‌سازی مجاز نیست.";

export const MSG_HEADCOUNT_PORT_UNAVAILABLE_FA =
  "سامانه ظرفیت نیروی انسانی در دسترس نیست؛ نهایی‌سازی مسدود است.";

export const MSG_HEADCOUNT_CONSUME_FAILED_FA =
  "مصرف ظرفیت نیروی انسانی ناموفق بود؛ نهایی‌سازی مسدود است.";

export const MSG_HEADCOUNT_RELEASE_FAILED_FA =
  "آزادسازی ظرفیت نیروی انسانی ناموفق بود؛ نهایی‌سازی مسدود است.";

export const MSG_HEADCOUNT_RELEASE_AMBIGUOUS_FA =
  "هدف آزادسازی ظرفیت مبهم یا ناموجود است؛ نهایی‌سازی مسدود است.";

export const MSG_HEADCOUNT_RESERVE_FAILED_FA =
  "رزرو ظرفیت نیروی انسانی ناموفق بود؛ نهایی‌سازی مسدود است.";

export const MSG_HEADCOUNT_RESERVATION_RELEASE_FAILED_FA =
  "آزادسازی رزرو ظرفیت نیروی انسانی ناموفق بود.";

export type CapacityCheckInput = {
  teamId: string;
  jobTitleId?: string;
  ladderId?: string;
  gradeId?: string;
  effectiveDate: string;
  /** When set, prefer this slot (Operator/fixture path). */
  preferredSlotId?: string | null;
};

export type CapacityCheckResult =
  | {
      outcome: "compatible";
      slotId: string;
      messageFa: string;
    }
  | {
      outcome: "incompatible";
      messageFa: string;
    }
  | {
      outcome: "unavailable";
      messageFa: string;
    };

export type ConsumeCapacityInput = {
  slotId: string;
  eventId: string;
  personId: string;
  /** Date-only for Approval validity gate; defaults to today (Tehran). */
  evaluationDate?: string;
};

export type ReleaseCapacityInput = {
  /** Termination (or release) business event id — idempotency key. */
  releaseEventId: string;
  personId: string;
  /**
   * Start/Return consume event ids (PrimaryAssignment.sourceEventId) that opened
   * capacity for this Employment. Empty + requireConsumption=false → no-op
   * (fixture-only Employments without event-sourced consume).
   */
  consumeEventIds: string[];
  /**
   * When true (event-sourced Start/Return), missing/ambiguous unreased
   * consumption fails closed. When false, missing consumption is a no-op.
   */
  requireConsumption: boolean;
};

type Queryable = Pool | PoolClient;

async function query<T extends Record<string, unknown>>(
  db: Queryable,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await db.query(sql, params);
  return r.rows as T[];
}

/**
 * Ensure capacity tables exist (idempotent). Call from seed / selfcheck bootstrap.
 */
export async function ensureHeadcountCapacitySchema(
  db: Queryable,
): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS headcount_capacity_slot (
      id              UUID PRIMARY KEY,
      team_id         UUID NOT NULL,
      job_title_id    UUID,
      ladder_id       UUID,
      grade_id        UUID,
      start_date      DATE NOT NULL,
      end_date_exclusive DATE,
      free_units      INTEGER NOT NULL CHECK (free_units >= 0),
      label           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_capacity_slot_team_idx
      ON headcount_capacity_slot (team_id)
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS headcount_capacity_consumption (
      id              UUID PRIMARY KEY,
      slot_id         UUID NOT NULL REFERENCES headcount_capacity_slot(id) ON DELETE RESTRICT,
      event_id        UUID NOT NULL,
      person_id       UUID NOT NULL,
      consumed_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      release_event_id UUID,
      UNIQUE (event_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_capacity_consumption_slot_idx
      ON headcount_capacity_consumption (slot_id)
  `);
  await db.query(`
    ALTER TABLE headcount_capacity_consumption
      ADD COLUMN IF NOT EXISTS release_event_id UUID
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_capacity_consumption_release_event_idx
      ON headcount_capacity_consumption (release_event_id)
      WHERE release_event_id IS NOT NULL
  `);
  await db.query(`
    ALTER TABLE headcount_capacity_slot
      ADD COLUMN IF NOT EXISTS reserved_units INTEGER NOT NULL DEFAULT 0
  `);
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'headcount_capacity_slot_reserved_units_check'
      ) THEN
        ALTER TABLE headcount_capacity_slot
          ADD CONSTRAINT headcount_capacity_slot_reserved_units_check
          CHECK (reserved_units >= 0);
      END IF;
    END $$
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS headcount_capacity_reservation (
      id              UUID PRIMARY KEY,
      slot_id         UUID NOT NULL REFERENCES headcount_capacity_slot(id) ON DELETE RESTRICT,
      event_id        UUID NOT NULL,
      person_id       UUID NOT NULL,
      status          TEXT NOT NULL DEFAULT 'reserved'
                        CHECK (status IN ('reserved', 'released', 'converted')),
      reserved_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (event_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_capacity_reservation_slot_idx
      ON headcount_capacity_reservation (slot_id)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS headcount_capacity_reservation_status_idx
      ON headcount_capacity_reservation (status)
      WHERE status = 'reserved'
  `);
  await db.query(`
    ALTER TABLE headcount_capacity_slot
      ADD COLUMN IF NOT EXISTS approval_id UUID
  `);
}

function slotMatchesRefs(
  row: {
    job_title_id: string | null;
    ladder_id: string | null;
    grade_id: string | null;
  },
  input: CapacityCheckInput,
): boolean {
  if (row.job_title_id && input.jobTitleId && row.job_title_id !== input.jobTitleId) {
    return false;
  }
  if (row.ladder_id && input.ladderId && row.ladder_id !== input.ladderId) {
    return false;
  }
  if (row.grade_id && input.gradeId && row.grade_id !== input.gradeId) {
    return false;
  }
  return true;
}

/**
 * Fail-closed capacity evaluation for Start/Return.
 * Missing DB / query error → unavailable (block; no silent allow).
 */
export async function evaluateHeadcountCapacity(
  db: Queryable,
  input: CapacityCheckInput,
): Promise<CapacityCheckResult> {
  try {
    if (input.preferredSlotId?.trim()) {
      const preferred = await query<{
        id: string;
        team_id: string;
        job_title_id: string | null;
        ladder_id: string | null;
        grade_id: string | null;
        start_date: Date | string;
        end_date_exclusive: Date | string | null;
        free_units: number;
      }>(
        db,
        `SELECT id, team_id, job_title_id, ladder_id, grade_id,
                start_date, end_date_exclusive, free_units
         FROM headcount_capacity_slot
         WHERE id = $1::uuid`,
        [input.preferredSlotId.trim()],
      );
      const slot = preferred[0];
      if (
        slot &&
        slot.team_id === input.teamId &&
        slot.free_units > 0 &&
        slotMatchesRefs(slot, input) &&
        dateInSlot(slot, input.effectiveDate) &&
        (await slotApprovalAllowsConsume(db, slot.id, input.effectiveDate))
      ) {
        return {
          outcome: "compatible",
          slotId: slot.id,
          messageFa: "ظرفیت سازگار یافت شد.",
        };
      }
    }

    const rows = await query<{
      id: string;
      team_id: string;
      job_title_id: string | null;
      ladder_id: string | null;
      grade_id: string | null;
      start_date: Date | string;
      end_date_exclusive: Date | string | null;
      free_units: number;
    }>(
      db,
      `SELECT id, team_id, job_title_id, ladder_id, grade_id,
              start_date, end_date_exclusive, free_units
       FROM headcount_capacity_slot
       WHERE team_id = $1::uuid
         AND free_units > 0
         AND start_date <= $2::date
         AND (end_date_exclusive IS NULL OR end_date_exclusive > $2::date)
       ORDER BY start_date ASC, id ASC`,
      [input.teamId, input.effectiveDate],
    );

    for (const row of rows) {
      if (
        slotMatchesRefs(row, input) &&
        (await slotApprovalAllowsConsume(db, row.id, input.effectiveDate))
      ) {
        return {
          outcome: "compatible",
          slotId: row.id,
          messageFa: "ظرفیت سازگار یافت شد.",
        };
      }
    }

    return {
      outcome: "incompatible",
      messageFa: MSG_HEADCOUNT_NO_CAPACITY_FA,
    };
  } catch {
    return {
      outcome: "unavailable",
      messageFa: MSG_HEADCOUNT_PORT_UNAVAILABLE_FA,
    };
  }
}

function dateOnlyFromPg(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInSlot(
  slot: {
    start_date: Date | string;
    end_date_exclusive: Date | string | null;
  },
  effectiveDate: string,
): boolean {
  const start = dateOnlyFromPg(slot.start_date);
  const end = slot.end_date_exclusive
    ? dateOnlyFromPg(slot.end_date_exclusive)
    : null;
  return effectiveDate >= start && (end === null || effectiveDate < end);
}

/**
 * Consume one free unit and link to authoritative event (same txn as finalize).
 * Idempotent on event_id — retry finalize / recalc replay safe.
 * Locks slot row (FOR UPDATE) so concurrent last-unit consumes cannot both succeed (NFR4).
 */
export async function consumeHeadcountCapacity(
  db: PoolClient,
  input: ConsumeCapacityInput,
): Promise<{ consumed: boolean }> {
  const existing = await query<{ id: string }>(
    db,
    `SELECT id FROM headcount_capacity_consumption WHERE event_id = $1::uuid`,
    [input.eventId],
  );
  if (existing.length > 0) return { consumed: false };

  await db.query(
    `SELECT id FROM headcount_capacity_slot WHERE id = $1::uuid FOR UPDATE`,
    [input.slotId],
  );

  // Approval gate after lock — Draft|Cancelled|Expired|out-of-validity fail-closed.
  await assertSlotApprovalConsumable(
    db,
    input.slotId,
    input.evaluationDate ?? todayDateOnlyTehran(),
  );

  const upd = await db.query(
    `UPDATE headcount_capacity_slot
     SET free_units = free_units - 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid AND free_units > 0
     RETURNING id`,
    [input.slotId],
  );
  if (upd.rowCount === 0) {
    throw new Error(MSG_HEADCOUNT_CONSUME_FAILED_FA);
  }

  await db.query(
    `INSERT INTO headcount_capacity_consumption (id, slot_id, event_id, person_id)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
    [randomUUID(), input.slotId, input.eventId, input.personId],
  );
  return { consumed: true };
}

/**
 * Restore one free unit for consumptions linked to Start/Return event ids.
 * Idempotent on release_event_id — retry finalize / recalc replay safe.
 * Fail-closed when requireConsumption and no unreased row matches.
 */
export async function releaseHeadcountCapacity(
  db: PoolClient,
  input: ReleaseCapacityInput,
): Promise<{ released: boolean; slotId: string | null }> {
  const already = await query<{ id: string; slot_id: string }>(
    db,
    `SELECT id, slot_id FROM headcount_capacity_consumption
     WHERE release_event_id = $1::uuid`,
    [input.releaseEventId],
  );
  if (already.length > 0) {
    return { released: false, slotId: already[0]!.slot_id };
  }

  const consumeIds = input.consumeEventIds
    .map((id) => id.trim())
    .filter(Boolean);
  if (consumeIds.length === 0) {
    if (input.requireConsumption) {
      throw new Error(MSG_HEADCOUNT_RELEASE_AMBIGUOUS_FA);
    }
    return { released: false, slotId: null };
  }

  const rows = await query<{ id: string; slot_id: string; person_id: string }>(
    db,
    `SELECT id, slot_id, person_id FROM headcount_capacity_consumption
     WHERE event_id = ANY($1::uuid[])
       AND release_event_id IS NULL
     ORDER BY consumed_at ASC, id ASC`,
    [consumeIds],
  );

  const forPerson = rows.filter((r) => r.person_id === input.personId);
  if (forPerson.length === 0) {
    if (input.requireConsumption) {
      throw new Error(MSG_HEADCOUNT_RELEASE_AMBIGUOUS_FA);
    }
    return { released: false, slotId: null };
  }

  // Multiple unreased rows (same or different slots) are ambiguous — fail closed.
  // Releasing N rows would over-restore free_units when history left >1 consumption.
  if (forPerson.length > 1) {
    throw new Error(MSG_HEADCOUNT_RELEASE_AMBIGUOUS_FA);
  }

  const row = forPerson[0]!;
  const upd = await db.query(
    `UPDATE headcount_capacity_consumption
     SET release_event_id = $1::uuid
     WHERE id = $2::uuid AND release_event_id IS NULL
     RETURNING id, slot_id`,
    [input.releaseEventId, row.id],
  );
  if (upd.rowCount === 0) {
    // Race: another release claimed it — if ours already set, treat as idempotent
    const mine = await query<{ id: string; slot_id: string }>(
      db,
      `SELECT id, slot_id FROM headcount_capacity_consumption
       WHERE release_event_id = $1::uuid`,
      [input.releaseEventId],
    );
    if (mine.length > 0) {
      return { released: false, slotId: mine[0]!.slot_id };
    }
    throw new Error(MSG_HEADCOUNT_RELEASE_FAILED_FA);
  }

  const slotUpd = await db.query(
    `UPDATE headcount_capacity_slot
     SET free_units = free_units + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid
     RETURNING id`,
    [row.slot_id],
  );
  if (slotUpd.rowCount === 0) {
    await undoHeadcountRelease(db, input.releaseEventId);
    throw new Error(MSG_HEADCOUNT_RELEASE_FAILED_FA);
  }

  return { released: true, slotId: row.slot_id };
}

/**
 * Best-effort undo of a release keyed by release_event_id (orphan compensate).
 */
export async function undoHeadcountRelease(
  db: PoolClient,
  releaseEventId: string,
): Promise<void> {
  try {
    const rows = await query<{ id: string; slot_id: string }>(
      db,
      `SELECT id, slot_id FROM headcount_capacity_consumption
       WHERE release_event_id = $1::uuid`,
      [releaseEventId],
    );
    for (const row of rows) {
      const slotUpd = await db.query(
        `UPDATE headcount_capacity_slot
         SET free_units = GREATEST(free_units - 1, 0),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid AND free_units > 0
         RETURNING id`,
        [row.slot_id],
      );
      // Keep release_event_id until free_units is actually restored — avoid
      // clearing the mark when capacity was already zero (concurrent consume).
      if (slotUpd.rowCount === 0) {
        continue;
      }
      await db.query(
        `UPDATE headcount_capacity_consumption
         SET release_event_id = NULL
         WHERE id = $1::uuid AND release_event_id = $2::uuid`,
        [row.id, releaseEventId],
      );
    }
  } catch {
    // Best-effort; caller rethrows original error
  }
}

export type SeedCapacitySlotInput = {
  teamId: string;
  jobTitleId?: string | null;
  ladderId?: string | null;
  gradeId?: string | null;
  startDate?: string;
  endDateExclusive?: string | null;
  freeUnits?: number;
  label?: string;
  /** Stable id for idempotent seed (optional). */
  id?: string;
};

/**
 * Upsert a demo capacity slot (selfcheck / seed). Returns slot id.
 */
export async function seedCapacitySlot(
  db: Queryable,
  input: SeedCapacitySlotInput,
): Promise<string> {
  await ensureHeadcountCapacitySchema(db);
  const id = input.id?.trim() || randomUUID();
  const start = input.startDate ?? "2020-01-01";
  const free = input.freeUnits ?? 10;

  const existing = await query<{ id: string }>(
    db,
    `SELECT id FROM headcount_capacity_slot WHERE id = $1::uuid`,
    [id],
  );
  if (existing[0]) {
    await db.query(
      `UPDATE headcount_capacity_slot
       SET team_id = $2::uuid,
           job_title_id = $3::uuid,
           ladder_id = $4::uuid,
           grade_id = $5::uuid,
           start_date = $6::date,
           end_date_exclusive = $7::date,
           free_units = GREATEST(free_units, $8::int),
           label = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        id,
        input.teamId,
        input.jobTitleId ?? null,
        input.ladderId ?? null,
        input.gradeId ?? null,
        start,
        input.endDateExclusive ?? null,
        free,
        input.label ?? "demo-capacity",
      ],
    );
    return id;
  }

  await db.query(
    `INSERT INTO headcount_capacity_slot
       (id, team_id, job_title_id, ladder_id, grade_id,
        start_date, end_date_exclusive, free_units, label)
     VALUES
       ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
        $6::date, $7::date, $8::int, $9)`,
    [
      id,
      input.teamId,
      input.jobTitleId ?? null,
      input.ladderId ?? null,
      input.gradeId ?? null,
      start,
      input.endDateExclusive ?? null,
      free,
      input.label ?? "demo-capacity",
    ],
  );
  return id;
}

/**
 * Resolve demo TEAM-DEMO + job refs via Prisma, then seed a generous slot.
 */
export async function seedDemoHeadcountCapacity(
  prisma: PrismaClient,
  pool: Queryable,
): Promise<{ slotId: string; teamId: string }> {
  await ensureHeadcountCapacitySchema(pool);

  const team = await prisma.organizationalUnit.findUnique({
    where: { code: "TEAM-DEMO" },
  });
  const title = await prisma.jobTitle.findUnique({
    where: { code: "JT-HR-SPEC" },
  });
  const ladder = await prisma.ladder.findUnique({
    where: { code: "LAD-DEMO" },
  });
  const grade = ladder
    ? await prisma.grade.findFirst({
        where: { ladderId: ladder.id, code: "G-12" },
      })
    : null;

  if (!team || !title || !ladder || !grade) {
    throw new Error(
      "seedDemoHeadcountCapacity: TEAM-DEMO / job-ref fixtures missing — seed org+job first",
    );
  }

  // Stable demo slot id (namespace uuid from team) — regenerable across seeds.
  const slotId = await seedCapacitySlot(pool, {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001",
    teamId: team.id,
    jobTitleId: title.id,
    ladderId: ladder.id,
    gradeId: grade.id,
    startDate: "2020-01-01",
    freeUnits: 50,
    label: "demo-start-return-capacity",
  });

  return { slotId, teamId: team.id };
}

export type ReserveCapacityInput = {
  slotId: string;
  eventId: string;
  personId: string;
  /** Date-only for Approval validity gate; defaults to today (Tehran). */
  evaluationDate?: string;
};

/**
 * Reserve one free unit for a Scheduled Transfer (FR-30).
 * Idempotent on event_id. Locks slot FOR UPDATE (NFR4).
 */
export async function reserveHeadcountCapacity(
  db: PoolClient,
  input: ReserveCapacityInput,
): Promise<{ reserved: boolean; slotId: string }> {
  const existing = await query<{ id: string; slot_id: string; status: string }>(
    db,
    `SELECT id, slot_id, status FROM headcount_capacity_reservation
     WHERE event_id = $1::uuid`,
    [input.eventId],
  );
  if (existing[0]) {
    if (existing[0].status === "reserved" || existing[0].status === "converted") {
      return { reserved: false, slotId: existing[0].slot_id };
    }
    // previously released — re-reserve below (rare Cancel-then-re-finalize with same event id impossible)
  }

  await db.query(
    `SELECT id FROM headcount_capacity_slot WHERE id = $1::uuid FOR UPDATE`,
    [input.slotId],
  );

  await assertSlotApprovalConsumable(
    db,
    input.slotId,
    input.evaluationDate ?? todayDateOnlyTehran(),
  );

  const upd = await db.query(
    `UPDATE headcount_capacity_slot
     SET free_units = free_units - 1,
         reserved_units = reserved_units + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid AND free_units > 0
     RETURNING id`,
    [input.slotId],
  );
  if (upd.rowCount === 0) {
    throw new Error(MSG_HEADCOUNT_RESERVE_FAILED_FA);
  }

  if (existing[0]?.status === "released") {
    await db.query(
      `UPDATE headcount_capacity_reservation
       SET status = 'reserved',
           slot_id = $2::uuid,
           person_id = $3::uuid,
           updated_at = CURRENT_TIMESTAMP
       WHERE event_id = $1::uuid`,
      [input.eventId, input.slotId, input.personId],
    );
  } else {
    await db.query(
      `INSERT INTO headcount_capacity_reservation
         (id, slot_id, event_id, person_id, status)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'reserved')`,
      [randomUUID(), input.slotId, input.eventId, input.personId],
    );
  }

  return { reserved: true, slotId: input.slotId };
}

/**
 * Release a Transfer reservation (Cancel of Scheduled Transfer).
 * Idempotent on event_id — already released / converted → no-op or fail closed for converted.
 */
export async function releaseHeadcountReservation(
  db: PoolClient,
  eventId: string,
): Promise<{ released: boolean; slotId: string | null }> {
  const rows = await query<{
    id: string;
    slot_id: string;
    status: string;
  }>(
    db,
    `SELECT id, slot_id, status FROM headcount_capacity_reservation
     WHERE event_id = $1::uuid`,
    [eventId],
  );
  const row = rows[0];
  if (!row) {
    return { released: false, slotId: null };
  }
  if (row.status === "released") {
    return { released: false, slotId: row.slot_id };
  }
  if (row.status === "converted") {
    // Already consumed — Cancel of post-effect Transfer is Reverse path, not reservation release
    return { released: false, slotId: row.slot_id };
  }

  await db.query(
    `SELECT id FROM headcount_capacity_slot WHERE id = $1::uuid FOR UPDATE`,
    [row.slot_id],
  );

  const mark = await db.query(
    `UPDATE headcount_capacity_reservation
     SET status = 'released', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid AND status = 'reserved'
     RETURNING id`,
    [row.id],
  );
  if (mark.rowCount === 0) {
    return { released: false, slotId: row.slot_id };
  }

  const slotUpd = await db.query(
    `UPDATE headcount_capacity_slot
     SET free_units = free_units + 1,
         reserved_units = GREATEST(reserved_units - 1, 0),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid
     RETURNING id`,
    [row.slot_id],
  );
  if (slotUpd.rowCount === 0) {
    throw new Error(MSG_HEADCOUNT_RESERVATION_RELEASE_FAILED_FA);
  }

  return { released: true, slotId: row.slot_id };
}

/**
 * Convert an active reservation into a consumption (Effective Transfer after Scheduled reserve).
 * Idempotent: already converted / already has consumption for event_id → no-op.
 */
export async function convertReservationToConsumption(
  db: PoolClient,
  input: { eventId: string; personId: string },
): Promise<{ converted: boolean; slotId: string | null }> {
  const consumption = await query<{ id: string; slot_id: string }>(
    db,
    `SELECT id, slot_id FROM headcount_capacity_consumption WHERE event_id = $1::uuid`,
    [input.eventId],
  );
  if (consumption[0]) {
    return { converted: false, slotId: consumption[0].slot_id };
  }

  const rows = await query<{
    id: string;
    slot_id: string;
    status: string;
  }>(
    db,
    `SELECT id, slot_id, status FROM headcount_capacity_reservation
     WHERE event_id = $1::uuid`,
    [input.eventId],
  );
  const row = rows[0];
  if (!row || row.status !== "reserved") {
    return { converted: false, slotId: row?.slot_id ?? null };
  }

  await db.query(
    `SELECT id FROM headcount_capacity_slot WHERE id = $1::uuid FOR UPDATE`,
    [row.slot_id],
  );

  const mark = await db.query(
    `UPDATE headcount_capacity_reservation
     SET status = 'converted', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid AND status = 'reserved'
     RETURNING id`,
    [row.id],
  );
  if (mark.rowCount === 0) {
    const again = await query<{ id: string; slot_id: string }>(
      db,
      `SELECT id, slot_id FROM headcount_capacity_consumption WHERE event_id = $1::uuid`,
      [input.eventId],
    );
    if (again[0]) return { converted: false, slotId: again[0].slot_id };
    throw new Error(MSG_HEADCOUNT_RESERVE_FAILED_FA);
  }

  await db.query(
    `UPDATE headcount_capacity_slot
     SET reserved_units = GREATEST(reserved_units - 1, 0),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid`,
    [row.slot_id],
  );

  await db.query(
    `INSERT INTO headcount_capacity_consumption (id, slot_id, event_id, person_id)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
    [randomUUID(), row.slot_id, input.eventId, input.personId],
  );

  return { converted: true, slotId: row.slot_id };
}

/**
 * Best-effort undo of destination capacity taken by Transfer event_id
 * (fresh consume or converted reservation).
 */
export async function undoTransferDestinationCapacity(
  db: PoolClient,
  eventId: string,
): Promise<void> {
  try {
    const consumption = await query<{ id: string; slot_id: string }>(
      db,
      `SELECT id, slot_id FROM headcount_capacity_consumption
       WHERE event_id = $1::uuid AND release_event_id IS NULL`,
      [eventId],
    );
    const c = consumption[0];
    if (!c) return;

    const reservation = await query<{ id: string; status: string }>(
      db,
      `SELECT id, status FROM headcount_capacity_reservation WHERE event_id = $1::uuid`,
      [eventId],
    );
    const wasConverted = reservation[0]?.status === "converted";

    await db.query(
      `SELECT id FROM headcount_capacity_slot WHERE id = $1::uuid FOR UPDATE`,
      [c.slot_id],
    );

    await db.query(
      `DELETE FROM headcount_capacity_consumption WHERE id = $1::uuid`,
      [c.id],
    );

    if (wasConverted) {
      await db.query(
        `UPDATE headcount_capacity_slot
         SET reserved_units = reserved_units + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid`,
        [c.slot_id],
      );
      await db.query(
        `UPDATE headcount_capacity_reservation
         SET status = 'reserved', updated_at = CURRENT_TIMESTAMP
         WHERE event_id = $1::uuid`,
        [eventId],
      );
    } else {
      await db.query(
        `UPDATE headcount_capacity_slot
         SET free_units = free_units + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid`,
        [c.slot_id],
      );
    }
  } catch {
    // Best-effort
  }
}

export type CapacityPanelInput = {
  teamId: string;
  jobTitleId?: string;
  ladderId?: string;
  gradeId?: string;
  effectiveDate: string;
  preferredSlotId?: string | null;
};

export type CapacityPanelResult = {
  used: number;
  reserved: number;
  free: number;
  slotId: string | null;
};

/**
 * Aggregate used / reserved / free for destination Team(+title) panel (UX-DR13).
 */
export async function readHeadcountCapacityPanel(
  db: Queryable,
  input: CapacityPanelInput,
): Promise<CapacityPanelResult> {
  await ensureHeadcountCapacitySchema(db);

  let slotId: string | null = null;
  let free = 0;
  let reserved = 0;

  if (input.preferredSlotId?.trim()) {
    const preferred = await query<{
      id: string;
      team_id: string;
      job_title_id: string | null;
      ladder_id: string | null;
      grade_id: string | null;
      start_date: Date | string;
      end_date_exclusive: Date | string | null;
      free_units: number;
      reserved_units: number;
    }>(
      db,
      `SELECT id, team_id, job_title_id, ladder_id, grade_id,
              start_date, end_date_exclusive, free_units, reserved_units
       FROM headcount_capacity_slot
       WHERE id = $1::uuid`,
      [input.preferredSlotId.trim()],
    );
    const slot = preferred[0];
    if (
      slot &&
      slot.team_id === input.teamId &&
      slotMatchesRefs(slot, input) &&
      dateInSlot(slot, input.effectiveDate)
    ) {
      slotId = slot.id;
      free = Number(slot.free_units);
      reserved = Number(slot.reserved_units);
    }
  }

  if (!slotId) {
    const rows = await query<{
      id: string;
      job_title_id: string | null;
      ladder_id: string | null;
      grade_id: string | null;
      free_units: number;
      reserved_units: number;
    }>(
      db,
      `SELECT id, job_title_id, ladder_id, grade_id, free_units, reserved_units
       FROM headcount_capacity_slot
       WHERE team_id = $1::uuid
         AND start_date <= $2::date
         AND (end_date_exclusive IS NULL OR end_date_exclusive > $2::date)
       ORDER BY start_date ASC, id ASC`,
      [input.teamId, input.effectiveDate],
    );
    for (const row of rows) {
      if (slotMatchesRefs(row, input)) {
        slotId = row.id;
        free = Number(row.free_units);
        reserved = Number(row.reserved_units);
        break;
      }
    }
  }

  let used = 0;
  if (slotId) {
    const usedRows = await query<{ c: string }>(
      db,
      `SELECT COUNT(*)::text AS c FROM headcount_capacity_consumption
       WHERE slot_id = $1::uuid AND release_event_id IS NULL`,
      [slotId],
    );
    used = Number(usedRows[0]?.c ?? 0);
  }

  return { used, reserved, free, slotId };
}

