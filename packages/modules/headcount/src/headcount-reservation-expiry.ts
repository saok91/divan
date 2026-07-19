/**
 * Reservation expiry horizon + Scheduled-exception helpers (Story 4.14 / FR-30).
 * AR-HEADCOUNT: N=14 day warning; do not invent escalation owners.
 */

import type { Pool, PoolClient } from "@divan/db";
import { parseDateOnly, todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  effectiveApprovalStatus,
  isApprovalConsumableAt,
  type HeadcountApprovalStatus,
} from "./headcount-approval";

/** AR-HEADCOUNT may retune N — keep as named constant. */
export const HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS = 14;

export const MSG_HEADCOUNT_APPROVAL_EXPIRY_SOON_FA =
  "اعتبار مجوز ظرفیت متصل به رزرو تا ۱۴ روز دیگر به پایان می‌رسد؛ پیش از اعمال اثر رسیدگی کنید.";

export const MSG_HEADCOUNT_SCHEDULED_EXCEPTION_FA =
  "رویداد زمان‌بندی‌شده در وضعیت استثناست؛ تا تعیین تکلیف ممیزی‌شده اعمال جزئی Employment/انتصاب/ظرفیت مجاز نیست.";

export const HEADCOUNT_APPROVAL_EXPIRY_SOON = "HEADCOUNT_APPROVAL_EXPIRY_SOON";
export const HEADCOUNT_SCHEDULED_EXCEPTION = "HEADCOUNT_SCHEDULED_EXCEPTION";

