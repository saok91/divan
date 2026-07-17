/**
 * Pure Secondary Assignment interval invariants (Story 3.8 / FR-12).
 * Reuses @divan/temporal-engine — do not fork date/interval helpers.
 *
 * Coverage rule: Secondary ⊆ Employment (Employment covers Secondary).
 * Do NOT assert Secondary coverage of Employment (Primary-only rule).
 * Do NOT require TEAM unit type on orgUnitId (unlike Primary teamId).
 */

import {
  dateOnlyInInterval,
  intervalsOverlap,
  parseDateOnly,
} from "@divan/temporal-engine";

import {
  MSG_GRADE_NOT_IN_LADDER_FA,
  MSG_INVALID_SECONDARY_INTERVAL_FA,
  MSG_OVERLAPPING_EQUIVALENT_SECONDARY_FA,
  MSG_SECONDARY_OUTSIDE_EMPLOYMENT_FA,
  MSG_SECONDARY_PERSON_MISMATCH_FA,
  SecondaryAssignmentError,
} from "./errors";

export type SecondaryInterval = {
  startDate: string;
  endDateExclusive: string | null;
};

export type EmploymentIntervalLike = {
  startDate: string;
  endDateExclusive: string | null;
};

/**
 * Validate date-only half-open interval [start, endExclusive).
 * Blank endExclusive → null (unbounded open) for apply paths.
 */
export function assertValidSecondaryInterval(
  start: string,
  endExclusive: string | null | undefined,
): SecondaryInterval {
  const startTrimmed = typeof start === "string" ? start.trim() : "";
  const startParsed = parseDateOnly(startTrimmed);
  if (!startParsed.ok) {
    throw new SecondaryAssignmentError(
      "INVALID_SECONDARY_INTERVAL",
      MSG_INVALID_SECONDARY_INTERVAL_FA,
      `invalid_start:${startParsed.reason}`,
    );
  }

  let endValue: string | null = null;
  if (endExclusive !== undefined && endExclusive !== null) {
    if (typeof endExclusive !== "string") {
      throw new SecondaryAssignmentError(
        "INVALID_SECONDARY_INTERVAL",
        MSG_INVALID_SECONDARY_INTERVAL_FA,
        "invalid_end:not_string",
      );
    }
    const trimmed = endExclusive.trim();
    if (trimmed.length === 0) {
      endValue = null;
    } else {
      const endParsed = parseDateOnly(trimmed);
      if (!endParsed.ok) {
        throw new SecondaryAssignmentError(
          "INVALID_SECONDARY_INTERVAL",
          MSG_INVALID_SECONDARY_INTERVAL_FA,
          `invalid_end:${endParsed.reason}`,
        );
      }
      endValue = endParsed.value;
      if (endValue <= startParsed.value) {
        throw new SecondaryAssignmentError(
          "INVALID_SECONDARY_INTERVAL",
          MSG_INVALID_SECONDARY_INTERVAL_FA,
          "end_not_after_start",
        );
      }
    }
  }

  return { startDate: startParsed.value, endDateExclusive: endValue };
}

/** personId must match employment.personId (denormalized EXCLUDE key). */
export function assertPersonMatchesEmployment(
  personId: string,
  employmentPersonId: string,
): void {
  if (personId !== employmentPersonId) {
    throw new SecondaryAssignmentError(
      "SECONDARY_PERSON_MISMATCH",
      MSG_SECONDARY_PERSON_MISMATCH_FA,
    );
  }
}

/**
 * Secondary interval must be subset of Employment interval (half-open).
 * Employment must cover every day of the Secondary span.
 */
export function assertSecondaryWithinEmployment(
  secondary: SecondaryInterval,
  employment: EmploymentIntervalLike,
): void {
  if (secondary.startDate < employment.startDate) {
    throw new SecondaryAssignmentError(
      "SECONDARY_OUTSIDE_EMPLOYMENT",
      MSG_SECONDARY_OUTSIDE_EMPLOYMENT_FA,
      "start_before_employment",
    );
  }

  if (employment.endDateExclusive === null) {
    return;
  }

  if (secondary.endDateExclusive === null) {
    throw new SecondaryAssignmentError(
      "SECONDARY_OUTSIDE_EMPLOYMENT",
      MSG_SECONDARY_OUTSIDE_EMPLOYMENT_FA,
      "open_secondary_past_closed_employment",
    );
  }
  if (secondary.endDateExclusive > employment.endDateExclusive) {
    throw new SecondaryAssignmentError(
      "SECONDARY_OUTSIDE_EMPLOYMENT",
      MSG_SECONDARY_OUTSIDE_EMPLOYMENT_FA,
      "end_after_employment",
    );
  }
}

export type EquivalentSecondarySibling = SecondaryInterval & {
  id?: string;
  personId: string;
  orgUnitId: string;
  reasonType: string;
};

/**
 * Reject when candidate overlaps an equivalent sibling
 * (same personId + orgUnitId + reasonType + overlapping interval).
 */
export function assertNoEquivalentOverlap(
  candidate: EquivalentSecondarySibling,
  siblings: ReadonlyArray<EquivalentSecondarySibling>,
  excludeId?: string,
): void {
  for (const sibling of siblings) {
    if (excludeId && sibling.id === excludeId) continue;
    if (
      sibling.personId !== candidate.personId ||
      sibling.orgUnitId !== candidate.orgUnitId ||
      sibling.reasonType !== candidate.reasonType
    ) {
      continue;
    }
    if (
      intervalsOverlap(
        candidate.startDate,
        candidate.endDateExclusive,
        sibling.startDate,
        sibling.endDateExclusive,
      )
    ) {
      throw new SecondaryAssignmentError(
        "OVERLAPPING_EQUIVALENT_SECONDARY",
        MSG_OVERLAPPING_EQUIVALENT_SECONDARY_FA,
      );
    }
  }
}

/** Active at as-of D ⇔ start ≤ D < endExclusive (null end = +∞). */
export function isSecondaryActiveAsOf(
  secondary: SecondaryInterval,
  asOfDate: string,
): boolean {
  const asOf = parseDateOnly(asOfDate);
  if (!asOf.ok) {
    throw new SecondaryAssignmentError(
      "INVALID_SECONDARY_INTERVAL",
      MSG_INVALID_SECONDARY_INTERVAL_FA,
      `invalid_as_of:${asOf.reason}`,
    );
  }
  return dateOnlyInInterval(
    asOf.value,
    secondary.startDate,
    secondary.endDateExclusive,
  );
}

/**
 * Grade must belong to the Assignment’s Ladder when both are set.
 */
export function assertSecondaryGradeMatchesLadder(
  grade: { ladderId: string },
  ladderId: string,
): void {
  if (grade.ladderId !== ladderId) {
    throw new SecondaryAssignmentError(
      "GRADE_NOT_IN_LADDER",
      MSG_GRADE_NOT_IN_LADDER_FA,
    );
  }
}
