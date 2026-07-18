/**
 * Termination personnel event helpers (Story 4.6 / FR-21).
 * Product path = Draft → Finalize → projection hook — no public terminateEmployment verbs.
 */

import type { Pool, PoolClient, PrismaClient } from "@divan/db";
import { getBusinessEventById } from "@divan/event-store";
import {
  releaseHeadcountCapacity,
  undoHeadcountRelease,
} from "@divan/headcount";

import { getPersonDb } from "./db";
import {
  closeEmploymentProjection,
  getEmploymentById,
  isEmploymentActiveAsOf,
} from "./employment";
import {
  EmploymentError,
  PersonnelEventError,
  PrimaryAssignmentError,
  SecondaryAssignmentError,
} from "./errors";
import type { PersonnelEventDraftRecord } from "./personnel-event-draft";
import type { ProjectionRefreshContext } from "./personnel-event-projection-hook";
import {
  closePrimaryAssignmentProjection,
  listPrimaryAssignmentsForEmployment,
} from "./primary-assignment";
import {
  closeSecondaryAssignmentProjection,
  listSecondaryAssignmentsForEmployment,
} from "./secondary-assignment";
import { START_RETURN_EVENT_TYPES } from "./personnel-event-start-return";

/** Product Termination event type (PascalCase past-tense). */
export const PRODUCT_TERMINATION_EVENT_TYPE = "EmploymentTerminated";

export const TERMINATION_EVENT_TYPES = new Set([
  PRODUCT_TERMINATION_EVENT_TYPE,
]);

/** Lean seed-style reason examples — not a frozen AR-DATA catalogue. */
export const LEAN_TERMINATION_REASON_EXAMPLES = [
  "contract_ended",
  "resignation",
  "dismissal",
] as const;

export type TerminationPayloadFacts = {
  terminationReason: string;
  /** From payload when draft.employmentId unbound. */
  employmentId: string | null;
};

export type MissingTerminationFact = {
  code: string;
  messageFa: string;
};