export type HeadcountExceptionMarker = {
  code: string;
  detectedAt: string;
  approvalId?: string | null;
  messageFa: string;
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

function dateOnlyFromPg(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * True when Approval validity end is within N days (inclusive horizon)
 * and Approval is still consumable today (not already expired).
 */
export function isApprovalExpiryWithinWarningHorizon(
  validityEndExclusive: string,
  opts: {
    today?: string;
    warningDays?: number;
  } = {},
): boolean {
  const today = opts.today ?? todayDateOnlyTehran();
  const n = opts.warningDays ?? HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS;
  const endParsed = parseDateOnly(validityEndExclusive);
  if (!endParsed.ok) return false;
  // Already ended or ending today → not "soon" warning (exception path elsewhere)
  if (endParsed.value <= today) return false;
  const horizon = addDays(today, n);
  // validity_end_exclusive - today <= N  ⇔  endExclusive <= today+N
  return endParsed.value <= horizon;
}

export type ReservationExpiryCheckInput = {
  approvalId: string;
  evaluationDate?: string;
  today?: string;
  warningDays?: number;
};

export type ReservationExpiryCheckResult =
  | { atRisk: false }
  | {
      atRisk: true;
      approvalId: string;
      validityEndExclusive: string;
      messageFa: string;
      code: typeof HEADCOUNT_APPROVAL_EXPIRY_SOON;
    };

/**
 * Load Approval and evaluate 14-day expiry warning for an active Reservation.
 */
export async function checkReservationApprovalExpiryWarning(
  db: Queryable,
  input: ReservationExpiryCheckInput,
): Promise<ReservationExpiryCheckResult> {
  const today = input.today ?? todayDateOnlyTehran();
  const evaluationDate = input.evaluationDate ?? today;
  const rows = await query<{
    id: string;
    status: string;
    validity_start: Date | string;
    validity_end_exclusive: Date | string;
  }>(
    db,
    `SELECT id, status, validity_start, validity_end_exclusive
     FROM headcount_approval WHERE id = $1::uuid`,
    [input.approvalId],
  );
  const row = rows[0];
  if (!row) return { atRisk: false };

  const validityStart = dateOnlyFromPg(row.validity_start);
  const validityEnd = dateOnlyFromPg(row.validity_end_exclusive);
  const status = effectiveApprovalStatus(
    row.status as HeadcountApprovalStatus,
    validityEnd,
    today,
  );

  // Must still be consumable today — already expired → exception, not soon-warn
  if (
    !isApprovalConsumableAt(
      status,
      validityStart,
      validityEnd,
      evaluationDate,
      today,
    )
  ) {
    return { atRisk: false };
  }

  if (
    !isApprovalExpiryWithinWarningHorizon(validityEnd, {
      today,
      warningDays: input.warningDays,
    })
  ) {
    return { atRisk: false };
  }

  return {
    atRisk: true,
    approvalId: row.id,
    validityEndExclusive: validityEnd,
    messageFa: MSG_HEADCOUNT_APPROVAL_EXPIRY_SOON_FA,
    code: HEADCOUNT_APPROVAL_EXPIRY_SOON,
  };
}

export type ScheduledExceptionDetectInput = {
  approvalId?: string | null;
  slotId?: string | null;
  evaluationDate: string;
  today?: string;
  /** Optional dims to verify Approval still matches Assignment successor. */
  teamId?: string | null;
  jobTitleId?: string | null;
  seniorityId?: string | null;
};

export type ScheduledExceptionDetectResult =
  | { exception: false }
  | {
      exception: true;
      marker: HeadcountExceptionMarker;
    };

/**
 * Detect Approval expiry / incompatibility before effect — fail-closed.
 * Does not mutate; caller persists marker + blocks apply.
 */
export async function detectScheduledHeadcountException(
  db: Queryable,
  input: ScheduledExceptionDetectInput,
): Promise<ScheduledExceptionDetectResult> {
  const today = input.today ?? todayDateOnlyTehran();
  const detectedAt = new Date().toISOString();

  if (!input.approvalId?.trim() && !input.slotId?.trim()) {
    return {
      exception: true,
      marker: {
        code: HEADCOUNT_SCHEDULED_EXCEPTION,
        detectedAt,
        messageFa: MSG_HEADCOUNT_SCHEDULED_EXCEPTION_FA,
      },
    };
  }

  let approvalId = input.approvalId?.trim() || null;
  if (!approvalId && input.slotId?.trim()) {
    const bridge = await query<{ approval_id: string | null }>(
      db,
      `SELECT approval_id FROM headcount_capacity_slot WHERE id = $1::uuid`,
      [input.slotId.trim()],
    );
    approvalId = bridge[0]?.approval_id ?? null;
  }

  if (!approvalId) {
    // Legacy slot without Approval — no expiry exception product path
    return { exception: false };
  }

  const rows = await query<{
    id: string;
    status: string;
    team_id: string;
    job_title_id: string;
    seniority_id: string | null;
    validity_start: Date | string;
    validity_end_exclusive: Date | string;
  }>(
    db,
    `SELECT id, status, team_id, job_title_id, seniority_id,
            validity_start, validity_end_exclusive
     FROM headcount_approval WHERE id = $1::uuid`,
    [approvalId],
  );
  const row = rows[0];
  if (!row) {
    return {
      exception: true,
      marker: {
        code: HEADCOUNT_SCHEDULED_EXCEPTION,
        detectedAt,
        approvalId,
        messageFa: MSG_HEADCOUNT_SCHEDULED_EXCEPTION_FA,
      },
    };
  }

  const validityStart = dateOnlyFromPg(row.validity_start);
  const validityEnd = dateOnlyFromPg(row.validity_end_exclusive);
  const status = effectiveApprovalStatus(
    row.status as HeadcountApprovalStatus,
    validityEnd,
    today,
  );

  if (
    !isApprovalConsumableAt(
      status,
      validityStart,
      validityEnd,
      input.evaluationDate,
      today,
    )
  ) {
    return {
      exception: true,
      marker: {
        code: HEADCOUNT_SCHEDULED_EXCEPTION,
        detectedAt,
        approvalId: row.id,
        messageFa: MSG_HEADCOUNT_SCHEDULED_EXCEPTION_FA,
      },
    };
  }

  if (input.teamId?.trim() && row.team_id !== input.teamId.trim()) {
    return {
      exception: true,
      marker: {
        code: HEADCOUNT_SCHEDULED_EXCEPTION,
        detectedAt,
        approvalId: row.id,
        messageFa: MSG_HEADCOUNT_SCHEDULED_EXCEPTION_FA,
      },
    };
  }
  if (input.jobTitleId?.trim() && row.job_title_id !== input.jobTitleId.trim()) {
    return {
      exception: true,
      marker: {
        code: HEADCOUNT_SCHEDULED_EXCEPTION,
        detectedAt,
        approvalId: row.id,
        messageFa: MSG_HEADCOUNT_SCHEDULED_EXCEPTION_FA,
      },
    };
  }
  if (input.seniorityId !== undefined) {
    const approvalSen = row.seniority_id;
    const assignSen = input.seniorityId?.trim() || null;
    if (approvalSen != null && approvalSen !== assignSen) {
      return {
        exception: true,
        marker: {
          code: HEADCOUNT_SCHEDULED_EXCEPTION,
          detectedAt,
          approvalId: row.id,
          messageFa: MSG_HEADCOUNT_SCHEDULED_EXCEPTION_FA,
        },
      };
    }
  }

  return { exception: false };
}

const EXCEPTION_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS headcount_scheduled_exception (
  event_id UUID PRIMARY KEY,
  code TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  approval_id UUID NULL,
  message_fa TEXT NOT NULL,
  cleared_at TIMESTAMPTZ NULL
);
`;

let exceptionSchemaReady = false;

export async function ensureScheduledExceptionSchema(
  db: Queryable,
): Promise<void> {
  if (exceptionSchemaReady) return;
  await db.query(EXCEPTION_SCHEMA_SQL);
  exceptionSchemaReady = true;
}

/** Persist visible Scheduled-exception marker (append-only events cannot be patched). */
export async function upsertScheduledExceptionMarker(
  db: Queryable,
  input: { eventId: string; marker: HeadcountExceptionMarker },
): Promise<void> {
  await ensureScheduledExceptionSchema(db);
  await db.query(
    `INSERT INTO headcount_scheduled_exception
       (event_id, code, detected_at, approval_id, message_fa, cleared_at)
     VALUES ($1::uuid, $2, $3::timestamptz, $4::uuid, $5, NULL)
     ON CONFLICT (event_id) DO UPDATE SET
       code = EXCLUDED.code,
       detected_at = EXCLUDED.detected_at,
       approval_id = EXCLUDED.approval_id,
       message_fa = EXCLUDED.message_fa,
       cleared_at = NULL`,
    [
      input.eventId,
      input.marker.code,
      input.marker.detectedAt,
      input.marker.approvalId ?? null,
      input.marker.messageFa,
    ],
  );
}

export async function getScheduledExceptionMarker(
  db: Queryable,
  eventId: string,
): Promise<HeadcountExceptionMarker | null> {
  await ensureScheduledExceptionSchema(db);
  const rows = await query<{
    code: string;
    detected_at: Date | string;
    approval_id: string | null;
    message_fa: string;
    cleared_at: Date | string | null;
  }>(
    db,
    `SELECT code, detected_at, approval_id, message_fa, cleared_at
     FROM headcount_scheduled_exception WHERE event_id = $1::uuid`,
    [eventId],
  );
  const row = rows[0];
  if (!row || row.cleared_at != null) return null;
  return {
    code: row.code,
    detectedAt:
      typeof row.detected_at === "string"
        ? row.detected_at
        : row.detected_at.toISOString(),
    approvalId: row.approval_id,
    messageFa: row.message_fa,
  };
}

export async function clearScheduledExceptionMarker(
  db: Queryable,
  eventId: string,
): Promise<void> {
  await ensureScheduledExceptionSchema(db);
  await db.query(
    `UPDATE headcount_scheduled_exception
     SET cleared_at = CURRENT_TIMESTAMP
     WHERE event_id = $1::uuid AND cleared_at IS NULL`,
    [eventId],
  );
}

/**
 * 14-day expiry warning for an already-Scheduled event with an active reservation.
 */
export async function checkReservationExpiryByEventId(
  db: Queryable,
  eventId: string,
  opts: { today?: string; warningDays?: number } = {},
): Promise<ReservationExpiryCheckResult> {
  const rows = await query<{ approval_id: string | null }>(
    db,
    `SELECT s.approval_id
     FROM headcount_capacity_reservation r
     JOIN headcount_capacity_slot s ON s.id = r.slot_id
     WHERE r.event_id = $1::uuid AND r.status = 'reserved'
     LIMIT 1`,
    [eventId],
  );
  const approvalId = rows[0]?.approval_id?.trim();
  if (!approvalId) return { atRisk: false };
  return checkReservationApprovalExpiryWarning(db, {
    approvalId,
    today: opts.today,
    warningDays: opts.warningDays,
  });
}
