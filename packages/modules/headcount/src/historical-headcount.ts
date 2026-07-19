/**
 * Historical headcount quantity reconstruction (Story 4.11 / FR-27).
 * Event-linked ledger read — NOT live free_units/reserved_units for asOf < today.
 * `readHeadcountCapacityPanel` remains live/finalize-only (UX-DR13).
 */

import {
  getBusinessEventById,
  listChainLinksForEvents,
  type BusinessEventRecord,
  type BusinessEventStatus,
  type PgQueryable,
} from "@divan/event-store";
import { parseDateOnly } from "@divan/temporal-engine";

import type { Pool, PoolClient } from "@divan/db";

export const MSG_HEADCOUNT_ASOF_INVALID_FA =
  "تاریخ مبنا نامعتبر است؛ بازسازی ظرفیت ارائه نمی‌شود.";

export const MSG_HEADCOUNT_LEDGER_AMBIGUOUS_FA =
  "پیوند دفتر ظرفیت با رویداد مبهم یا ناموجود است؛ بازسازی تاریخی مسدود است.";

export const MSG_HEADCOUNT_CONSERVATION_FA =
  "هویت کاتالوگ ظرفیت (approved = used + reserved + free) برقرار نیست؛ بازسازی تاریخی مسدود است.";

export const MSG_HEADCOUNT_MISSING_APPROVAL_FA =
  "پیوند مجوز ظرفیت برای اسلات ناقص است؛ بازسازی تاریخی مسدود است.";

export class HeadcountLedgerError extends Error {
  readonly code:
    | "VALIDATION"
    | "LEDGER_AMBIGUOUS"
    | "CONSERVATION"
    | "MISSING_APPROVAL";
  readonly messageFa: string;

