/**
 * Current / historical / planned Person state assembler (Stories 4.9–4.10 / FR-25 / FR-26).
 * Composes existing projection as-of helpers — does not replay the event log
 * and does not write a denormalized current-state or historical SoT table.
 */

import type { CategoryRegistry } from "@divan/audit-envelope";
import {
  getCompensationAsOf,
  getContractualAsOf,
  projectCompensationRecord,
  type CompensationFactRecord,
} from "@divan/compensation-facts";
import type { PrismaClient } from "@divan/db";
import {
  listBusinessEventsForPersonForApply,
  listChainLinksForEvents,
  type PgQueryable,
} from "@divan/event-store";
import {
  parseDateOnly,
  todayDateOnlyTehran,
} from "@divan/temporal-engine";

import { getBaselineBoundaryDate } from "./baseline-boundary";
import { getDisposalLimitDisclosure } from "./data-lifecycle";
import { getPersonDb } from "./db";
import { getActiveEmploymentAsOf, type EmploymentRecord } from "./employment";
import {
  MSG_ASOF_INVALID_FA,
  MSG_BASELINE_BOUNDARY_INVALID_FA,
  MSG_BASELINE_DISCLOSURE_LIMITED_FA,
  MSG_BASELINE_DISCLOSURE_UNCONFIGURED_FA,
  MSG_BASELINE_DISCLOSURE_WITHIN_FA,
  MSG_PERSON_NOT_FOUND_FA,
  PersonIdentityError,
} from "./errors";
import { getPersonById, type PersonRecord } from "./person";
import { projectPersonForRead } from "./person-projection";
import {
  getRecalculationStatus,
  type RecalculationRowStatus,
  type RecalcQueryable,
} from "./personnel-event-recalc";
import {
  resolveLifecycleStatus,
  type ResolvedLifecycleStatus,
} from "./personnel-event-resolve";
import {
  getActivePrimaryAssignmentAsOf,
  resolveTeamMembershipAsOf,
  type PrimaryAssignmentRecord,
  type TeamMembershipAsOf,
} from "./primary-assignment";
import {
  listActiveSecondaryAssignmentsAsOf,
  type SecondaryAssignmentRecord,
} from "./secondary-assignment";

export type CurrentPersonStateActorAuthz = {
  allowedCategories: ReadonlySet<string>;
  categories: CategoryRegistry;
  /** When false, compensation / contractual blocks are omitted entirely. */
  hasCompensationRead: boolean;
};

export type ScheduledFutureChange = {
  id: string;
  eventType: string;
  effectiveDate: string;
  resolvedStatus: Extract<ResolvedLifecycleStatus, "Scheduled">;
};

export type PersonViewSemantics = "current" | "historical" | "planned";

export type BaselineDisclosure = {
  configured: boolean;
  boundaryDate: string | null;
  limited: boolean;
  messageFa: string;
};

/** Story 7.3 — reconstruction honesty after disposal / anonymize. */
export type DisposalDisclosure = {
  limited: boolean;
  disposedFieldKeys: string[];
  messageFa: string | null;
};

export type CurrentPersonStateFreshnessCode =
  | "RECALCULATION_PENDING"
  | "RECALCULATION_FAILED"
  | "RECALCULATION_STALE";

export type CurrentPersonStateFreshnessBlock = {
  ok: false;
  code: CurrentPersonStateFreshnessCode;
  personId: string;
  status: RecalculationRowStatus;
  messageFa: string;
};

/**
 * Shared DTO for profile / list / report consumers (FR-25 / FR-26).
 * Compensation keys are absent (not null) when the actor lacks compensation.read.
 */
export type CurrentPersonState = {
  ok: true;
  asOf: string;
  personId: string;
  /** current = today; historical = past as-of; planned = future as-of (never Effective). */
  viewSemantics: PersonViewSemantics;
  baselineDisclosure: BaselineDisclosure;
  /** Present when operational fields were disposed/anonymized — never fabricate prior values. */
  disposalDisclosure: DisposalDisclosure;
  person: Partial<PersonRecord>;
  employment: EmploymentRecord | null;
  primaryAssignment: PrimaryAssignmentRecord | null;
  teamMembership: TeamMembershipAsOf | null;
  secondaryAssignments: SecondaryAssignmentRecord[];
  compensation?: Partial<CompensationFactRecord> | null;
  contractual?: Partial<CompensationFactRecord> | null;
  /**
   * Finalized events still pre-effect as of the view's evaluation date.
   * For planned views: events with effectiveDate > requested asOf.
   */
  scheduledChanges: ScheduledFutureChange[];
  /**
   * Planned channel (future as-of only): Finalized events with
   * today < effectiveDate <= asOf that are still Scheduled as of today.
   * Empty for current / historical views.
   */
  plannedChangesThroughAsOf: ScheduledFutureChange[];
};

