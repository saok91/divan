/**
 * Job / level personnel event helpers (Story 4.8 / FR-23).
 * Product path = Draft → Finalize → projection hook — no public changeGrade / changeTitle verbs.
 * Same-team Primary close+open; Team move remains TransferRecorded.
 */

import type { Pool, PoolClient, PrismaClient } from "@divan/db";
import { getBusinessEventById } from "@divan/event-store";
import {
  consumeHeadcountCapacity,
  convertReservationToConsumption,
  releaseHeadcountCapacity,
  releaseHeadcountReservation,
  reserveHeadcountCapacity,
  undoHeadcountRelease,
  undoTransferDestinationCapacity,
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
import { getGradeById } from "./job-reference";

export const PRODUCT_ORG_ROLE_CHANGED = "OrganizationalRoleChanged";
export const PRODUCT_JOB_TITLE_CHANGED = "JobTitleChanged";
export const PRODUCT_SENIORITY_CHANGED = "SeniorityChanged";
export const PRODUCT_LADDER_CHANGED = "LadderChanged";
export const PRODUCT_GRADE_CHANGED = "GradeChanged";
export const PRODUCT_PROMOTION_RECORDED = "PromotionRecorded";

export const JOB_LEVEL_EVENT_TYPES = new Set([
  PRODUCT_ORG_ROLE_CHANGED,
  PRODUCT_JOB_TITLE_CHANGED,
  PRODUCT_SENIORITY_CHANGED,
  PRODUCT_LADDER_CHANGED,
  PRODUCT_GRADE_CHANGED,
  PRODUCT_PROMOTION_RECORDED,
]);

/** Title only — Grade/Role/Ladder/Promotion never mutate capacity.
 * SeniorityChanged updates Primary facts only until AR-HEADCOUNT adds seniority
 * matching (code-review Decision B / Story 4.8).
 */
export const JOB_LEVEL_CAPACITY_EVENT_TYPES = new Set([
  PRODUCT_JOB_TITLE_CHANGED,
]);

const PEER_TERMINATION_EVENT_TYPE = "EmploymentTerminated";
const PEER_TRANSFER_EVENT_TYPE = "TransferRecorded";

export type JobLevelOverlayFacts = {
  employmentId: string | null;
  organizationalRoleId: string | null;
  jobTitleId: string | null;
  ladderId: string | null;
  gradeId: string | null;
  seniorityId: string | null;
  /** Present when client attempted a team change — conflicts → USE_TRANSFER. */
  teamId: string | null;
  capacitySlotId: string | null;
};

export type JobLevelSuccessorFacts = {
  teamId: string;
  organizationalRoleId: string;
  jobTitleId: string;
  ladderId: string;
  gradeId: string;
  seniorityId: string | null;
  capacitySlotId: string | null;
  employmentId: string | null;
};

export type MissingJobLevelFact = {
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
 * Parse job/level overlay (structural refs only). teamId if present is for USE_TRANSFER gate.
 */
export function parseJobLevelPayload(
  eventType: string,
  payload: Record<string, unknown>,
): { facts: JobLevelOverlayFacts | null; missing: MissingJobLevelFact[] } {
  const missing: MissingJobLevelFact[] = [];
  const employmentId = strField(payload, "employmentId");

  let organizationalRoleId: string | null = null;
  let jobTitleId: string | null = null;
  let ladderId: string | null = null;
  let gradeId: string | null = null;
  let seniorityId: string | null = null;

  if (eventType === PRODUCT_ORG_ROLE_CHANGED) {
    organizationalRoleId = strField(payload, "organizationalRoleId");
    if (!organizationalRoleId) {
      missing.push({
        code: "MISSING_ORGANIZATIONAL_ROLE",
        messageFa: "نقش سازمانی در پیش‌نویس الزامی است.",
      });
    }
  } else if (eventType === PRODUCT_JOB_TITLE_CHANGED) {
    jobTitleId = strField(payload, "jobTitleId");
    if (!jobTitleId) {
      missing.push({
        code: "MISSING_JOB_TITLE",
        messageFa: "عنوان شغلی در پیش‌نویس الزامی است.",
      });
    }
  } else if (eventType === PRODUCT_SENIORITY_CHANGED) {
    // Nullable clear allowed: key present as null/"" → clear; absent → missing
    if (!("seniorityId" in payload)) {
      missing.push({
        code: "MISSING_SENIORITY",
        messageFa: "ارشدیت در پیش‌نویس الزامی است (برای پاک‌کردن null بفرستید).",
      });
    } else {
      const v = payload.seniorityId;
      if (v === null || v === "") {
        seniorityId = null;
      } else if (typeof v === "string" && v.trim()) {
        seniorityId = v.trim();
      } else {
        missing.push({
          code: "MISSING_SENIORITY",
          messageFa: "مقدار ارشدیت نامعتبر است.",
        });
      }
    }
  } else if (eventType === PRODUCT_LADDER_CHANGED) {
    ladderId = strField(payload, "ladderId");
    gradeId = strField(payload, "gradeId");
    if (!ladderId) {
      missing.push({
        code: "MISSING_LADDER",
        messageFa: "لدر در پیش‌نویس الزامی است.",
      });
    }
    if (!gradeId) {
      missing.push({
        code: "MISSING_GRADE",
        messageFa: "گرید معتبر برای لدر جدید الزامی است.",
      });
    }
  } else if (eventType === PRODUCT_GRADE_CHANGED) {
    gradeId = strField(payload, "gradeId");
    ladderId = strField(payload, "ladderId");
    if (!gradeId) {
      missing.push({
        code: "MISSING_GRADE",
        messageFa: "گرید در پیش‌نویس الزامی است.",
      });
    }
  } else if (eventType === PRODUCT_PROMOTION_RECORDED) {
    gradeId = strField(payload, "gradeId");
    ladderId = strField(payload, "ladderId");
    if (!gradeId) {
      missing.push({
        code: "MISSING_GRADE",
        messageFa: "نتیجه ارتقا نیازمند گرید نهایی است.",
      });
    }
  } else {
    missing.push({
      code: "UNKNOWN_JOB_LEVEL_TYPE",
      messageFa: "نوع رویداد شغلی/سطحی ناشناخته است.",
    });
  }

  if (missing.length > 0) {
    return { facts: null, missing };
  }

  return {
    facts: {
      employmentId,
      organizationalRoleId,
      jobTitleId,
      ladderId,
      gradeId,
      seniorityId:
        eventType === PRODUCT_SENIORITY_CHANGED
          ? seniorityId
          : strField(payload, "seniorityId"),
      teamId: strField(payload, "teamId"),
      capacitySlotId: strField(payload, "capacitySlotId"),
    },
    missing: [],
  };
}

/** Overlay allowed fields onto source Primary; teamId always from source. */
export function resolveSuccessorPrimary(
  source: PrimaryAssignmentRecord,
  eventType: string,
  overlay: JobLevelOverlayFacts,
): JobLevelSuccessorFacts {
  const base: JobLevelSuccessorFacts = {
    teamId: source.teamId,
    organizationalRoleId: source.organizationalRoleId,
    jobTitleId: source.jobTitleId,
    ladderId: source.ladderId,
    gradeId: source.gradeId,
    seniorityId: source.seniorityId,
    capacitySlotId: overlay.capacitySlotId,
    employmentId: overlay.employmentId,
  };

  if (eventType === PRODUCT_ORG_ROLE_CHANGED && overlay.organizationalRoleId) {
    base.organizationalRoleId = overlay.organizationalRoleId;
  }
  if (eventType === PRODUCT_JOB_TITLE_CHANGED && overlay.jobTitleId) {
    base.jobTitleId = overlay.jobTitleId;
  }
  if (eventType === PRODUCT_SENIORITY_CHANGED) {
    base.seniorityId = overlay.seniorityId;
  }
  if (eventType === PRODUCT_LADDER_CHANGED) {
    if (overlay.ladderId) base.ladderId = overlay.ladderId;
    if (overlay.gradeId) base.gradeId = overlay.gradeId;
  }
  if (
    eventType === PRODUCT_GRADE_CHANGED ||
    eventType === PRODUCT_PROMOTION_RECORDED
  ) {
    if (overlay.gradeId) base.gradeId = overlay.gradeId;
    if (overlay.ladderId) base.ladderId = overlay.ladderId;
  }

  return base;
}

export function isJobFactsNoop(
  source: PrimaryAssignmentRecord,
  successor: JobLevelSuccessorFacts,
): boolean {
  return (
    source.teamId === successor.teamId &&
    source.organizationalRoleId === successor.organizationalRoleId &&
    source.jobTitleId === successor.jobTitleId &&
    source.ladderId === successor.ladderId &&
    source.gradeId === successor.gradeId &&
    (source.seniorityId ?? null) === (successor.seniorityId ?? null)
  );
}

/** Capacity match dimensions currently in `@divan/headcount`: Team + Job Title.
 * Seniority is a Primary fact only until AR-HEADCOUNT (Decision B / 4.8 review).
 */
export function matchingBucketChanged(
  source: PrimaryAssignmentRecord,
  successor: JobLevelSuccessorFacts,
): boolean {
  return (
    source.teamId !== successor.teamId ||
    source.jobTitleId !== successor.jobTitleId
  );
}

export function jobLevelFactsAsStartFacts(
  facts: JobLevelSuccessorFacts,
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
  };
}

export { findInactiveRefConflicts, capacityResultToConflict };

export type JobLevelSource = {
  personId: string;
  effectiveDate: string;
  payload: Record<string, unknown>;
  employmentId: string | null;
  eventType: string;
  draftId: string | null;
};

export async function resolveJobLevelSource(
  ctx: ProjectionRefreshContext,
): Promise<JobLevelSource | null> {
  if (ctx.draft) {
    return {
      personId: ctx.draft.personId,
      effectiveDate: ctx.draft.effectiveDate,
      payload: ctx.draft.payload,
      employmentId: ctx.draft.employmentId,
      eventType: ctx.eventType,
      draftId: ctx.draft.id,
    };
  }
  const event = await getBusinessEventById(ctx.client, ctx.eventId);
  if (!event) return null;
  return {
    personId: event.personId,
    effectiveDate: event.effectiveDate,
    payload: event.payload,
    employmentId: event.employmentId,
    eventType: event.eventType,
    draftId: null,
  };
}

export type JobLevelIncompatibleFutureEvent = {
  id: string;
  eventType: string;
  effectiveDate: string;
  status: string;
};

export async function findIncompatibleFutureEventsForJobLevel(
  client: Pool | PoolClient,
  opts: {
    personId: string;
    employmentId: string | null;
    effectiveDate: string;
    excludeEventId?: string | null;
  },
): Promise<JobLevelIncompatibleFutureEvent[]> {
  const peerTypes = [
    ...START_RETURN_EVENT_TYPES,
    ...JOB_LEVEL_EVENT_TYPES,
    PEER_TRANSFER_EVENT_TYPE,
    PEER_TERMINATION_EVENT_TYPE,
    "CompensationChanged",
    "ContractChanged",
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
      opts.effectiveDate,
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

export function incompatibleJobLevelFutureToConflict(
  events: JobLevelIncompatibleFutureEvent[],
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
    messageFa: `رویدادهای آینده ناسازگار باید قبل از تغییر شغلی صریحاً لغو شوند: ${list}`,
  };
}

export type JobLevelApplyResult = {
  employmentId: string;
  sourcePrimaryId: string | null;
  successorPrimaryId: string | null;
  endDateExclusive: string;
  previousSourceEnd: string | null;
  mutated: boolean;
  didCloseSource: boolean;
  didOpenSuccessor: boolean;
  didReleaseSource: boolean;
  didMoveDestCapacity: boolean;
  reservedOnly: boolean;
};

export async function isJobLevelEffectUnapplied(
  jobEventId: string,
  db: PrismaClient = getPersonDb(),
): Promise<boolean> {
  const dest = await db.primaryAssignment.findFirst({
    where: { sourceEventId: jobEventId },
    select: { id: true },
  });
  return dest == null;
}

/** Scheduled Title/Seniority: reserve when matching bucket changes (FR-16). */
export async function applyJobLevelScheduledReserve(
  ctx: ProjectionRefreshContext,
  db: PrismaClient = getPersonDb(),
): Promise<JobLevelApplyResult> {
  const source = await resolveJobLevelSource(ctx);
  if (!source) {
    throw new PersonnelEventError(
      "VALIDATION",
      "منبع رویداد شغلی یافت نشد.",
      "missing_source",
    );
  }

  if (!JOB_LEVEL_CAPACITY_EVENT_TYPES.has(source.eventType)) {
    return {
      employmentId: source.employmentId ?? "",
      sourcePrimaryId: null,
      successorPrimaryId: null,
      endDateExclusive: source.effectiveDate,
      previousSourceEnd: null,
      mutated: false,
      didCloseSource: false,
      didOpenSuccessor: false,
      didReleaseSource: false,
      didMoveDestCapacity: false,
      reservedOnly: true,
    };
  }

  const { facts: overlay, missing } = parseJobLevelPayload(
    source.eventType,
    source.payload,
  );
  if (!overlay || missing.length > 0) {
    throw new PersonnelEventError(
      "VALIDATION",
      missing[0]?.messageFa ?? "واقعیت‌های شغلی ناقص است.",
      "missing_facts",
    );
  }

  const employmentId =
    source.employmentId?.trim() || overlay.employmentId?.trim() || "";
  if (!employmentId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "شناسه همکاری برای تغییر شغلی الزامی است.",
      "missing_employment",
    );
  }

  const sourcePrimary = await getActivePrimaryAssignmentAsOf(
    employmentId,
    source.effectiveDate,
    db,
  );
  if (!sourcePrimary) {
    throw new PersonnelEventError(
      "VALIDATION",
      "انتصاب اولیه مبدأ یافت نشد.",
      "missing_source_primary",
    );
  }

  const successor = resolveSuccessorPrimary(
    sourcePrimary,
    source.eventType,
    overlay,
  );
  if (isJobFactsNoop(sourcePrimary, successor)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "واقعیت‌های شغلی بدون تغییر است؛ رویداد بی‌اثر مجاز نیست.",
      "JOB_FACTS_NOOP",
    );
  }

  if (!matchingBucketChanged(sourcePrimary, successor)) {
    return {
      employmentId,
      sourcePrimaryId: null,
      successorPrimaryId: null,
      endDateExclusive: source.effectiveDate,
      previousSourceEnd: null,
      mutated: false,
      didCloseSource: false,
      didOpenSuccessor: false,
      didReleaseSource: false,
      didMoveDestCapacity: false,
      reservedOnly: true,
    };
  }

  const slotId = overlay.capacitySlotId ?? successor.capacitySlotId;
  if (!slotId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "شناسه اسلات ظرفیت برای رزرو الزامی است.",
      "missing_capacity_slot",
    );
  }

  await reserveHeadcountCapacity(ctx.client, {
    slotId,
    eventId: ctx.eventId,
    personId: source.personId,
    evaluationDate: source.effectiveDate,
  });

  return {
    employmentId,
    sourcePrimaryId: null,
    successorPrimaryId: null,
    endDateExclusive: source.effectiveDate,
    previousSourceEnd: null,
    mutated: false,
    didCloseSource: false,
    didOpenSuccessor: false,
    didReleaseSource: false,
    didMoveDestCapacity: false,
    reservedOnly: true,
  };
}