  constructor(
    code:
      | "VALIDATION"
      | "LEDGER_AMBIGUOUS"
      | "CONSERVATION"
      | "MISSING_APPROVAL",
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "HeadcountLedgerError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

async function query<T extends Record<string, unknown>>(
  db: Queryable,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await db.query(sql, params);
  return r.rows as T[];
}

/**
 * Lightweight evaluation-by-date for historical ledger reads.
 * Stored Effective with effectiveDate > asOf stays pre-effect (Scheduled).
 */
function evaluationStatusAsOf(
  event: Pick<BusinessEventRecord, "status" | "effectiveDate">,
  asOfDate: string,
): BusinessEventStatus {
  if (event.status === "Draft") return "Draft";
  if (event.status === "Cancelled" || event.status === "Reversed") {
    return event.status;
  }
  if (event.status === "Scheduled" || event.status === "Effective") {
    return event.effectiveDate <= asOfDate ? "Effective" : "Scheduled";
  }
  return event.status;
}

/** Neutralizer takes effect on registration day, not the cancelled target's future ED. */
function neutralizerGateDate(neutralizer: BusinessEventRecord): string {
  const d = neutralizer.registeredAt;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isNeutralizerActiveAsOf(
  neutralizer: BusinessEventRecord,
  asOfDate: string,
): boolean {
  if (neutralizer.status === "Draft") return false;
  return neutralizerGateDate(neutralizer) <= asOfDate;
}

function resolveLifecycleStatus(
  event: BusinessEventRecord,
  links: {
    cancellations: BusinessEventRecord[];
    reversals: BusinessEventRecord[];
  },
  asOfDate: string,
): BusinessEventStatus {
  if (links.cancellations.some((c) => isNeutralizerActiveAsOf(c, asOfDate))) {
    return "Cancelled";
  }
  if (links.reversals.some((r) => isNeutralizerActiveAsOf(r, asOfDate))) {
    return "Reversed";
  }
  return evaluationStatusAsOf(event, asOfDate);
}

export type ReconstructHeadcountQuantitiesInput = {
  asOf: string;
  teamId?: string;
  slotId?: string;
};

export type HeadcountSlotQuantities = {
  slotId: string;
  teamId: string;
  jobTitleId: string | null;
  ladderId: string | null;
  gradeId: string | null;
  /** Approval allowed_count when linked; else live ceiling stand-in (legacy slots). */
  approved: number;
  used: number;
  reserved: number;
  /** May be negative when Override-backed overbook occurred (FR-32). */
  free: number;
  /** True when free < 0 (over-capacity surfaced, never floored). */
  overridden?: boolean;
};

export type ReconstructHeadcountQuantitiesResult = {
  asOf: string;
  slots: HeadcountSlotQuantities[];
  aggregate: {
    approved: number;
    used: number;
    reserved: number;
    free: number;
  };
};

/** Compare helper — ignores nothing wall-clock; slots sorted by slotId. */
export function headcountQuantitiesFactsForCompare(
  result: ReconstructHeadcountQuantitiesResult,
): unknown {
  return {
    asOf: result.asOf,
    slots: [...result.slots]
      .map((s) => ({
        slotId: s.slotId,
        teamId: s.teamId,
        jobTitleId: s.jobTitleId,
        ladderId: s.ladderId,
        gradeId: s.gradeId,
        approved: s.approved,
        used: s.used,
        reserved: s.reserved,
        free: s.free,
      }))
      .sort((a, b) => a.slotId.localeCompare(b.slotId)),
    aggregate: { ...result.aggregate },
  };
}

type SlotRow = {
  id: string;
  team_id: string;
  job_title_id: string | null;
  ladder_id: string | null;
  grade_id: string | null;
  start_date: Date | string;
  end_date_exclusive: Date | string | null;
  free_units: number;
  reserved_units: number;
  approval_id: string | null;
};

type ApprovalCeilingRow = {
  id: string;
  allowed_count: number;
  validity_start: Date | string;
  validity_end_exclusive: Date | string;
  status: string;
};

type ConsumptionRow = {
  id: string;
  slot_id: string;
  event_id: string;
  person_id: string;
  release_event_id: string | null;
};

type ReservationRow = {
  id: string;
  slot_id: string;
  event_id: string;
  person_id: string;
  status: string;
};

/**
 * Reconstruct approved/used/reserved/free per in-scope slot at `asOf`.
 *
 * - used/reserved: event-linked ledger + Effective/lifecycle (not live counters)
 * - approved: Approval `allowed_count` when status=active and validity contains asOf;
 *   Approval-backed but not consumable-as-of → used+reserved (free=0; no live stand-in);
 *   dangling approval_id → fail-closed; legacy slots keep live ceiling stand-in
 * - free: approved − used − reserved (catalogue identity; never silently floor)
 *
 * Do **not** use this as a silent wrapper around `readHeadcountCapacityPanel`
 * for historical dates — that panel reads live counters only.
 */
export async function reconstructHeadcountQuantitiesAsOf(
  db: Queryable,
  input: ReconstructHeadcountQuantitiesInput,
): Promise<ReconstructHeadcountQuantitiesResult> {
  const parsed = parseDateOnly(input.asOf);
  if (!parsed.ok) {
    throw new HeadcountLedgerError(
      "VALIDATION",
      MSG_HEADCOUNT_ASOF_INVALID_FA,
      parsed.reason,
    );
  }
  const asOf = parsed.value;
  const eventDb = db as PgQueryable;

  const params: unknown[] = [asOf];
  let sql = `
    SELECT id, team_id, job_title_id, ladder_id, grade_id,
           start_date, end_date_exclusive, free_units, reserved_units,
           approval_id
    FROM headcount_capacity_slot
    WHERE start_date <= $1::date
      AND (end_date_exclusive IS NULL OR end_date_exclusive > $1::date)`;
  if (input.slotId?.trim()) {
    params.push(input.slotId.trim());
    sql += ` AND id = $${params.length}::uuid`;
  }
  if (input.teamId?.trim()) {
    params.push(input.teamId.trim());
    sql += ` AND team_id = $${params.length}::uuid`;
  }
  sql += ` ORDER BY team_id ASC, start_date ASC, id ASC`;

  const slots = await query<SlotRow>(db, sql, params);
  if (slots.length === 0) {
    return {
      asOf,
      slots: [],
      aggregate: { approved: 0, used: 0, reserved: 0, free: 0 },
    };
  }

  const slotIds = slots.map((s) => s.id);
  const approvalIds = [
    ...new Set(
      slots
        .map((s) => s.approval_id)
        .filter((id): id is string => Boolean(id?.trim())),
    ),
  ];
  const approvalById = new Map<string, ApprovalCeilingRow>();
  if (approvalIds.length > 0) {
    const approvalRows = await query<ApprovalCeilingRow>(
      db,
      `SELECT id, allowed_count, validity_start, validity_end_exclusive, status
       FROM headcount_approval
       WHERE id = ANY($1::uuid[])`,
      [approvalIds],
    );
    for (const a of approvalRows) {
      approvalById.set(a.id, a);
    }
  }

  const consumptions = await query<ConsumptionRow>(
    db,
    `SELECT id, slot_id, event_id, person_id, release_event_id
     FROM headcount_capacity_consumption
     WHERE slot_id = ANY($1::uuid[])`,
    [slotIds],
  );
  const reservations = await query<ReservationRow>(
    db,
    `SELECT id, slot_id, event_id, person_id, status
     FROM headcount_capacity_reservation
     WHERE slot_id = ANY($1::uuid[])`,
    [slotIds],
  );

  const eventIds = new Set<string>();
  for (const c of consumptions) {
    eventIds.add(c.event_id);
    if (c.release_event_id) eventIds.add(c.release_event_id);
  }
  for (const r of reservations) {
    eventIds.add(r.event_id);
  }

  const eventIdList = [...eventIds];
  const eventsById = new Map<string, BusinessEventRecord>();
  for (const id of eventIdList) {
    const ev = await getBusinessEventById(eventDb, id);
    if (!ev) {
      throw new HeadcountLedgerError(
        "LEDGER_AMBIGUOUS",
        MSG_HEADCOUNT_LEDGER_AMBIGUOUS_FA,
        `missing_event:${id}`,
      );
    }
    eventsById.set(id, ev);
  }
  const chainMap = await listChainLinksForEvents(eventDb, eventIdList);

  const usedBySlot = new Map<string, number>();
  const reservedBySlot = new Map<string, number>();
  for (const id of slotIds) {
    usedBySlot.set(id, 0);
    reservedBySlot.set(id, 0);
  }

  for (const c of consumptions) {
    const consumeEv = eventsById.get(c.event_id)!;
    const consumeLinks = chainMap.get(c.event_id) ?? {
      cancellations: [],
      reversals: [],
      corrections: [],
    };
    const consumeStatus = resolveLifecycleStatus(
      consumeEv,
      consumeLinks,
      asOf,
    );
    if (
      consumeStatus === "Cancelled" ||
      consumeStatus === "Reversed" ||
      consumeStatus === "Draft"
    ) {
      continue;
    }
    // Used only once the consume event is Effective at asOf.
    if (consumeStatus !== "Effective") continue;

    if (c.release_event_id) {
      const releaseEv = eventsById.get(c.release_event_id)!;
      const releaseLinks = chainMap.get(c.release_event_id) ?? {
        cancellations: [],
        reversals: [],
        corrections: [],
      };
      const releaseStatus = resolveLifecycleStatus(
        releaseEv,
        releaseLinks,
        asOf,
      );
      if (releaseStatus === "Effective") {
        continue; // released as of asOf
      }
      // Cancelled/Reversed/Scheduled release → still used at asOf
    }

    usedBySlot.set(c.slot_id, (usedBySlot.get(c.slot_id) ?? 0) + 1);
  }

  for (const r of reservations) {
    const ev = eventsById.get(r.event_id)!;
    const links = chainMap.get(r.event_id) ?? {
      cancellations: [],
      reversals: [],
      corrections: [],
    };
    const status = resolveLifecycleStatus(ev, links, asOf);
    // Active reservation at asOf: Finalized event still Scheduled (pre-effect).
    if (status === "Scheduled") {
      reservedBySlot.set(r.slot_id, (reservedBySlot.get(r.slot_id) ?? 0) + 1);
    }
  }

  // Live used for legacy stand-in (slots without Approval).
  const liveUsedRows = await query<{ slot_id: string; c: string }>(
    db,
    `SELECT slot_id, COUNT(*)::text AS c
     FROM headcount_capacity_consumption
     WHERE slot_id = ANY($1::uuid[]) AND release_event_id IS NULL
     GROUP BY slot_id`,
    [slotIds],
  );
  const liveUsedBySlot = new Map<string, number>();
  for (const row of liveUsedRows) {
    liveUsedBySlot.set(row.slot_id, Number(row.c));
  }

  function dateOnlyFromPg(value: Date | string): string {
    if (typeof value === "string") return value.slice(0, 10);
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const resultSlots: HeadcountSlotQuantities[] = [];
  let aggApproved = 0;
  let aggUsed = 0;
  let aggReserved = 0;
  let aggFree = 0;

  for (const slot of slots) {
    const used = usedBySlot.get(slot.id) ?? 0;
    const reserved = reservedBySlot.get(slot.id) ?? 0;
    let approved: number;
    if (slot.approval_id) {
      const approval = approvalById.get(slot.approval_id);
      if (!approval) {
        throw new HeadcountLedgerError(
          "MISSING_APPROVAL",
          MSG_HEADCOUNT_MISSING_APPROVAL_FA,
          `approval_id=${slot.approval_id};slot=${slot.id}`,
        );
      }
      const vStart = dateOnlyFromPg(approval.validity_start);
      const vEnd = dateOnlyFromPg(approval.validity_end_exclusive);
      const inValidity = asOf >= vStart && asOf < vEnd;
      // Consumable-as-of: active + validity ∩ asOf (cancelled/expired never ceiling).
      if (inValidity && approval.status === "active") {
        approved = Number(approval.allowed_count);
      } else {
        // Out of window / non-active — claims-only ceiling; never live stand-in.
        approved = used + reserved;
      }
    } else {
      const liveUsed = liveUsedBySlot.get(slot.id) ?? 0;
      const liveReserved = Number(slot.reserved_units);
      const liveFree = Number(slot.free_units);
      approved = liveUsed + liveReserved + liveFree;
    }
    const free = approved - used - reserved;
    // Conservation identity holds when free is negative (Override overbook).
    // Never silently floor; surface negative free for as-of views (FR-32).
    if (approved !== used + reserved + free) {
      throw new HeadcountLedgerError(
        "CONSERVATION",
        MSG_HEADCOUNT_CONSERVATION_FA,
        `slot=${slot.id};approved=${approved};used=${used};reserved=${reserved};free=${free}`,
      );
    }

    resultSlots.push({
      slotId: slot.id,
      teamId: slot.team_id,
      jobTitleId: slot.job_title_id,
      ladderId: slot.ladder_id,
      gradeId: slot.grade_id,
      approved,
      used,
      reserved,
      free,
      overridden: free < 0,
    });
    aggApproved += approved;
    aggUsed += used;
    aggReserved += reserved;
    aggFree += free;
  }

  return {
    asOf,
    slots: resultSlots,
    aggregate: {
      approved: aggApproved,
      used: aggUsed,
      reserved: aggReserved,
      free: aggFree,
    },
  };
}
