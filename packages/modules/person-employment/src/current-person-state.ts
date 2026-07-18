/**
 * Current Person state assembler (Story 4.9 / FR-25).
 * Composes existing projection as-of helpers — does not replay the event log
 * and does not write a denormalized current-state table.
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
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import { getPersonDb } from "./db";
import { getActiveEmploymentAsOf, type EmploymentRecord } from "./employment";
import {
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
 * Shared DTO for profile / list / report consumers (FR-25).
 * Compensation keys are absent (not null) when the actor lacks compensation.read.
 */
export type CurrentPersonState = {
  ok: true;
  asOf: string;
  personId: string;
  person: Partial<PersonRecord>;
  employment: EmploymentRecord | null;
  primaryAssignment: PrimaryAssignmentRecord | null;
  teamMembership: TeamMembershipAsOf | null;
  secondaryAssignments: SecondaryAssignmentRecord[];
  compensation?: Partial<CompensationFactRecord> | null;
  contractual?: Partial<CompensationFactRecord> | null;
  scheduledChanges: ScheduledFutureChange[];
};

export type GetCurrentPersonStateResult =
  | CurrentPersonState
  | CurrentPersonStateFreshnessBlock;

export type GetCurrentPersonStateOptions = {
  /** Defaults to today (Asia/Tehran date-only). */
  asOf?: string;
  actorAuthz: CurrentPersonStateActorAuthz;
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

/**
 * Lean planned-future channel — Finalized events still pre-effect as of `asOf`.
 * Cancelled / Reversed (via chain) and Drafts are excluded.
 */
export async function listScheduledFutureChanges(
  personId: string,
  asOf: string,
  eventDb: PgQueryable,
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
    const resolved = resolveLifecycleStatus(event, links, asOf);
    if (resolved !== "Scheduled") continue;
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
 * Assemble current Person state from projection as-of helpers (FR-25).
 * Fail-closed when recalculation is pending / failed / stale for the Person.
 */
export async function getCurrentPersonState(
  personId: string,
  options: GetCurrentPersonStateOptions,
  deps: GetCurrentPersonStateDeps,
): Promise<GetCurrentPersonStateResult> {
  const asOf = options.asOf ?? todayDateOnlyTehran();
  const personDb = deps.personDb ?? getPersonDb();
  const compensationDb = deps.compensationDb;
  const { eventDb } = deps;
  const { actorAuthz } = options;

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

  const employment = await getActiveEmploymentAsOf(personId, asOf, personDb);
  const primaryAssignment = employment
    ? await getActivePrimaryAssignmentAsOf(employment.id, asOf, personDb)
    : null;
  const teamMembership = await resolveTeamMembershipAsOf(
    personId,
    asOf,
    personDb,
  );
  const secondaryAssignments = await listActiveSecondaryAssignmentsAsOf(
    { personId },
    asOf,
    personDb,
  );

  const scheduledChanges = await listScheduledFutureChanges(
    personId,
    asOf,
    eventDb,
  );

  const snapshot: CurrentPersonState = {
    ok: true,
    asOf,
    personId,
    person,
    employment,
    primaryAssignment,
    teamMembership,
    secondaryAssignments,
    scheduledChanges,
  };

  if (actorAuthz.hasCompensationRead) {
    const compensationRaw = await getCompensationAsOf(
      personId,
      asOf,
      compensationDb,
    );
    const contractualRaw = await getContractualAsOf(
      personId,
      asOf,
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
 * Callers must pass identical (personId, asOf, authz) results.
 */
export function currentPersonStateFactsForCompare(
  state: CurrentPersonState,
): unknown {
  const { ok: _ok, ...rest } = state;
  return JSON.parse(
    JSON.stringify(rest, (_key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    }),
  );
}