export async function releaseJobLevelReservationOnCancel(
  client: PoolClient,
  jobEventId: string,
): Promise<void> {
  await releaseHeadcountReservation(client, jobEventId);
}

async function moveJobLevelCapacity(
  ctx: ProjectionRefreshContext,
  personId: string,
  successor: JobLevelSuccessorFacts,
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

    const converted = await convertReservationToConsumption(ctx.client, {
      eventId: ctx.eventId,
      personId,
    });
    if (converted.converted) {
      didMoveDest = true;
      return { didReleaseSource, didMoveDest };
    }

    const slotId = successor.capacitySlotId ?? converted.slotId;
    if (!slotId) {
      throw new PersonnelEventError(
        "VALIDATION",
        "شناسه اسلات ظرفیت برای مصرف الزامی است.",
        "missing_dest_capacity",
      );
    }

    const consumeResult = await consumeHeadcountCapacity(ctx.client, {
      slotId,
      eventId: ctx.eventId,
      personId,
      evaluationDate,
    });
    didMoveDest = consumeResult.consumed;
    return { didReleaseSource, didMoveDest };
  } catch (err) {
    if (didMoveDest) {
      await undoTransferDestinationCapacity(ctx.client, ctx.eventId);
    }
    if (didReleaseSource) {
      await undoHeadcountRelease(ctx.client, ctx.eventId);
    }
    throw err;
  }
}