function strField(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const v = payload[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/** Prior calendar day (UTC components) for half-open active-as-of checks. */
export function priorDateOnly(dateOnly: string): string {
  const [ys, ms, ds] = dateOnly.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** PG @db.Date → YYYY-MM-DD (UTC midnight or local; noon-UTC writers safe). */
function dateOnlyFromDb(d: Date): string {
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateOnlyToDb(dateOnly: string): Date {
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

/**
 * Parse Termination minimum facts from draft payload.
 * Org/job Start facts are not required (already on Employment).
 */
export function parseTerminationPayload(
  payload: Record<string, unknown>,
): { facts: TerminationPayloadFacts | null; missing: MissingTerminationFact[] } {
  const missing: MissingTerminationFact[] = [];

  const terminationReason = strField(payload, "terminationReason");
  if (!terminationReason) {
    missing.push({
      code: "MISSING_TERMINATION_REASON",
      messageFa: "دلیل خاتمه همکاری (کد کوتاه) در پیش‌نویس الزامی است.",
    });
  }

  if (missing.length > 0) {
    return { facts: null, missing };
  }

  return {
    facts: {
      terminationReason: terminationReason!,
      employmentId: strField(payload, "employmentId"),
    },
    missing: [],
  };
}

export type TerminationSource = {
  personId: string;
  effectiveDate: string;
  payload: Record<string, unknown>;
  employmentId: string | null;
};

export async function resolveTerminationSource(
  ctx: ProjectionRefreshContext,
): Promise<TerminationSource | null> {
  if (ctx.draft) {
    return {
      personId: ctx.draft.personId,
      effectiveDate: ctx.draft.effectiveDate,
      payload: ctx.draft.payload,
      employmentId: ctx.draft.employmentId,
    };
  }
  const event = await getBusinessEventById(ctx.client, ctx.eventId);
  if (!event) return null;
  return {
    personId: event.personId,
    effectiveDate: event.effectiveDate,
    payload: event.payload,
    employmentId: event.employmentId,
  };
}

export type TerminationAssignmentClose = {
  id: string;
  /** Previous end before this apply; null means was open. */
  previousEnd: string | null;
};

export type TerminationApplyResult = {
  employmentId: string;
  closedPrimaries: TerminationAssignmentClose[];
  closedSecondaries: TerminationAssignmentClose[];
  /** @deprecated Prefer closedPrimaries — ids only for callers that ignore undo ends. */
  closedPrimaryIds: string[];
  closedSecondaryIds: string[];
  endDateExclusive: string;
  /** True when this invocation performed closes/release (not pure idempotent hit). */
  mutated: boolean;
  releasedCapacity: boolean;
  didCloseEmployment: boolean;
};

export type IncompatibleFutureEvent = {
  id: string;
  eventType: string;
  effectiveDate: string;
  status: string;
};

/**
 * Detect authoritative Scheduled (pre-effect) peers incompatible with Termination.
 * Caller maps to blocking INCOMPATIBLE_FUTURE_EVENTS — no auto-Cancel.
 */
export async function findIncompatibleFutureEvents(
  client: Pool | PoolClient,
  opts: {
    personId: string;
    employmentId: string | null;
    terminationEffectiveDate: string;
    excludeEventId?: string | null;
  },
): Promise<IncompatibleFutureEvent[]> {
  const startReturnTypes = [
    ...START_RETURN_EVENT_TYPES,
    "TransferRecorded",
  ];
  const rows = await client.query<{
    id: string;
    event_type: string;
    effective_date: Date | string;
    status: string;
    employment_id: string | null;
  }>(
    `SELECT e.id, e.event_type, e.effective_date, e.status, e.employment_id
     FROM kernel_events e
     WHERE e.event_class = 'business'
       AND e.person_id = $1::uuid
       AND e.status = 'Scheduled'
       AND ($2::uuid IS NULL OR e.id <> $2::uuid)
       AND NOT EXISTS (
         SELECT 1 FROM kernel_events c
         WHERE c.cancels_event_id = e.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM kernel_events r
         WHERE r.reverses_event_id = e.id
       )
       AND (
         (
           e.event_type = ANY($3::text[])
           AND e.effective_date >= $4::date
         )
         OR (
           $5::uuid IS NOT NULL
           AND e.employment_id = $5::uuid
           AND e.effective_date >= $4::date
         )
       )
     ORDER BY e.effective_date ASC, e.id ASC`,
    [
      opts.personId,
      opts.excludeEventId ?? null,
      startReturnTypes,
      opts.terminationEffectiveDate,
      opts.employmentId,
    ],
  );

  return rows.rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    effectiveDate:
      typeof r.effective_date === "string"
        ? r.effective_date.slice(0, 10)
        : dateOnlyFromDb(r.effective_date),
    status: r.status,
  }));
}

function formatIncompatibleMessageFa(
  events: IncompatibleFutureEvent[],
): string {
  const list = events
    .map(
      (e) =>
        `${e.eventType} (${e.id.slice(0, 8)}…) تاریخ ${e.effectiveDate}`,
    )
    .join("؛ ");
  return `رویدادهای آینده ناسازگار باید قبل از خاتمه صریحاً لغو شوند: ${list}`;
}

export function incompatibleFutureToConflict(
  events: IncompatibleFutureEvent[],
): { code: string; severity: "blocking"; messageFa: string } | null {
  if (events.length === 0) return null;
  return {
    code: "INCOMPATIBLE_FUTURE_EVENTS",
    severity: "blocking",
    messageFa: formatIncompatibleMessageFa(events),
  };
}

async function closeOrClampPrimary(
  id: string,
  endDateExclusive: string,
  db: PrismaClient,
): Promise<"closed" | "clamped" | "already"> {
  const existing = await db.primaryAssignment.findUnique({ where: { id } });
  if (!existing) {
    throw new PrimaryAssignmentError(
      "PRIMARY_ASSIGNMENT_NOT_FOUND",
      "انتصاب اولیه یافت نشد.",
    );
  }
  const currentEnd = existing.endDateExclusive
    ? dateOnlyFromDb(existing.endDateExclusive)
    : null;
  if (currentEnd === endDateExclusive) {
    return "already";
  }
  // Already ended strictly before Termination ED — leave as-is
  if (currentEnd !== null && currentEnd < endDateExclusive) {
    return "already";
  }
  if (currentEnd === null) {
    await closePrimaryAssignmentProjection(id, endDateExclusive, db);
    return "closed";
  }
  // currentEnd > ED — clamp down to Termination ED
  const startDate = dateOnlyFromDb(existing.startDate);
  if (startDate >= endDateExclusive) {
    throw new PrimaryAssignmentError(
      "INVALID_PRIMARY_INTERVAL",
      "تاریخ شروع انتصاب اولیه با تاریخ مؤثر خاتمه ناسازگار است.",
    );
  }
  await db.primaryAssignment.update({
    where: { id },
    data: { endDateExclusive: dateOnlyToDb(endDateExclusive) },
  });
  return "clamped";
}

async function closeOrClampSecondary(
  id: string,
  endDateExclusive: string,
  db: PrismaClient,
): Promise<"closed" | "clamped" | "already"> {
  const existing = await db.secondaryAssignment.findUnique({ where: { id } });
  if (!existing) {
    throw new SecondaryAssignmentError(
      "SECONDARY_ASSIGNMENT_NOT_FOUND",
      "انتصاب ثانویه یافت نشد.",
    );
  }
  const currentEnd = existing.endDateExclusive
    ? dateOnlyFromDb(existing.endDateExclusive)
    : null;
  if (currentEnd === endDateExclusive) {
    return "already";
  }
  if (currentEnd !== null && currentEnd < endDateExclusive) {
    return "already";
  }
  if (currentEnd === null) {
    await closeSecondaryAssignmentProjection(id, endDateExclusive, db);
    return "closed";
  }
  const startDate = dateOnlyFromDb(existing.startDate);
  if (startDate >= endDateExclusive) {
    throw new SecondaryAssignmentError(
      "INVALID_SECONDARY_INTERVAL",
      "تاریخ شروع انتصاب ثانویه با تاریخ مؤثر خاتمه ناسازگار است.",
    );
  }
  await db.secondaryAssignment.update({
    where: { id },
    data: {
      endDateExclusive: dateOnlyToDb(endDateExclusive),
      updatedAt: new Date(),
    },
  });
  return "clamped";
}

type AssignmentCloseUndo = TerminationAssignmentClose;

/**
 * Undo Termination closes + release when a later step fails (orphan compensate).
 */
export async function compensateTerminationApply(
  opts: {
    client: PoolClient;
    employmentId: string;
    endDateExclusive: string;
    closedPrimaries?: AssignmentCloseUndo[];
    closedSecondaries?: AssignmentCloseUndo[];
    /** @deprecated Use closedPrimaries */
    closedPrimaryIds?: string[];
    closedSecondaryIds?: string[];
    releaseEventId: string;
    didRelease: boolean;
    didCloseEmployment: boolean;
  },
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const primaries =
    opts.closedPrimaries ??
    (opts.closedPrimaryIds ?? []).map((id) => ({
      id,
      previousEnd: null as string | null,
    }));
  const secondaries =
    opts.closedSecondaries ??
    (opts.closedSecondaryIds ?? []).map((id) => ({
      id,
      previousEnd: null as string | null,
    }));
  try {
    if (opts.didRelease) {
      await undoHeadcountRelease(opts.client, opts.releaseEventId);
    }
    const endDb = dateOnlyToDb(opts.endDateExclusive);
    for (const item of secondaries) {
      await db.secondaryAssignment.updateMany({
        where: { id: item.id, endDateExclusive: endDb },
        data: {
          endDateExclusive: item.previousEnd
            ? dateOnlyToDb(item.previousEnd)
            : null,
        },
      });
    }
    for (const item of primaries) {
      await db.primaryAssignment.updateMany({
        where: { id: item.id, endDateExclusive: endDb },
        data: {
          endDateExclusive: item.previousEnd
            ? dateOnlyToDb(item.previousEnd)
            : null,
        },
      });
    }
    if (opts.didCloseEmployment) {
      await db.employment.updateMany({
        where: { id: opts.employmentId, endDateExclusive: endDb },
        data: { endDateExclusive: null, terminationReason: null },
      });
    }
  } catch {
    // Best-effort; original error is rethrown by caller
  }
}

/**
 * Apply Termination closes + headcount release for Effective events.
 * Order: Primary(s) → Secondary(s) → Employment(+reason) → release → coverage assert.
 * Idempotent when already closed to this ED/reason and release keyed by event id.
 */
export async function applyTerminationProjections(
  ctx: ProjectionRefreshContext,
  db: PrismaClient = getPersonDb(),
): Promise<TerminationApplyResult> {
  if (!TERMINATION_EVENT_TYPES.has(ctx.eventType)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "نوع رویداد خاتمه همکاری نیست.",
      "not_termination",
    );
  }

  const source = await resolveTerminationSource(ctx);
  if (!source) {
    throw new PersonnelEventError(
      "VALIDATION",
      "منبع رویداد خاتمه یافت نشد.",
      "missing_source",
    );
  }

  const { facts, missing } = parseTerminationPayload(source.payload);
  if (!facts || missing.length > 0) {
    throw new PersonnelEventError(
      "VALIDATION",
      missing[0]?.messageFa ?? "دلیل خاتمه الزامی است.",
      "missing_facts",
    );
  }

  const employmentId =
    source.employmentId?.trim() || facts.employmentId?.trim() || null;
  if (!employmentId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "شناسه همکاری هدف برای خاتمه الزامی است.",
      "missing_employment",
    );
  }

  const employment = await getEmploymentById(employmentId, db);
  if (!employment) {
    throw new PersonnelEventError(
      "VALIDATION",
      "سابقه همکاری هدف یافت نشد.",
      "employment_not_found",
    );
  }
  if (employment.personId !== source.personId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "همکاری هدف متعلق به این فرد نیست.",
      "employment_person_mismatch",
    );
  }

  // Idempotent recalc/retry: Employment already closed with this lean reason.
  // Event-store effective_date may off-by-one vs projection end under PG DATE/TZ
  // (deferred kernel binding) — trust projection end + reason as applied marker.
  if (
    employment.endDateExclusive !== null &&
    employment.terminationReason === facts.terminationReason
  ) {
    const consumeEventIds = (
      await listPrimaryAssignmentsForEmployment(employmentId, db)
    )
      .map((p) => p.sourceEventId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const requireConsumption = consumeEventIds.length > 0;
    const releaseResult = await releaseHeadcountCapacity(ctx.client, {
      releaseEventId: ctx.eventId,
      personId: source.personId,
      consumeEventIds,
      requireConsumption,
    });
    return {
      employmentId,
      closedPrimaries: [],
      closedSecondaries: [],
      closedPrimaryIds: [],
      closedSecondaryIds: [],
      endDateExclusive: employment.endDateExclusive,
      mutated: releaseResult.released,
      releasedCapacity: releaseResult.released,
      didCloseEmployment: false,
    };
  }

  const closedPrimaries: TerminationAssignmentClose[] = [];
  const closedSecondaries: TerminationAssignmentClose[] = [];
  let mutated = false;
  let releasedCapacity = false;
  let didCloseEmployment = false;

  try {
    if (employment.endDateExclusive !== null) {
      throw new EmploymentError(
        "VALIDATION",
        "این سابقه همکاری قبلاً پایان یافته است.",
      );
    }

    const primaries = await listPrimaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    const toClosePrimaries = primaries.filter(
      (p) =>
        p.endDateExclusive === null ||
        p.endDateExclusive > source.effectiveDate,
    );

    for (const p of toClosePrimaries) {
      const previousEnd = p.endDateExclusive;
      const r = await closeOrClampPrimary(p.id, source.effectiveDate, db);
      if (r === "closed" || r === "clamped") {
        closedPrimaries.push({ id: p.id, previousEnd });
        mutated = true;
      }
    }

    const secondaries = await listSecondaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    const toCloseSecondaries = secondaries.filter(
      (s) =>
        s.endDateExclusive === null ||
        s.endDateExclusive > source.effectiveDate,
    );
    for (const s of toCloseSecondaries) {
      const previousEnd = s.endDateExclusive;
      const r = await closeOrClampSecondary(s.id, source.effectiveDate, db);
      if (r === "closed" || r === "clamped") {
        closedSecondaries.push({ id: s.id, previousEnd });
        mutated = true;
      }
    }

    {
      const updated = await db.employment.updateMany({
        where: { id: employmentId, endDateExclusive: null },
        data: {
          endDateExclusive: dateOnlyToDb(source.effectiveDate),
          terminationReason: facts.terminationReason,
        },
      });
      if (updated.count > 0) {
        didCloseEmployment = true;
        mutated = true;
      } else {
        // Concurrent close — accept only when ED + reason match
        const again = await getEmploymentById(employmentId, db);
        if (
          !again ||
          again.endDateExclusive !== source.effectiveDate ||
          again.terminationReason !== facts.terminationReason
        ) {
          await closeEmploymentProjection(
            employmentId,
            source.effectiveDate,
            db,
            { terminationReason: facts.terminationReason },
          );
        }
      }
    }

    // Coverage assert AFTER closes: no open/extending Primary/Secondary; Employment closed at ED
    const primariesAfter = await listPrimaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    const badP = primariesAfter.filter(
      (p) =>
        p.endDateExclusive === null ||
        p.endDateExclusive > source.effectiveDate,
    );
    if (badP.length !== 0) {
      throw new PrimaryAssignmentError(
        "VALIDATION",
        "پس از خاتمه نباید انتصاب اولیه باز یا فراتر از تاریخ مؤثر باقی بماند.",
      );
    }
    const endedAtEdP = primariesAfter.filter(
      (p) => p.endDateExclusive === source.effectiveDate,
    );
    // At least the assignments we closed/clamped (or prior same-ED) should match ED;
    // leave pre-ended (end < ED) alone without requiring === ED.
    for (const p of endedAtEdP) {
      if (p.startDate >= source.effectiveDate) {
        throw new PrimaryAssignmentError(
          "VALIDATION",
          "انتصاب اولیه با تاریخ شروع ناسازگار پس از خاتمه باقی مانده است.",
        );
      }
    }
    const secondariesAfter = await listSecondaryAssignmentsForEmployment(
      employmentId,
      db,
    );
    const badS = secondariesAfter.filter(
      (s) =>
        s.endDateExclusive === null ||
        s.endDateExclusive > source.effectiveDate,
    );
    if (badS.length !== 0) {
      throw new SecondaryAssignmentError(
        "VALIDATION",
        "پس از خاتمه نباید انتصاب ثانویه باز یا فراتر از تاریخ مؤثر باقی بماند.",
      );
    }
    const empAfter = await getEmploymentById(employmentId, db);
    if (!empAfter || empAfter.endDateExclusive !== source.effectiveDate) {
      throw new EmploymentError(
        "VALIDATION",
        "همکاری پس از خاتمه باید با تاریخ پایان مؤثر بسته شود.",
      );
    }
    if (empAfter.terminationReason !== facts.terminationReason) {
      throw new EmploymentError(
        "VALIDATION",
        "دلیل خاتمه روی سابقه همکاری ثبت نشد.",
      );
    }
    // Not employed as-of Effective Date; prior day may still be active when start ≤ prior
    if (isEmploymentActiveAsOf(empAfter, source.effectiveDate)) {
      throw new EmploymentError(
        "VALIDATION",
        "در تاریخ مؤثر خاتمه، همکاری نباید فعال باشد.",
      );
    }

    // Release capacity consumed by Start/Return that opened this Employment
    const consumeEventIds = primariesAfter
      .map((p) => p.sourceEventId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const requireConsumption = consumeEventIds.length > 0;

    const releaseResult = await releaseHeadcountCapacity(ctx.client, {
      releaseEventId: ctx.eventId,
      personId: source.personId,
      consumeEventIds,
      requireConsumption,
    });
    if (releaseResult.released) {
      releasedCapacity = true;
      mutated = true;
    }

    return {
      employmentId,
      closedPrimaries,
      closedSecondaries,
      closedPrimaryIds: closedPrimaries.map((c) => c.id),
      closedSecondaryIds: closedSecondaries.map((c) => c.id),
      endDateExclusive: source.effectiveDate,
      mutated,
      releasedCapacity,
      didCloseEmployment,
    };
  } catch (err) {
    if (mutated || releasedCapacity || didCloseEmployment) {
      await compensateTerminationApply(
        {
          client: ctx.client,
          employmentId,
          endDateExclusive: source.effectiveDate,
          closedPrimaries,
          closedSecondaries,
          releaseEventId: ctx.eventId,
          didRelease: releasedCapacity,
          didCloseEmployment,
        },
        db,
      );
    }
    mapTerminationProjectorError(err);
  }
}

function mapTerminationProjectorError(err: unknown): never {
  if (err instanceof PersonnelEventError) throw err;
  if (err instanceof EmploymentError) {
    throw new PersonnelEventError("VALIDATION", err.messageFa, err.code);
  }
  if (err instanceof PrimaryAssignmentError) {
    throw new PersonnelEventError("VALIDATION", err.messageFa, err.code);
  }
  if (err instanceof SecondaryAssignmentError) {
    throw new PersonnelEventError("VALIDATION", err.messageFa, err.code);
  }
  if (
    err instanceof Error &&
    (err.message.includes("آزادسازی ظرفیت") ||
      err.message.includes("هدف آزادسازی"))
  ) {
    throw new PersonnelEventError(
      "VALIDATION",
      err.message,
      "headcount_release",
    );
  }
  throw err;
}

export type { PersonnelEventDraftRecord };
