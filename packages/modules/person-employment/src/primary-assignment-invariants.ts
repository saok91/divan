/**
 * Pure Primary Assignment interval invariants (Story 3.7 / FR-11).
 * Reuses @divan/temporal-engine — do not fork date/interval helpers.
 */

import {
  dateOnlyInInterval,
  intervalsOverlap,
  parseDateOnly,
} from "@divan/temporal-engine";

import {
  MSG_GRADE_NOT_IN_LADDER_FA,
  MSG_INVALID_PRIMARY_INTERVAL_FA,
  MSG_OVERLAPPING_PRIMARY_ASSIGNMENT_FA,
  MSG_PRIMARY_ASSIGNMENT_REQUIRED_FA,
  MSG_PRIMARY_COVERAGE_GAP_FA,
  MSG_PRIMARY_OUTSIDE_EMPLOYMENT_FA,
  MSG_TEAM_UNIT_REQUIRED_FA,
  PrimaryAssignmentError,
} from "./errors";

export type PrimaryInterval = {
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
export function assertValidPrimaryInterval(
  start: string,
  endExclusive: string | null | undefined,
): PrimaryInterval {
  const startTrimmed = typeof start === "string" ? start.trim() : "";
  const startParsed = parseDateOnly(startTrimmed);
  if (!startParsed.ok) {
    throw new PrimaryAssignmentError(
      "INVALID_PRIMARY_INTERVAL",
      MSG_INVALID_PRIMARY_INTERVAL_FA,
      `invalid_start:${startParsed.reason}`,
    );
  }

  let endValue: string | null = null;
  if (endExclusive !== undefined && endExclusive !== null) {
    if (typeof endExclusive !== "string") {
      throw new PrimaryAssignmentError(
        "INVALID_PRIMARY_INTERVAL",
        MSG_INVALID_PRIMARY_INTERVAL_FA,
        "invalid_end:not_string",
      );
    }
    const trimmed = endExclusive.trim();
    if (trimmed.length === 0) {
      endValue = null;
    } else {
      const endParsed = parseDateOnly(trimmed);
      if (!endParsed.ok) {
        throw new PrimaryAssignmentError(
          "INVALID_PRIMARY_INTERVAL",
          MSG_INVALID_PRIMARY_INTERVAL_FA,
          `invalid_end:${endParsed.reason}`,
        );
      }
      endValue = endParsed.value;
      if (endValue <= startParsed.value) {
        throw new PrimaryAssignmentError(
          "INVALID_PRIMARY_INTERVAL",
          MSG_INVALID_PRIMARY_INTERVAL_FA,
          "end_not_after_start",
        );
      }
    }
  }

  return { startDate: startParsed.value, endDateExclusive: endValue };
}

/**
 * Reject when candidate overlaps any sibling Primary on the same Employment.
 */
export function assertNoOverlapWithExistingPrimaries(
  candidate: PrimaryInterval,
  siblings: ReadonlyArray<PrimaryInterval & { id?: string }>,
  excludeId?: string,
): void {
  for (const sibling of siblings) {
    if (excludeId && sibling.id === excludeId) continue;
    if (
      intervalsOverlap(
        candidate.startDate,
        candidate.endDateExclusive,
        sibling.startDate,
        sibling.endDateExclusive,
      )
    ) {
      throw new PrimaryAssignmentError(
        "OVERLAPPING_PRIMARY_ASSIGNMENT",
        MSG_OVERLAPPING_PRIMARY_ASSIGNMENT_FA,
      );
    }
  }
}

/** Active at as-of D ⇔ start ≤ D < endExclusive (null end = +∞). */
export function isPrimaryActiveAsOf(
  primary: PrimaryInterval,
  asOfDate: string,
): boolean {
  const asOf = parseDateOnly(asOfDate);
  if (!asOf.ok) {
    throw new PrimaryAssignmentError(
      "INVALID_PRIMARY_INTERVAL",
      MSG_INVALID_PRIMARY_INTERVAL_FA,
      `invalid_as_of:${asOf.reason}`,
    );
  }
  return dateOnlyInInterval(
    asOf.value,
    primary.startDate,
    primary.endDateExclusive,
  );
}

/**
 * When Employment is active at asOf, require exactly one active Primary.
 * Callers pass whether Employment is active; empty Primaries → REQUIRED.
 */
export function assertExactlyOneActivePrimaryAsOf(
  primaries: ReadonlyArray<PrimaryInterval>,
  asOfDate: string,
  employmentActiveAtAsOf: boolean,
): void {
  if (!employmentActiveAtAsOf) return;

  const active = primaries.filter((p) => isPrimaryActiveAsOf(p, asOfDate));
  if (active.length === 0) {
    throw new PrimaryAssignmentError(
      "PRIMARY_ASSIGNMENT_REQUIRED",
      MSG_PRIMARY_ASSIGNMENT_REQUIRED_FA,
    );
  }
  if (active.length > 1) {
    throw new PrimaryAssignmentError(
      "OVERLAPPING_PRIMARY_ASSIGNMENT",
      MSG_OVERLAPPING_PRIMARY_ASSIGNMENT_FA,
      "multiple_active_as_of",
    );
  }
}

/**
 * Primary interval must be subset of Employment interval (half-open).
 * primary.start ≥ employment.start AND
 * (employment open ⇒ primary may be open or closed) AND
 * (employment closed ⇒ primary.end ≤ employment.end; primary must not be open past end).
 */
export function assertPrimaryWithinEmployment(
  primary: PrimaryInterval,
  employment: EmploymentIntervalLike,
): void {
  if (primary.startDate < employment.startDate) {
    throw new PrimaryAssignmentError(
      "PRIMARY_OUTSIDE_EMPLOYMENT",
      MSG_PRIMARY_OUTSIDE_EMPLOYMENT_FA,
      "start_before_employment",
    );
  }

  if (employment.endDateExclusive === null) {
    return;
  }

  // Employment closed: primary must end by employment.end (or earlier); cannot be open.
  if (primary.endDateExclusive === null) {
    throw new PrimaryAssignmentError(
      "PRIMARY_OUTSIDE_EMPLOYMENT",
      MSG_PRIMARY_OUTSIDE_EMPLOYMENT_FA,
      "open_primary_past_closed_employment",
    );
  }
  if (primary.endDateExclusive > employment.endDateExclusive) {
    throw new PrimaryAssignmentError(
      "PRIMARY_OUTSIDE_EMPLOYMENT",
      MSG_PRIMARY_OUTSIDE_EMPLOYMENT_FA,
      "end_after_employment",
    );
  }
}

/**
 * No gaps across Primaries covering the Employment’s active span.
 * Sorted Primaries must start at Employment.start, be adjacent (no gaps),
 * and end exactly when Employment ends (or remain open together).
 *
 * Epic 4 finalization will also call this after event-driven writes.
 */
export function assertPrimaryCoverageForActiveEmployment(
  employment: EmploymentIntervalLike,
  primaries: ReadonlyArray<PrimaryInterval>,
): void {
  if (primaries.length === 0) {
    throw new PrimaryAssignmentError(
      "PRIMARY_COVERAGE_GAP",
      MSG_PRIMARY_COVERAGE_GAP_FA,
      "no_primaries",
    );
  }

  const sorted = [...primaries].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
  );

  if (sorted[0]!.startDate !== employment.startDate) {
    throw new PrimaryAssignmentError(
      "PRIMARY_COVERAGE_GAP",
      MSG_PRIMARY_COVERAGE_GAP_FA,
      "gap_at_employment_start",
    );
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i]!;
    const next = sorted[i + 1]!;
    if (cur.endDateExclusive === null) {
      throw new PrimaryAssignmentError(
        "PRIMARY_COVERAGE_GAP",
        MSG_PRIMARY_COVERAGE_GAP_FA,
        "open_before_last",
      );
    }
    if (cur.endDateExclusive !== next.startDate) {
      throw new PrimaryAssignmentError(
        "PRIMARY_COVERAGE_GAP",
        MSG_PRIMARY_COVERAGE_GAP_FA,
        "gap_or_overlap_between",
      );
    }
  }

  const last = sorted[sorted.length - 1]!;
  if (employment.endDateExclusive === null) {
    if (last.endDateExclusive !== null) {
      throw new PrimaryAssignmentError(
        "PRIMARY_COVERAGE_GAP",
        MSG_PRIMARY_COVERAGE_GAP_FA,
        "closed_primary_under_open_employment",
      );
    }
  } else if (last.endDateExclusive !== employment.endDateExclusive) {
    throw new PrimaryAssignmentError(
      "PRIMARY_COVERAGE_GAP",
      MSG_PRIMARY_COVERAGE_GAP_FA,
      "gap_at_employment_end",
    );
  }
}

export function assertTeamUnitIsTeam(team: {
  unitType: string;
}): void {
  if (team.unitType !== "TEAM") {
    throw new PrimaryAssignmentError(
      "TEAM_UNIT_REQUIRED",
      MSG_TEAM_UNIT_REQUIRED_FA,
      `unitType:${team.unitType}`,
    );
  }
}

/**
 * Grade must belong to the Assignment’s Ladder.
 * Thin wrapper so Primary callers get PrimaryAssignmentError codes.
 */
export function assertGradeMatchesLadder(
  grade: { ladderId: string },
  ladderId: string,
): void {
  if (grade.ladderId !== ladderId) {
    throw new PrimaryAssignmentError(
      "GRADE_NOT_IN_LADDER",
      MSG_GRADE_NOT_IN_LADDER_FA,
    );
  }
}