export type GetCurrentPersonStateResult =
  | CurrentPersonState
  | CurrentPersonStateFreshnessBlock;

export type GetCurrentPersonStateOptions = {
  /** Defaults to today (Asia/Tehran date-only). Must be date-only when provided. */
  asOf?: string;
  actorAuthz: CurrentPersonStateActorAuthz;
  /**
   * Override Baseline boundary for tests / explicit policy.
   * When omitted, uses `getBaselineBoundaryDate()` (env).
   */
  baselineBoundaryDate?: string | null;
};

export type GetCurrentPersonStateDeps = {
  personDb?: PrismaClient;
  compensationDb?: PrismaClient;
  /** Pool / client for event-store + recalculation_status (not Prisma). */
  eventDb: PgQueryable & RecalcQueryable;
};

export const MSG_CURRENT_STATE_RECALC_PENDING_FA =
  "بازمحاسبهٔ این فرد در جریان است؛ وضعیت جاری به‌عنوان حقیقت قطعی ارائه نمی‌شود.";

export const MSG_CURRENT_STATE_RECALC_FAILED_FA =
  "بازمحاسبهٔ این فرد ناموفق بوده است؛ وضعیت جاری به‌عنوان حقیقت قطعی ارائه نمی‌شود.";

export const MSG_CURRENT_STATE_RECALC_STALE_FA =
  "وضعیت بازمحاسبهٔ این فرد کهنه است؛ وضعیت جاری به‌عنوان حقیقت قطعی ارائه نمی‌شود.";

/** Matches `listBusinessEventsForPersonForApply` max — refuse incomplete Scheduled scans. */
export const SCHEDULED_CHANGES_APPLY_LIMIT = 2000;

export const MSG_SCHEDULED_SCAN_TRUNCATED_FA =
  "مجموعهٔ رویدادهای این فرد برای فهرست تغییرات زمان‌بندی‌شده ناقص است؛ وضعیت جاری ارائه نمی‌شود.";

function freshnessCodeForStatus(
  status: RecalculationRowStatus,
): CurrentPersonStateFreshnessCode | null {
  if (status === "pending") return "RECALCULATION_PENDING";
  if (status === "failed") return "RECALCULATION_FAILED";
  if (status === "stale") return "RECALCULATION_STALE";
  return null;
}

function freshnessMessageFa(code: CurrentPersonStateFreshnessCode): string {
  if (code === "RECALCULATION_PENDING") return MSG_CURRENT_STATE_RECALC_PENDING_FA;
  if (code === "RECALCULATION_FAILED") return MSG_CURRENT_STATE_RECALC_FAILED_FA;
  return MSG_CURRENT_STATE_RECALC_STALE_FA;
}

export function buildBaselineDisclosure(
  asOf: string,
  boundaryDate: string | null,
): BaselineDisclosure {
  if (!boundaryDate) {
    return {
      configured: false,
      boundaryDate: null,
      limited: false,
      messageFa: MSG_BASELINE_DISCLOSURE_UNCONFIGURED_FA,
    };
  }
  if (asOf < boundaryDate) {
    return {
      configured: true,
      boundaryDate,
      limited: true,
      messageFa: MSG_BASELINE_DISCLOSURE_LIMITED_FA,
    };
  }
  return {
    configured: true,
    boundaryDate,
    limited: false,
    messageFa: MSG_BASELINE_DISCLOSURE_WITHIN_FA,
  };
}

function resolveViewSemantics(
  asOf: string,
  today: string,
): PersonViewSemantics {
  // Use captured `today` — do not re-call todayDateOnlyTehran/isFutureAsOf (midnight race).
  if (asOf > today) return "planned";
  if (asOf === today) return "current";
  return "historical";
}

/** Parse optional Baseline override; unset/empty → null; invalid → fail-closed. */
function resolveBaselineBoundaryOverride(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = parseDateOnly(trimmed);
  if (!parsed.ok) {
    throw new PersonIdentityError(
      "VALIDATION",
      MSG_BASELINE_BOUNDARY_INVALID_FA,
      parsed.reason,
    );
  }
  return parsed.value;
}

type ScheduledScanFilter = (args: {
  effectiveDate: string;
  resolved: ResolvedLifecycleStatus;
}) => boolean;

