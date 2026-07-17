/**
 * Pure Employment interval invariants (Story 3.2 / FR-6).
 * Reuses @divan/temporal-engine — do not fork date/interval helpers.
 */

import {
  dateOnlyInInterval,
  intervalsOverlap,
  parseDateOnly,
} from "@divan/temporal-engine";

import {
  EmploymentError,
  MSG_CONCURRENT_EMPLOYMENT_FORBIDDEN_FA,
  MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
  MSG_OVERLAPPING_EMPLOYMENT_FA,
} from "./errors";

export type EmploymentInterval = {
  startDate: string;
  endDateExclusive: string | null;
};

/**
 * Validate date-only half-open interval [start, endExclusive).
 * Rejects timestamp-shaped strings and end ≤ start.
 * Blank endExclusive → null (unbounded open) for apply paths.
 */
export function assertValidEmploymentInterval(
  start: string,
  endExclusive: string | null | undefined,
): EmploymentInterval {
  const startTrimmed = typeof start === "string" ? start.trim() : "";
  const startParsed = parseDateOnly(startTrimmed);
  if (!startParsed.ok) {
    throw new EmploymentError(
      "INVALID_EMPLOYMENT_INTERVAL",
      MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
      `invalid_start:${startParsed.reason}`,
    );
  }

  let endValue: string | null = null;
  if (endExclusive !== undefined && endExclusive !== null) {
    if (typeof endExclusive !== "string") {
      throw new EmploymentError(
        "INVALID_EMPLOYMENT_INTERVAL",
        MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
        "invalid_end:not_string",
      );
    }
    const trimmed = endExclusive.trim();
    if (trimmed.length === 0) {
      endValue = null;
    } else {
      const endParsed = parseDateOnly(trimmed);
      if (!endParsed.ok) {
        throw new EmploymentError(
          "INVALID_EMPLOYMENT_INTERVAL",
          MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
          `invalid_end:${endParsed.reason}`,
        );
      }
      endValue = endParsed.value;
      if (endValue <= startParsed.value) {
        throw new EmploymentError(
          "INVALID_EMPLOYMENT_INTERVAL",
          MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
          "end_not_after_start",
        );
      }
    }
  }

  return { startDate: startParsed.value, endDateExclusive: endValue };
}

/**
 * Reject when candidate overlaps any sibling interval (half-open).
 */
export function assertNoOverlapWithExisting(
  candidate: EmploymentInterval,
  siblings: ReadonlyArray<EmploymentInterval & { id?: string }>,
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
      throw new EmploymentError(
        "OVERLAPPING_EMPLOYMENT",
        MSG_OVERLAPPING_EMPLOYMENT_FA,
      );
    }
  }
}

/** Active at as-of D ⇔ start ≤ D < endExclusive (null end = +∞). */
export function isEmploymentActiveAsOf(
  employment: EmploymentInterval,
  asOfDate: string,
): boolean {
  const asOf = parseDateOnly(asOfDate);
  if (!asOf.ok) {
    throw new EmploymentError(
      "INVALID_EMPLOYMENT_INTERVAL",
      MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
      `invalid_as_of:${asOf.reason}`,
    );
  }
  return dateOnlyInInterval(
    asOf.value,
    employment.startDate,
    employment.endDateExclusive,
  );
}

/**
 * At most one Employment active for a Person at an evaluated instant.
 * Follows from non-overlap + open intervals; selfcheck must prove.
 */
export function assertAtMostOneActiveAsOf(
  employments: ReadonlyArray<EmploymentInterval>,
  asOfDate: string,
): void {
  const active = employments.filter((e) =>
    isEmploymentActiveAsOf(e, asOfDate),
  );
  if (active.length > 1) {
    throw new EmploymentError(
      "CONCURRENT_EMPLOYMENT_FORBIDDEN",
      MSG_CONCURRENT_EMPLOYMENT_FORBIDDEN_FA,
    );
  }
}
