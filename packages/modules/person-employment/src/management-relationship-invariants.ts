/**
 * Pure management-relationship validators (Story 3.9 / FR-13).
 * Reuses @divan/temporal-engine — do not fork date/interval helpers.
 */

import { parseDateOnly } from "@divan/temporal-engine";

import {
  ManagementRelationshipError,
  MSG_AMBIGUOUS_MANAGEMENT_SCOPE_FA,
  MSG_AMBIGUOUS_TEAM_MANAGER_FA,
} from "./errors";

/** Local validation message — keep Persian at boundary. */
const MSG_VALIDATION_FA =
  "مقدار ورودی برای استنتاج رابطه مدیریتی نامعتبر است.";

export type HalfOpenInterval = {
  startDate: string;
  endDateExclusive: string | null;
};

/**
 * Intersect two half-open date-only intervals.
 * Returns null when the intersection is empty.
 */
export function intersectHalfOpenIntervals(
  a: HalfOpenInterval,
  b: HalfOpenInterval,
): HalfOpenInterval | null {
  const start = a.startDate >= b.startDate ? a.startDate : b.startDate;
  const endA = a.endDateExclusive;
  const endB = b.endDateExclusive;
  let end: string | null;
  if (endA === null && endB === null) {
    end = null;
  } else if (endA === null) {
    end = endB;
  } else if (endB === null) {
    end = endA;
  } else {
    end = endA <= endB ? endA : endB;
  }
  if (end !== null && start >= end) return null;
  return { startDate: start, endDateExclusive: end };
}

export function assertValidAsOfDate(asOf: string): string {
  if (typeof asOf !== "string") {
    throw new ManagementRelationshipError(
      "VALIDATION",
      MSG_VALIDATION_FA,
      "as_of_not_string",
    );
  }
  const parsed = parseDateOnly(asOf.trim());
  if (!parsed.ok) {
    throw new ManagementRelationshipError(
      "VALIDATION",
      MSG_VALIDATION_FA,
      `as_of:${parsed.reason}`,
    );
  }
  return parsed.value;
}

export function throwAmbiguousTeamManager(detail: string): never {
  throw new ManagementRelationshipError(
    "AMBIGUOUS_TEAM_MANAGER",
    MSG_AMBIGUOUS_TEAM_MANAGER_FA,
    detail,
  );
}

export function throwAmbiguousManagementScope(detail: string): never {
  throw new ManagementRelationshipError(
    "AMBIGUOUS_MANAGEMENT_SCOPE",
    MSG_AMBIGUOUS_MANAGEMENT_SCOPE_FA,
    detail,
  );
}
