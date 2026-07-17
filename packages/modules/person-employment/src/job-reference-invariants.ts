/**
 * Pure job-reference invariants (Story 3.6 / FR-10).
 * Reuses @divan/temporal-engine — do not fork date/interval helpers.
 * No Grade↔Seniority compatibility helpers — universal mapping is forbidden.
 */

import {
  dateOnlyInInterval,
  parseDateOnly,
} from "@divan/temporal-engine";
import { Prisma } from "@divan/db";

import {
  JobRefError,
  MSG_GRADE_NOT_IN_LADDER_FA,
  MSG_INVALID_HALF_GRADE_RANK_FA,
  MSG_INVALID_JOB_REF_INTERVAL_FA,
  MSG_JOB_REF_RANK_REQUIRED_FA,
} from "./errors";

export type JobRefInterval = {
  startDate: string;
  endDateExclusive: string | null;
};

export type JobRefConcept =
  | "organizational_role"
  | "job_title"
  | "ladder"
  | "grade"
  | "seniority";

/**
 * Validate date-only half-open interval [start, endExclusive).
 * Blank endExclusive → null (unbounded open).
 */
export function assertValidJobRefInterval(
  start: string,
  endExclusive: string | null | undefined,
): JobRefInterval {
  const startTrimmed = typeof start === "string" ? start.trim() : "";
  const startParsed = parseDateOnly(startTrimmed);
  if (!startParsed.ok) {
    throw new JobRefError(
      "INVALID_JOB_REF_INTERVAL",
      MSG_INVALID_JOB_REF_INTERVAL_FA,
      `invalid_start:${startParsed.reason}`,
    );
  }

  let endValue: string | null = null;
  if (endExclusive !== undefined && endExclusive !== null) {
    if (typeof endExclusive !== "string") {
      throw new JobRefError(
        "INVALID_JOB_REF_INTERVAL",
        MSG_INVALID_JOB_REF_INTERVAL_FA,
        "invalid_end:not_string",
      );
    }
    const trimmed = endExclusive.trim();
    if (trimmed.length === 0) {
      endValue = null;
    } else {
      const endParsed = parseDateOnly(trimmed);
      if (!endParsed.ok) {
        throw new JobRefError(
          "INVALID_JOB_REF_INTERVAL",
          MSG_INVALID_JOB_REF_INTERVAL_FA,
          `invalid_end:${endParsed.reason}`,
        );
      }
      endValue = endParsed.value;
      if (endValue <= startParsed.value) {
        throw new JobRefError(
          "INVALID_JOB_REF_INTERVAL",
          MSG_INVALID_JOB_REF_INTERVAL_FA,
          "end_not_after_start",
        );
      }
    }
  }

  return { startDate: startParsed.value, endDateExclusive: endValue };
}

/** Active at as-of D ⇔ start ≤ D < endExclusive (null end = +∞). */
export function isJobRefActiveAsOf(
  ref: JobRefInterval,
  asOfDate: string,
): boolean {
  const asOf = parseDateOnly(asOfDate);
  if (!asOf.ok) {
    throw new JobRefError(
      "INVALID_JOB_REF_INTERVAL",
      MSG_INVALID_JOB_REF_INTERVAL_FA,
      `invalid_as_of:${asOf.reason}`,
    );
  }
  return dateOnlyInInterval(
    asOf.value,
    ref.startDate,
    ref.endDateExclusive,
  );
}

/**
 * Grade must belong to the given ladderId.
 */
export function assertGradeBelongsToLadder(
  grade: { ladderId: string },
  ladderId: string,
): void {
  if (grade.ladderId !== ladderId) {
    throw new JobRefError(
      "GRADE_NOT_IN_LADDER",
      MSG_GRADE_NOT_IN_LADDER_FA,
      `grade_ladder:${grade.ladderId}:expected:${ladderId}`,
    );
  }
}

/**
 * Rank must be a finite number on a 0.5 step (half-grades), stored as Decimal.
 * Rejects Float-ish noise by normalizing via Prisma.Decimal.
 */
export function assertValidHalfGradeRank(
  rank: string | number | Prisma.Decimal,
): Prisma.Decimal {
  if (rank === null || rank === undefined || rank === "") {
    throw new JobRefError(
      "VALIDATION",
      MSG_JOB_REF_RANK_REQUIRED_FA,
      "rank_required",
    );
  }

  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(rank);
  } catch {
    throw new JobRefError(
      "INVALID_HALF_GRADE_RANK",
      MSG_INVALID_HALF_GRADE_RANK_FA,
      "rank_not_decimal",
    );
  }

  if (!decimal.isFinite()) {
    throw new JobRefError(
      "INVALID_HALF_GRADE_RANK",
      MSG_INVALID_HALF_GRADE_RANK_FA,
      "rank_not_finite",
    );
  }

  // Must be multiple of 0.5: rank * 2 is integer
  const doubled = decimal.mul(2);
  if (!doubled.isInteger()) {
    throw new JobRefError(
      "INVALID_HALF_GRADE_RANK",
      MSG_INVALID_HALF_GRADE_RANK_FA,
      `rank_not_half_step:${decimal.toString()}`,
    );
  }

  // Positive ranks only; Decimal(4,1) max is 999.9
  if (decimal.lte(0) || decimal.gt(999.9)) {
    throw new JobRefError(
      "INVALID_HALF_GRADE_RANK",
      MSG_INVALID_HALF_GRADE_RANK_FA,
      `rank_out_of_bounds:${decimal.toString()}`,
    );
  }

  // Normalize to 1 decimal place for Decimal(4,1) storage
  return decimal.toDecimalPlaces(1);
}