async function scanScheduledChanges(
  personId: string,
  evaluationAsOf: string,
  eventDb: PgQueryable,
  include: ScheduledScanFilter,
): Promise<ScheduledFutureChange[]> {
  const events = await listBusinessEventsForPersonForApply(eventDb, personId, {
    limit: SCHEDULED_CHANGES_APPLY_LIMIT,
  });
  // Earliest-first apply order: truncation would drop newest (incl. future Scheduled).
  if (events.length >= SCHEDULED_CHANGES_APPLY_LIMIT) {
    throw new PersonIdentityError(
      "VALIDATION",
      MSG_SCHEDULED_SCAN_TRUNCATED_FA,
      `scheduled scan truncated at ${SCHEDULED_CHANGES_APPLY_LIMIT} events`,
    );
  }
  if (events.length === 0) return [];

  const linksMap = await listChainLinksForEvents(
    eventDb,
    events.map((e) => e.id),
  );

  const planned: ScheduledFutureChange[] = [];
  for (const event of events) {
    if (event.status === "Draft") continue;
    const links = linksMap.get(event.id) ?? {
      cancellations: [],
      reversals: [],
      corrections: [],
    };
    const resolved = resolveLifecycleStatus(event, links, evaluationAsOf);
    if (
      !include({
        effectiveDate: event.effectiveDate,
        resolved,
      })
    ) {
      continue;
    }
    planned.push({
      id: event.id,
      eventType: event.eventType,
      effectiveDate: event.effectiveDate,
      resolvedStatus: "Scheduled",
    });
  }

  planned.sort((a, b) => {
    if (a.effectiveDate !== b.effectiveDate) {
      return a.effectiveDate < b.effectiveDate ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return planned;
}

/**
 * Lean planned-future channel — Finalized events still pre-effect as of `asOf`.
 * Cancelled / Reversed (via chain) and Drafts are excluded.
 */
export async function listScheduledFutureChanges(
  personId: string,
  asOf: string,
  eventDb: PgQueryable,
): Promise<ScheduledFutureChange[]> {
  return scanScheduledChanges(personId, asOf, eventDb, ({ resolved }) => {
    return resolved === "Scheduled";
  });
}

/**
 * Future as-of planned channel: events between today (exclusive) and asOf (inclusive)
 * that are still Scheduled when evaluated at today.
 */
export async function listPlannedChangesThroughAsOf(
  personId: string,
  today: string,
  asOf: string,
  eventDb: PgQueryable,
): Promise<ScheduledFutureChange[]> {
  return scanScheduledChanges(personId, today, eventDb, ({ effectiveDate, resolved }) => {
    return (
      resolved === "Scheduled" &&
      effectiveDate > today &&
      effectiveDate <= asOf
    );
  });
}

/**
 * Events still Scheduled even at the future planned asOf (effectiveDate > asOf).
 */
export async function listRemainingScheduledAfterAsOf(
  personId: string,
  asOf: string,
  eventDb: PgQueryable,
): Promise<ScheduledFutureChange[]> {
  return scanScheduledChanges(personId, asOf, eventDb, ({ effectiveDate, resolved }) => {
    return resolved === "Scheduled" && effectiveDate > asOf;
  });
}

/**
 * Assemble Person state from projection as-of helpers (FR-25 / FR-26).
 * Fail-closed when recalculation is pending / failed / stale for the Person.
 * Future asOf uses planned semantics — facts stay at today; never Effective label.
 */
export async function getCurrentPersonState(
  personId: string,
  options: GetCurrentPersonStateOptions,
  deps: GetCurrentPersonStateDeps,
): Promise<GetCurrentPersonStateResult> {
  const today = todayDateOnlyTehran();
  let asOf: string;
  if (options.asOf !== undefined) {
    const parsed = parseDateOnly(options.asOf);
    if (!parsed.ok) {
      throw new PersonIdentityError(
        "VALIDATION",
        MSG_ASOF_INVALID_FA,
        parsed.reason,
      );
    }
    asOf = parsed.value;
  } else {
    asOf = today;
  }

  const viewSemantics = resolveViewSemantics(asOf, today);
  const factsAsOf = viewSemantics === "planned" ? today : asOf;

  const boundary =
    options.baselineBoundaryDate !== undefined
      ? resolveBaselineBoundaryOverride(options.baselineBoundaryDate)
      : getBaselineBoundaryDate();
  const baselineDisclosure = buildBaselineDisclosure(asOf, boundary);

  const personDb = deps.personDb ?? getPersonDb();
  const compensationDb = deps.compensationDb;
  const { eventDb } = deps;
  const { actorAuthz } = options;

  let disposalDisclosure: DisposalDisclosure = {
    limited: false,
    disposedFieldKeys: [],
    messageFa: null,
  };
  try {
    const disclosure = await getDisposalLimitDisclosure(eventDb, personId);
    disposalDisclosure = {
      limited: disclosure.limited,
      disposedFieldKeys: disclosure.disposedFields.map((f) => f.fieldKey),
      messageFa: disclosure.messageFa,
    };
  } catch (err) {
    // Soft only when lifecycle schema absent; other errors must not hide limits.
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    const msg = err instanceof Error ? err.message : String(err);
    const missingRelation =
      code === "42P01" ||
      /does not exist|undefined_table|relation .* does not exist/i.test(msg);
    if (!missingRelation) throw err;
    disposalDisclosure = {
      limited: false,
      disposedFieldKeys: [],
      messageFa: null,
    };
  }

  const personRow = await getPersonById(personId, personDb);
  if (!personRow) {
    throw new PersonIdentityError("PERSON_NOT_FOUND", MSG_PERSON_NOT_FOUND_FA);
  }

  const recalc = await getRecalculationStatus(eventDb, personId);
  if (recalc) {
    const code = freshnessCodeForStatus(recalc.status);
    if (code) {
      return {
        ok: false,
        code,
        personId,
        status: recalc.status,
        messageFa: freshnessMessageFa(code),
      };
    }
  }

  const person = await projectPersonForRead(
    personRow,
    {
      allowedCategories: actorAuthz.allowedCategories,
      categories: actorAuthz.categories,
    },
    personDb,
  );

  const employment = await getActiveEmploymentAsOf(personId, factsAsOf, personDb);
  const primaryAssignment = employment
    ? await getActivePrimaryAssignmentAsOf(employment.id, factsAsOf, personDb)
    : null;
  const teamMembership = await resolveTeamMembershipAsOf(
    personId,
    factsAsOf,
    personDb,
  );
  const secondaryAssignments = await listActiveSecondaryAssignmentsAsOf(
    { personId },
    factsAsOf,
    personDb,
  );

  let scheduledChanges: ScheduledFutureChange[];
  let plannedChangesThroughAsOf: ScheduledFutureChange[];
  if (viewSemantics === "planned") {
    plannedChangesThroughAsOf = await listPlannedChangesThroughAsOf(
      personId,
      today,
      asOf,
      eventDb,
    );
    scheduledChanges = await listRemainingScheduledAfterAsOf(
      personId,
      asOf,
      eventDb,
    );
  } else {
    plannedChangesThroughAsOf = [];
    scheduledChanges = await listScheduledFutureChanges(
      personId,
      asOf,
      eventDb,
    );
  }

  const snapshot: CurrentPersonState = {
    ok: true,
    asOf,
    personId,
    viewSemantics,
    baselineDisclosure,
    disposalDisclosure,
    person,
    employment,
    primaryAssignment,
    teamMembership,
    secondaryAssignments,
    scheduledChanges,
    plannedChangesThroughAsOf,
  };

  if (actorAuthz.hasCompensationRead) {
    const compensationRaw = await getCompensationAsOf(
      personId,
      factsAsOf,
      compensationDb,
    );
    const contractualRaw = await getContractualAsOf(
      personId,
      factsAsOf,
      compensationDb,
    );
    snapshot.compensation = compensationRaw
      ? projectCompensationRecord(compensationRaw, {
          allowedCategories: actorAuthz.allowedCategories,
          categories: actorAuthz.categories,
        })
      : null;
    snapshot.contractual = contractualRaw
      ? projectCompensationRecord(contractualRaw, {
          allowedCategories: actorAuthz.allowedCategories,
          categories: actorAuthz.categories,
        })
      : null;
  }

  return snapshot;
}

/**
 * Comparable current facts for dual-consumer equality (ignore Date wall-clock).
 * Strips viewSemantics / baselineDisclosure metadata — assert those separately.
 * Callers must pass identical (personId, asOf, authz) results.
 */
export function currentPersonStateFactsForCompare(
  state: CurrentPersonState,
): unknown {
  const metadataKeys = new Set(["ok", "viewSemantics", "baselineDisclosure", "disposalDisclosure"]);
  const rest = Object.fromEntries(Object.entries(state).filter(([key]) => !metadataKeys.has(key)));
  return JSON.parse(
    JSON.stringify(rest, (_key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    }),
  );
}