/** Effective: close source Primary → open successor → coverage → optional capacity. */
export async function applyJobLevelProjections(
  ctx: ProjectionRefreshContext,
  db: PrismaClient = getPersonDb(),
): Promise<JobLevelApplyResult> {
  if (!JOB_LEVEL_EVENT_TYPES.has(ctx.eventType)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "نوع رویداد شغلی/سطحی نیست.",
      "not_job_level",
    );
  }

  const source = await resolveJobLevelSource(ctx);
  if (!source) {
    throw new PersonnelEventError(
      "VALIDATION",
      "منبع رویداد شغلی یافت نشد.",
      "missing_source",
    );
  }

  const { facts: overlay, missing } = parseJobLevelPayload(
    source.eventType,
    source.payload,
  );
  if (!overlay || missing.length > 0) {
    throw new PersonnelEventError(
      "VALIDATION",
      missing[0]?.messageFa ?? "واقعیت‌های شغلی ناقص است.",
      "missing_facts",
    );
  }

  const employmentId =
    source.employmentId?.trim() || overlay.employmentId?.trim() || null;
  if (!employmentId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "شناسه همکاری برای تغییر شغلی الزامی است.",
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
    throw new PersonnelEventError(
      "VALIDATION",
      "همکاری در تاریخ مؤثر فعال نیست.",
      "employment_inactive",
    );
  }

  // Idempotent re-apply
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
          "وضعیت انتصاب اولیه شغلی ناسازگار است.",
          "inconsistent_job_level_projection_state",
        );
      }
      const successor: JobLevelSuccessorFacts = {
        teamId: existingDest.teamId,
        organizationalRoleId: existingDest.organizationalRoleId,
        jobTitleId: existingDest.jobTitleId,
        ladderId: existingDest.ladderId,
        gradeId: existingDest.gradeId,
        seniorityId: existingDest.seniorityId,
        capacitySlotId: overlay.capacitySlotId,
        employmentId,
      };
      if (
        JOB_LEVEL_CAPACITY_EVENT_TYPES.has(source.eventType) &&
        matchingBucketChanged(closedSource, successor)
      ) {
        const capacity = await moveJobLevelCapacity(
          ctx,
          source.personId,
          successor,
          closedSource,
          source.effectiveDate,
        );
        didReleaseSource = capacity.didReleaseSource;
        didMoveDestCapacity = capacity.didMoveDest;
      }
      return {
        employmentId,
        sourcePrimaryId: closedSource.id,
        successorPrimaryId: existingDest.id,
        endDateExclusive: source.effectiveDate,
        previousSourceEnd: null,
        mutated: false,
        didCloseSource: false,
        didOpenSuccessor: false,
        didReleaseSource,
        didMoveDestCapacity,
        reservedOnly: false,
      };
    } catch (err) {
      await compensateJobLevelApply(
        {
          client: ctx.client,
          employmentId,
          endDateExclusive: source.effectiveDate,
          sourcePrimaryId: null,
          previousSourceEnd: null,
          successorPrimaryId: null,
          jobEventId: ctx.eventId,
          didCloseSource: false,
          didOpenSuccessor: false,
          didReleaseSource,
          didMoveDestCapacity,
        },
        db,
      );
      mapJobLevelError(err);
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
      "انتصاب اولیه مبدأ یافت نشد.",
      "missing_source_primary",
    );
  }

  if (overlay.teamId && overlay.teamId !== sourcePrimary.teamId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "تغییر تیم از مسیر شغلی مجاز نیست؛ از TransferRecorded استفاده کنید.",
      "USE_TRANSFER",
    );
  }

  const successor = resolveSuccessorPrimary(
    sourcePrimary,
    source.eventType,
    overlay,
  );

  if (isJobFactsNoop(sourcePrimary, successor)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "واقعیت‌های شغلی بدون تغییر است؛ رویداد بی‌اثر مجاز نیست.",
      "JOB_FACTS_NOOP",
    );
  }

  // Ladder–Grade validity
  const grade = await getGradeById(successor.gradeId, db);
  if (!grade || grade.ladderId !== successor.ladderId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "گرید به لدر انتخاب‌شده تعلق ندارد.",
      "LADDER_GRADE_INVALID",
    );
  }

  let didCloseSource = false;
  let didOpenSuccessor = false;
  let successorPrimaryId: string | null = null;
  let didReleaseSource = false;
  let didMoveDestCapacity = false;
  const previousEnd = sourcePrimary.endDateExclusive;
  const openSource = sourcePrimary;

  try {
    let closedInTxn = false;
    let openedId: string | null = null;

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
          teamId: successor.teamId,
          organizationalRoleId: successor.organizationalRoleId,
          jobTitleId: successor.jobTitleId,
          ladderId: successor.ladderId,
          gradeId: successor.gradeId,
          seniorityId: successor.seniorityId,
          startDate: source.effectiveDate,
          endDateExclusive: null,
          sourceEventId: ctx.eventId,
        },
        tx as PrismaClient,
      );
      openedId = dest.id;

      const primaries = await listPrimaryAssignmentsForEmployment(
        employmentId,
        tx as PrismaClient,
      );
      assertPrimaryCoverageForActiveEmployment(employment, primaries);
    });

    didCloseSource = closedInTxn;
    didOpenSuccessor = openedId != null;
    successorPrimaryId = openedId;

    if (
      JOB_LEVEL_CAPACITY_EVENT_TYPES.has(source.eventType) &&
      matchingBucketChanged(openSource, successor)
    ) {
      const capacity = await moveJobLevelCapacity(
        ctx,
        source.personId,
        successor,
        openSource,
        source.effectiveDate,
      );
      didReleaseSource = capacity.didReleaseSource;
      didMoveDestCapacity = capacity.didMoveDest;
    }

    return {
      employmentId,
      sourcePrimaryId: openSource.id,
      successorPrimaryId,
      endDateExclusive: source.effectiveDate,
      previousSourceEnd: previousEnd,
      mutated: didCloseSource || didOpenSuccessor,
      didCloseSource,
      didOpenSuccessor,
      didReleaseSource,
      didMoveDestCapacity,
      reservedOnly: false,
    };
  } catch (err) {
    await compensateJobLevelApply(
      {
        client: ctx.client,
        employmentId,
        endDateExclusive: source.effectiveDate,
        sourcePrimaryId: openSource.id,
        previousSourceEnd: previousEnd,
        successorPrimaryId,
        jobEventId: ctx.eventId,
        didCloseSource,
        didOpenSuccessor,
        didReleaseSource,
        didMoveDestCapacity,
      },
      db,
    );
    mapJobLevelError(err);
  }
}

export async function undoJobLevelApply(
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

  await releaseHeadcountReservation(client, target.id);
}

export async function compensateJobLevelApply(
  opts: {
    client: PoolClient;
    employmentId: string;
    endDateExclusive: string;
    sourcePrimaryId: string | null;
    previousSourceEnd: string | null;
    successorPrimaryId: string | null;
    jobEventId: string;
    didCloseSource: boolean;
    didOpenSuccessor: boolean;
    didReleaseSource: boolean;
    didMoveDestCapacity: boolean;
  },
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  try {
    if (opts.didMoveDestCapacity) {
      await undoTransferDestinationCapacity(opts.client, opts.jobEventId);
    }
    if (opts.didReleaseSource) {
      await undoHeadcountRelease(opts.client, opts.jobEventId);
    }
    if (opts.didOpenSuccessor && opts.successorPrimaryId) {
      await db.primaryAssignment.deleteMany({
        where: { id: opts.successorPrimaryId },
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

function mapJobLevelError(err: unknown): never {
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
      throw new PersonnelEventError("VALIDATION", msg, "headcount_job_level");
    }
  }
  throw err;
}

export type { PersonnelEventDraftRecord };
