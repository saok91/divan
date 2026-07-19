/**
 * Team Transfer personnel event helpers (Story 4.7 / FR-22 / FR-30 / FR-31).
 * Product path = Draft → Finalize → projection hook — no public transferPrimary verbs.
 */

import type { Pool, PoolClient, PrismaClient } from "@divan/db";
import { getBusinessEventById } from "@divan/event-store";
import {
  consumeHeadcountCapacity,
  consumeHeadcountCapacityWithOverride,
  convertReservationToConsumption,
  detectScheduledHeadcountException,
  ensureOverrideRowAfterConvert,
  releaseHeadcountCapacity,
  releaseHeadcountReservation,
  reserveHeadcountCapacity,
  reserveHeadcountCapacityWithOverride,
  undoHeadcountRelease,
  undoTransferDestinationCapacity,
  upsertScheduledExceptionMarker,
  type CapacityCheckResult,
  type HeadcountViolatedRule,
  type OverrideMutateContext,
} from "@divan/headcount";

import { getPersonDb } from "./db";
import {
  getEmploymentById,
  isEmploymentActiveAsOf,
} from "./employment";
import {
  PersonnelEventError,
  PrimaryAssignmentError,
} from "./errors";
import {
  findInactiveRefConflicts,
  capacityResultToConflict,
  START_RETURN_EVENT_TYPES,
  type StartReturnPayloadFacts,
} from "./personnel-event-start-return";
import type { PersonnelEventDraftRecord } from "./personnel-event-draft";
import type { ProjectionRefreshContext } from "./personnel-event-projection-hook";
import {
  applyPrimaryAssignmentProjection,
  closePrimaryAssignmentProjection,
  getActivePrimaryAssignmentAsOf,
  listPrimaryAssignmentsForEmployment,
  type PrimaryAssignmentRecord,
} from "./primary-assignment";
import { assertPrimaryCoverageForActiveEmployment } from "./primary-assignment-invariants";

/** Product Transfer event type (PascalCase past-tense). */
export const PRODUCT_TRANSFER_EVENT_TYPE = "TransferRecorded";

export const TRANSFER_EVENT_TYPES = new Set([PRODUCT_TRANSFER_EVENT_TYPE]);

/** Non-product — reject at draft validation / conflicts. */
export const NON_PRODUCT_TRANSFER_EVENT_TYPE = "TeamTransferRecorded";

/** Inline — avoid circular import with personnel-event-termination. */
const PEER_TERMINATION_EVENT_TYPE = "EmploymentTerminated";

export type TransferPayloadFacts = {
  teamId: string;
  organizationalRoleId: string;
  jobTitleId: string;
  ladderId: string;
  gradeId: string;
  seniorityId: string | null;
  capacitySlotId: string | null;
  headcountApprovalId: string | null;
  headcountExempt?: boolean;
  headcountOverride?: boolean;
  headcountOverrideReason?: string | null;
  headcountViolatedRule?: HeadcountViolatedRule | null;
  headcountOverrideActorId?: string | null;
  employmentId: string | null;
};

