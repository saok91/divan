/**
 * Pure compensation / contractual interval invariants (Story 3.4 / FR-8).
 * Reuses @divan/temporal-engine — do not fork date/interval helpers.
 */

import {
  dateOnlyInInterval,
  intervalsOverlap,
  parseDateOnly,
} from "@divan/temporal-engine";

import {
  CompensationError,
  MSG_CONCURRENT_COMPENSATION_FORBIDDEN_FA,
  MSG_INVALID_COMPENSATION_INTERVAL_FA,
  MSG_OVERLAPPING_COMPENSATION_FA,
} from "./errors";

export type CompensationInterval = {
  startDate: string;
  endDateExclusive: string | null;
};

/**
 * Validate date-only half-open interval [start, endExclusive).
 * Rejects timestamp-shaped strings and end ≤ start.
 * Blank endExclusive → null (unbounded open) for apply paths.
 */
export function assertValidCompensationInterval(
  start: string,
  endExclusive: string | null | undefined,
): CompensationInterval {
  const startTrimmed = typeof start === "string" ? start.trim() : "";
  const startParsed = parseDateOnly(startTrimmed);
  if (!startParsed.ok) {
    throw new CompensationError(
      "INVALID_COMPENSATION_INTERVAL",
      MSG_INVALID_COMPENSATION_INTERVAL_FA,
      `invalid_start:${startParsed.reason}`,
    );
  }

  let endValue: string | null = null;
  if (endExclusive !== undefined && endExclusive !== null) {
    if (typeof endExclusive !== "string") {
      throw new CompensationError(
        "INVALID_COMPENSATION_INTERVAL",
        MSG_INVALID_COMPENSATION_INTERVAL_FA,
        "invalid_end:not_string",
      );
    }
    const trimmed = endExclusive.trim();
    if (trimmed.length === 0) {
      endValue = null;
    } else {
      const endParsed = parseDateOnly(trimmed);
      if (!endParsed.ok) {
        throw new CompensationError(
          "INVALID_COMPENSATION_INTERVAL",
          MSG_INVALID_COMPENSATION_INTERVAL_FA,
          `invalid_end:${endParsed.reason}`,
        );
      }
      endValue = endParsed.value;
      if (endValue <= startParsed.value) {
        throw new CompensationError(
          "INVALID_COMPENSATION_INTERVAL",
          MSG_INVALID_COMPENSATION_INTERVAL_FA,
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
  candidate: CompensationInterval,
  siblings: ReadonlyArray<CompensationInterval & { id?: string }>,
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
      throw new CompensationError(
        "OVERLAPPING_COMPENSATION",
        MSG_OVERLAPPING_COMPENSATION_FA,
      );
    }
  }
}

/** Active at as-of D ⇔ start ≤ D < endExclusive (null end = +∞). */
export function isCompensationActiveAsOf(
  fact: CompensationInterval,
  asOfDate: string,
): boolean {
  const asOf = parseDateOnly(asOfDate);
  if (!asOf.ok) {
    throw new CompensationError(
      "INVALID_COMPENSATION_INTERVAL",
      MSG_INVALID_COMPENSATION_INTERVAL_FA,
      `invalid_as_of:${asOf.reason}`,
    );
  }
  return dateOnlyInInterval(
    asOf.value,
    fact.startDate,
    fact.endDateExclusive,
  );
}

/**
 * At most one fact of a kind active for a Person at an evaluated instant.
 */
export function assertAtMostOneActiveAsOf(
  facts: ReadonlyArray<CompensationInterval>,
  asOfDate: string,
): void {
  const active = facts.filter((f) => isCompensationActiveAsOf(f, asOfDate));
  if (active.length > 1) {
    throw new CompensationError(
      "CONCURRENT_COMPENSATION_FORBIDDEN",
      MSG_CONCURRENT_COMPENSATION_FORBIDDEN_FA,
    );
  }
}