export type MissingTransferFact = {
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
 * Parse Transfer destination facts (mirror Start Primary fields; no collaborationType).
 */
export function parseTransferPayload(
  payload: Record<string, unknown>,
): { facts: TransferPayloadFacts | null; missing: MissingTransferFact[] } {
  const missing: MissingTransferFact[] = [];

  const teamId = strField(payload, "teamId");
  if (!teamId) {
    missing.push({
      code: "MISSING_TEAM",
      messageFa: "تیم مقصد در پیش‌نویس الزامی است.",
    });
  }

  const organizationalRoleId = strField(payload, "organizationalRoleId");
  if (!organizationalRoleId) {
    missing.push({
      code: "MISSING_ORGANIZATIONAL_ROLE",
      messageFa: "نقش سازمانی مقصد در پیش‌نویس الزامی است.",
    });
  }

  const jobTitleId = strField(payload, "jobTitleId");
  if (!jobTitleId) {
    missing.push({
      code: "MISSING_JOB_TITLE",
      messageFa: "عنوان شغلی مقصد در پیش‌نویس الزامی است.",
    });
  }

  const ladderId = strField(payload, "ladderId");
  if (!ladderId) {
    missing.push({
      code: "MISSING_LADDER",
      messageFa: "لدر مقصد در پیش‌نویس الزامی است.",
    });
  }

  const gradeId = strField(payload, "gradeId");
  if (!gradeId) {
    missing.push({
      code: "MISSING_GRADE",
      messageFa: "گرید مقصد در پیش‌نویس الزامی است.",
    });
  }

  if (missing.length > 0) {
    return { facts: null, missing };
  }

  return {
    facts: {
      teamId: teamId!,
      organizationalRoleId: organizationalRoleId!,
      jobTitleId: jobTitleId!,
      ladderId: ladderId!,
      gradeId: gradeId!,
      seniorityId: strField(payload, "seniorityId"),
      capacitySlotId: strField(payload, "capacitySlotId"),
      headcountApprovalId: strField(payload, "headcountApprovalId"),
      headcountExempt: payload.headcountExempt === true,
      headcountOverride: payload.headcountOverride === true,
      headcountOverrideReason: strField(payload, "headcountOverrideReason"),
      headcountViolatedRule: (() => {
        const v = strField(payload, "headcountViolatedRule");
        if (
          v === "shortage" ||
          v === "validity" ||
          v === "job_title" ||
          v === "seniority"
        ) {
          return v;
        }
        return null;
      })(),
      headcountOverrideActorId: strField(payload, "headcountOverrideActorId"),
      employmentId: strField(payload, "employmentId"),
    },
    missing: [],
  };
}

function buildTransferOverrideContext(
  facts: TransferPayloadFacts,
): OverrideMutateContext | null {
  if (!facts.headcountOverride) return null;
  const reason = facts.headcountOverrideReason?.trim() ?? "";
  const actor = facts.headcountOverrideActorId?.trim() ?? "";
  if (!reason || !actor) return null;
  return {
    violatedRule: facts.headcountViolatedRule ?? "shortage",
    reason,
    actorAccountId: actor,
    teamId: facts.teamId,
    jobTitleId: facts.jobTitleId,
    seniorityId: facts.seniorityId,
    approvalId: facts.headcountApprovalId,
  };
}

/** Destination ≡ source Primary → no-op (FR-22). */
export function isTransferNoop(
  source: PrimaryAssignmentRecord,
  dest: TransferPayloadFacts,
): boolean {
  const senEq =
    (source.seniorityId ?? null) === (dest.seniorityId ?? null);
  return (
    source.teamId === dest.teamId &&
    source.organizationalRoleId === dest.organizationalRoleId &&
    source.jobTitleId === dest.jobTitleId &&
    source.ladderId === dest.ladderId &&
    source.gradeId === dest.gradeId &&
    senEq
  );
}

export function transferFactsAsStartFacts(
  facts: TransferPayloadFacts,
): StartReturnPayloadFacts {
  return {
    collaborationType: "employee",
    teamId: facts.teamId,
    organizationalRoleId: facts.organizationalRoleId,
    jobTitleId: facts.jobTitleId,
    ladderId: facts.ladderId,
    gradeId: facts.gradeId,
    seniorityId: facts.seniorityId,
    capacitySlotId: facts.capacitySlotId,
    headcountApprovalId: facts.headcountApprovalId,
    headcountExempt: facts.headcountExempt,
    headcountOverride: facts.headcountOverride,
    headcountOverrideReason: facts.headcountOverrideReason,
    headcountViolatedRule: facts.headcountViolatedRule,
    headcountOverrideActorId: facts.headcountOverrideActorId,
  };
}

export { findInactiveRefConflicts, capacityResultToConflict };

export type TransferSource = {
  personId: string;
  effectiveDate: string;
  payload: Record<string, unknown>;
  employmentId: string | null;
};

export async function resolveTransferSource(
  ctx: ProjectionRefreshContext,
): Promise<TransferSource | null> {
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

export type TransferIncompatibleFutureEvent = {
  id: string;
  eventType: string;
  effectiveDate: string;
  status: string;
};

/**
 * Peer Scheduled events incompatible with Transfer — explicit Cancel required.
 */
export async function findIncompatibleFutureEventsForTransfer(
  client: Pool | PoolClient,
  opts: {
    personId: string;
    employmentId: string | null;
    transferEffectiveDate: string;
    excludeEventId?: string | null;
  },
): Promise<TransferIncompatibleFutureEvent[]> {
  const peerTypes = [
    ...START_RETURN_EVENT_TYPES,
    PRODUCT_TRANSFER_EVENT_TYPE,
    PEER_TERMINATION_EVENT_TYPE,
  ];
  const rows = await client.query<{
    id: string;
    event_type: string;
    effective_date: Date | string;
    status: string;
  }>(
    `SELECT e.id, e.event_type, e.effective_date, e.status
     FROM kernel_events e
     WHERE e.event_class = 'business'
       AND e.person_id = $1::uuid
       AND e.status = 'Scheduled'
       AND ($2::uuid IS NULL OR e.id <> $2::uuid)
       AND NOT EXISTS (
         SELECT 1 FROM kernel_events c WHERE c.cancels_event_id = e.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM kernel_events r WHERE r.reverses_event_id = e.id
       )
       AND e.effective_date >= $3::date
       AND e.event_type = ANY($4::text[])
       AND (
         $5::uuid IS NULL
         OR e.employment_id IS NULL
         OR e.employment_id = $5::uuid
       )
     ORDER BY e.effective_date ASC, e.id ASC`,
    [
      opts.personId,
      opts.excludeEventId ?? null,
      opts.transferEffectiveDate,
      peerTypes,
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

export function incompatibleTransferFutureToConflict(
  events: TransferIncompatibleFutureEvent[],
): { code: string; severity: "blocking"; messageFa: string } | null {
  if (events.length === 0) return null;
  const list = events
    .map(
      (e) =>
        `${e.eventType} (${e.id.slice(0, 8)}…) تاریخ ${e.effectiveDate}`,
    )
    .join("؛ ");
  return {
    code: "INCOMPATIBLE_FUTURE_EVENTS",
    severity: "blocking",
    messageFa: `رویدادهای آینده ناسازگار باید قبل از انتقال صریحاً لغو شوند: ${list}`,
  };
}

export type TransferApplyResult = {
  employmentId: string;
  sourcePrimaryId: string | null;
  destinationPrimaryId: string | null;
  endDateExclusive: string;
  previousSourceEnd: string | null;
  mutated: boolean;
  didCloseSource: boolean;
  didOpenDest: boolean;
  didReleaseSource: boolean;
  didMoveDestCapacity: boolean;
  reservedOnly: boolean;
};

/**
 * True when Transfer storage is still Scheduled and no destination Primary
 * was opened for this event (reservation-only / effect not yet applied).
 */
export async function isTransferEffectUnapplied(
  transferEventId: string,
  db: PrismaClient = getPersonDb(),
): Promise<boolean> {
  const dest = await db.primaryAssignment.findFirst({
    where: { sourceEventId: transferEventId },
    select: { id: true },
  });
  return dest == null;
}

/**
 * Scheduled path: reserve destination capacity only (FR-16 / FR-30).
 */
export async function applyTransferScheduledReserve(
  ctx: ProjectionRefreshContext,
  db: PrismaClient = getPersonDb(),
): Promise<TransferApplyResult> {
  const source = await resolveTransferSource(ctx);
  if (!source) {
    throw new PersonnelEventError(
      "VALIDATION",
      "منبع رویداد انتقال یافت نشد.",
      "missing_source",
    );
  }

  const { facts, missing } = parseTransferPayload(source.payload);
  if (!facts || missing.length > 0) {
    throw new PersonnelEventError(
      "VALIDATION",
      missing[0]?.messageFa ?? "واقعیت‌های مقصد ناقص است.",
      "missing_facts",
    );
  }

  const employmentId =
    source.employmentId?.trim() || facts.employmentId?.trim() || "";
  if (employmentId) {
    const sourcePrimary = await getActivePrimaryAssignmentAsOf(
      employmentId,
      source.effectiveDate,
      db,
    );
    if (sourcePrimary && isTransferNoop(sourcePrimary, facts)) {
      throw new PersonnelEventError(
        "VALIDATION",
        "مقصد با انتصاب اولیه فعلی یکسان است؛ انتقال بی‌اثر مجاز نیست.",
        "TRANSFER_NOOP",
      );
    }
  }

  const slotId = facts.capacitySlotId;
  if (!facts.headcountExempt) {
    if (!slotId) {
      throw new PersonnelEventError(
        "VALIDATION",
        "شناسه اسلات ظرفیت مقصد برای رزرو الزامی است.",
        "missing_capacity_slot",
      );
    }

    const overrideCtx = buildTransferOverrideContext(facts);
    if (facts.headcountOverride && !overrideCtx) {
      throw new PersonnelEventError(
        "VALIDATION",
        "دلیل و عامل لغو محدودیت ظرفیت برای رزرو الزامی است.",
        "incomplete_headcount_override",
      );
    }
    const skipExceptionForValidityOverride =
      overrideCtx != null && overrideCtx.violatedRule === "validity";
    if (!skipExceptionForValidityOverride) {
      const exception = await detectScheduledHeadcountException(ctx.client, {
        approvalId: facts.headcountApprovalId,
        slotId,
        evaluationDate: source.effectiveDate,
        teamId: facts.teamId,
        jobTitleId: facts.jobTitleId,
        seniorityId: facts.seniorityId,
      });
      if (exception.exception) {
        await upsertScheduledExceptionMarker(ctx.client, {
          eventId: ctx.eventId,
          marker: exception.marker,
        });
        throw new PersonnelEventError(
          "VALIDATION",
          exception.marker.messageFa,
          exception.marker.code,
        );
      }
    }

    if (overrideCtx) {
      await reserveHeadcountCapacityWithOverride(ctx.client, {
        slotId,
        eventId: ctx.eventId,
        personId: source.personId,
        evaluationDate: source.effectiveDate,
        override: {
          ...overrideCtx,
          skipApprovalGate: overrideCtx.violatedRule === "validity",
        },
      });
    } else {
      await reserveHeadcountCapacity(ctx.client, {
        slotId,
        eventId: ctx.eventId,
        personId: source.personId,
        evaluationDate: source.effectiveDate,
      });
    }
  }

  return {
    employmentId,
    sourcePrimaryId: null,
    destinationPrimaryId: null,
    endDateExclusive: source.effectiveDate,
    previousSourceEnd: null,
    mutated: false,
    didCloseSource: false,
    didOpenDest: false,
    didReleaseSource: false,
    didMoveDestCapacity: false,
    reservedOnly: true,
  };
}

/**
 * Cancel of Scheduled Transfer — release reservation (idempotent).
 */
export async function releaseTransferReservationOnCancel(
  client: PoolClient,
  transferEventId: string,
): Promise<void> {
  await releaseHeadcountReservation(client, transferEventId);
}

/**
 * Effective path: close source Primary → open dest → coverage → capacity move.
 */
export async function applyTransferProjections(
  ctx: ProjectionRefreshContext,
  db: PrismaClient = getPersonDb(),
): Promise<TransferApplyResult> {
  if (!TRANSFER_EVENT_TYPES.has(ctx.eventType)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "نوع رویداد انتقال نیست.",
      "not_transfer",
    );
  }

  const source = await resolveTransferSource(ctx);
  if (!source) {
    throw new PersonnelEventError(
      "VALIDATION",
      "منبع رویداد انتقال یافت نشد.",
      "missing_source",
    );
  }

  const { facts, missing } = parseTransferPayload(source.payload);
  if (!facts || missing.length > 0) {
    throw new PersonnelEventError(
      "VALIDATION",
      missing[0]?.messageFa ?? "واقعیت‌های مقصد ناقص است.",
      "missing_facts",
    );
  }

  const employmentId =
    source.employmentId?.trim() || facts.employmentId?.trim() || null;
  if (!employmentId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "شناسه همکاری برای انتقال الزامی است.",
      "missing_employment",
    );
  }

  const employment = await getEmploymentById(employmentId, db);
  if (!employment || employment.personId !== source.personId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "سابقه همکاری هدف یافت نشد یا متعلق به این فرد نیست.",
      "employment_not_found",
    );
  }
  if (!isEmploymentActiveAsOf(employment, source.effectiveDate)) {
    // Half-open: Transfer ED must still see Employment active (Employment usually stays open)
    // Active ⇔ start ≤ ED < endExclusive. If already closed before ED, block.
    throw new PersonnelEventError(
      "VALIDATION",
      "همکاری در تاریخ مؤثر انتقال فعال نیست.",
      "employment_inactive",
    );
  }

  // Idempotent: dest Primary already opened for this Transfer event
  const existingDest = await db.primaryAssignment.findFirst({
    where: { sourceEventId: ctx.eventId },
  });
  if (existingDest) {
    let didReleaseSource = false;
    let didMoveDestCapacity = false;
    try {
      const primaries = await listPrimaryAssignmentsForEmployment(
        employmentId,
        db,
      );
      const closedSource =
        primaries.find(
          (p) =>
            p.id !== existingDest.id &&
            p.endDateExclusive === source.effectiveDate,
        ) ?? null;
      if (!closedSource) {
        throw new PersonnelEventError(
          "VALIDATION",
          "وضعیت انتصاب اولیه انتقال ناسازگار است (مقصد بدون بستن مبدأ).",
          "inconsistent_transfer_projection_state",
        );
      }
      const capacity = await moveTransferCapacity(
        ctx,
        source.personId,
        facts,
        closedSource,
        source.effectiveDate,
      );
      didReleaseSource = capacity.didReleaseSource;
      didMoveDestCapacity = capacity.didMoveDest;
      return {
        employmentId,
        sourcePrimaryId: closedSource.id,
        destinationPrimaryId: existingDest.id,
        endDateExclusive: source.effectiveDate,
        previousSourceEnd: null,
        mutated: false,
        didCloseSource: false,
        didOpenDest: false,
        didReleaseSource,
        didMoveDestCapacity,
        reservedOnly: false,
      };
    } catch (err) {
      await compensateTransferApply(
        {
          client: ctx.client,
          employmentId,
          endDateExclusive: source.effectiveDate,
          sourcePrimaryId: null,
          previousSourceEnd: null,
          destinationPrimaryId: null,
          transferEventId: ctx.eventId,
          didCloseSource: false,
          didOpenDest: false,
          didReleaseSource,
          didMoveDestCapacity,
        },
        db,
      );
      mapTransferError(err);
    }
  }

  const sourcePrimary = await getActivePrimaryAssignmentAsOf(
    employmentId,
    source.effectiveDate,
    db,
  );

  if (!sourcePrimary) {
    throw new PersonnelEventError(
      "VALIDATION",
      "انتصاب اولیه مبدأ برای انتقال یافت نشد.",
      "missing_source_primary",
    );
  }

  if (isTransferNoop(sourcePrimary, facts)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "مقصد با انتصاب اولیه فعلی یکسان است؛ انتقال بی‌اثر مجاز نیست.",
      "TRANSFER_NOOP",
    );
  }

  let didCloseSource = false;
  let didOpenDest = false;
  let destPrimaryId: string | null = null;
  let didReleaseSource = false;
  let didMoveDestCapacity = false;
  const previousEnd = sourcePrimary.endDateExclusive;
  const openSource = sourcePrimary;

  try {
    let closedInTxn = false;
    let openedDestId: string | null = null;

    await db.$transaction(async (tx) => {
      if (
        openSource.endDateExclusive === null ||
        openSource.endDateExclusive > source.effectiveDate
      ) {
        if (openSource.endDateExclusive !== source.effectiveDate) {
          await closePrimaryAssignmentProjection(
            openSource.id,
            source.effectiveDate,
            tx as PrismaClient,
          );
          closedInTxn = true;
        }
      }

      const dest = await applyPrimaryAssignmentProjection(
        {
          employmentId,
          teamId: facts.teamId,
          organizationalRoleId: facts.organizationalRoleId,
          jobTitleId: facts.jobTitleId,
          ladderId: facts.ladderId,
          gradeId: facts.gradeId,
          seniorityId: facts.seniorityId,
          startDate: source.effectiveDate,
          endDateExclusive: null,
          sourceEventId: ctx.eventId,
          headcountApprovalId: facts.headcountExempt
            ? null
            : facts.headcountApprovalId,
        },
        tx as PrismaClient,
      );
      openedDestId = dest.id;

      // Coverage AFTER close+open only (same txn)
      const primaries = await listPrimaryAssignmentsForEmployment(
        employmentId,
        tx as PrismaClient,
      );
      assertPrimaryCoverageForActiveEmployment(employment, primaries);
    });

    didCloseSource = closedInTxn;
    didOpenDest = openedDestId != null;
    destPrimaryId = openedDestId;

    const capacity = await moveTransferCapacity(
      ctx,
      source.personId,
      facts,
      openSource,
      source.effectiveDate,
    );
    didReleaseSource = capacity.didReleaseSource;
    didMoveDestCapacity = capacity.didMoveDest;

    return {
      employmentId,
      sourcePrimaryId: openSource.id,
      destinationPrimaryId: destPrimaryId,
      endDateExclusive: source.effectiveDate,
      previousSourceEnd: previousEnd,
      mutated: didCloseSource || didOpenDest,
      didCloseSource,
      didOpenDest,
      didReleaseSource,
      didMoveDestCapacity,
      reservedOnly: false,
    };
  } catch (err) {
    await compensateTransferApply(
      {
        client: ctx.client,
        employmentId,
        endDateExclusive: source.effectiveDate,
        sourcePrimaryId: openSource.id,
        previousSourceEnd: previousEnd,
        destinationPrimaryId: destPrimaryId,
        transferEventId: ctx.eventId,
        didCloseSource,
        didOpenDest,
        didReleaseSource,
        didMoveDestCapacity,
      },
      db,
    );
    mapTransferError(err);
  }
}

async function moveTransferCapacity(
  ctx: ProjectionRefreshContext,
  personId: string,
  facts: TransferPayloadFacts,
  sourcePrimary: PrimaryAssignmentRecord,
  evaluationDate: string,
): Promise<{ didReleaseSource: boolean; didMoveDest: boolean }> {
  let didReleaseSource = false;
  let didMoveDest = false;

  try {
    if (!sourcePrimary.sourceEventId) {
      throw new PersonnelEventError(
        "VALIDATION",
        "انتصاب اولیه مبدأ به رویداد مصرف ظرفیت پیوند ندارد؛ آزادسازی مبدأ ممکن نیست.",
        "missing_source_consumption_link",
      );
    }

    const releaseResult = await releaseHeadcountCapacity(ctx.client, {
      releaseEventId: ctx.eventId,
      personId,
      consumeEventIds: [sourcePrimary.sourceEventId],
      requireConsumption: false,
    });
    didReleaseSource = releaseResult.released;

    if (facts.headcountExempt) {
      return { didReleaseSource, didMoveDest };
    }

    const overrideCtx = buildTransferOverrideContext(facts);
    if (facts.headcountOverride && !overrideCtx) {
      throw new PersonnelEventError(
        "VALIDATION",
        "دلیل و عامل لغو محدودیت ظرفیت برای ادامه الزامی است.",
        "incomplete_headcount_override",
      );
    }

    const slotForDetect = facts.capacitySlotId;
    const skipExceptionForValidityOverride =
      overrideCtx != null && overrideCtx.violatedRule === "validity";
    if (slotForDetect && !skipExceptionForValidityOverride) {
      const exception = await detectScheduledHeadcountException(ctx.client, {
        approvalId: facts.headcountApprovalId,
        slotId: slotForDetect,
        evaluationDate,
        teamId: facts.teamId,
        jobTitleId: facts.jobTitleId,
        seniorityId: facts.seniorityId,
      });
      if (exception.exception) {
        await upsertScheduledExceptionMarker(ctx.client, {
          eventId: ctx.eventId,
          marker: exception.marker,
        });
        throw new PersonnelEventError(
          "VALIDATION",
          exception.marker.messageFa,
          exception.marker.code,
        );
      }
    }

    const converted = await convertReservationToConsumption(ctx.client, {
      eventId: ctx.eventId,
      personId,
    });
    if (converted.converted) {
      if (overrideCtx) {
        await ensureOverrideRowAfterConvert(ctx.client, {
          eventId: ctx.eventId,
          slotId: converted.slotId ?? facts.capacitySlotId!,
          override: overrideCtx,
        });
      }
      didMoveDest = true;
      return { didReleaseSource, didMoveDest };
    }

    const slotId = facts.capacitySlotId ?? converted.slotId;
    if (!slotId) {
      throw new PersonnelEventError(
        "VALIDATION",
        "شناسه اسلات ظرفیت مقصد برای مصرف الزامی است.",
        "missing_dest_capacity",
      );
    }

    if (overrideCtx) {
      const consumeResult = await consumeHeadcountCapacityWithOverride(
        ctx.client,
        {
          slotId,
          eventId: ctx.eventId,
          personId,
          evaluationDate,
          override: {
            ...overrideCtx,
            skipApprovalGate: overrideCtx.violatedRule === "validity",
          },
        },
      );
      didMoveDest = consumeResult.consumed;
    } else {
      const consumeResult = await consumeHeadcountCapacity(ctx.client, {
        slotId,
        eventId: ctx.eventId,
        personId,
        evaluationDate,
      });
      didMoveDest = consumeResult.consumed;
    }
    return { didReleaseSource, didMoveDest };
  } catch (err) {
    // Undo capacity side-effects before outer Primary compensate sees stale flags
    if (didMoveDest) {
      await undoTransferDestinationCapacity(ctx.client, ctx.eventId);
    }
    if (didReleaseSource) {
      await undoHeadcountRelease(ctx.client, ctx.eventId);
    }
    throw err;
  }
}

/**
 * Reverse / compensate Effective or reserved-only Transfer domain effects.
 */
export async function undoTransferApply(
  client: PoolClient,
  target: {
    id: string;
    effectiveDate: string;
    employmentId: string | null;
  },
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const dest = await db.primaryAssignment.findFirst({
    where: { sourceEventId: target.id },
  });

  if (dest) {
    await undoTransferDestinationCapacity(client, target.id);
    await undoHeadcountRelease(client, target.id);

    const endDb = dateOnlyToDb(target.effectiveDate);
    const closedSource = await db.primaryAssignment.findFirst({
      where: {
        employmentId: dest.employmentId,
        id: { not: dest.id },
        endDateExclusive: endDb,
      },
      orderBy: { startDate: "desc" },
    });

    await db.$transaction(async (tx) => {
      await tx.primaryAssignment.deleteMany({ where: { id: dest.id } });
      if (closedSource) {
        await tx.primaryAssignment.updateMany({
          where: { id: closedSource.id, endDateExclusive: endDb },
          data: { endDateExclusive: null },
        });
      }
    });
  }

  // Reserved-only or restored-to-reserved after undo dest → release
  await releaseHeadcountReservation(client, target.id);
}

export async function compensateTransferApply(
  opts: {
    client: PoolClient;
    employmentId: string;
    endDateExclusive: string;
    sourcePrimaryId: string | null;
    previousSourceEnd: string | null;
    destinationPrimaryId: string | null;
    transferEventId: string;
    didCloseSource: boolean;
    didOpenDest: boolean;
    didReleaseSource: boolean;
    didMoveDestCapacity: boolean;
  },
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  try {
    if (opts.didMoveDestCapacity) {
      await undoTransferDestinationCapacity(opts.client, opts.transferEventId);
    }
    if (opts.didReleaseSource) {
      await undoHeadcountRelease(opts.client, opts.transferEventId);
    }
    if (opts.didOpenDest && opts.destinationPrimaryId) {
      await db.primaryAssignment.deleteMany({
        where: { id: opts.destinationPrimaryId },
      });
    }
    if (opts.didCloseSource && opts.sourcePrimaryId) {
      const endDb = dateOnlyToDb(opts.endDateExclusive);
      await db.primaryAssignment.updateMany({
        where: { id: opts.sourcePrimaryId, endDateExclusive: endDb },
        data: {
          endDateExclusive: opts.previousSourceEnd
            ? dateOnlyToDb(opts.previousSourceEnd)
            : null,
        },
      });
    }
  } catch {
    // Best-effort
  }
}

function mapTransferError(err: unknown): never {
  if (err instanceof PersonnelEventError) throw err;
  if (err instanceof PrimaryAssignmentError) {
    throw new PersonnelEventError("VALIDATION", err.messageFa, err.code);
  }
  if (err instanceof Error) {
    const msg = err.message;
    if (
      msg.includes("ظرفیت") ||
      msg.includes("رزرو") ||
      msg.includes("مصرف") ||
      msg.includes("آزادسازی")
    ) {
      throw new PersonnelEventError("VALIDATION", msg, "headcount_transfer");
    }
  }
  throw err;
}

export type { CapacityCheckResult, PersonnelEventDraftRecord };
