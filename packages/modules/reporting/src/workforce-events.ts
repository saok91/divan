/**
 * Starts / terminations + workforce trend aggregates (Story 5.4 / FR-35).
 * Consumes published event-store rows already scoped by PopulationPort ∩ InferenceBulk.
 * No parallel SoT; no org-wide SQL into other modules' private tables.
 */

import {
  PRODUCT_START_EVENT_TYPE,
  PRODUCT_TERMINATION_EVENT_TYPE,
} from "@divan/person-employment";

export type WorkforceEventRow = {
  eventType: string;
  effectiveDate: string;
  status: string;
};

export type TrendGranularity = "daily" | "monthly";

export type StartsTerminationsAggregate = {
  starts: number;
  terminations: number;
  net: number;
};

export type TrendBucket = {
  bucketKey: string;
  starts: number;
  terminations: number;
  net: number;
};

function inInclusiveRange(
  dateOnly: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return dateOnly >= rangeStart && dateOnly <= rangeEnd;
}

/** Count Effective events only — Scheduled/Draft/Cancelled/Reversed stay out of launch totals. */
function isCountableEffective(status: string): boolean {
  return status === "Effective";
}

function bucketKeyFor(
  effectiveDate: string,
  granularity: TrendGranularity,
): string {
  if (granularity === "daily") return effectiveDate;
  return effectiveDate.slice(0, 7);
}

/**
 * Count Effective-Date-scoped Start / Termination events in range.
 * Draft / Scheduled / Cancelled / Reversed are excluded (Effective only).
 */
export function aggregateStartsTerminations(
  events: readonly WorkforceEventRow[],
  rangeStart: string,
  rangeEnd: string,
): StartsTerminationsAggregate {
  let starts = 0;
  let terminations = 0;
  for (const ev of events) {
    if (!isCountableEffective(ev.status)) continue;
    if (!inInclusiveRange(ev.effectiveDate, rangeStart, rangeEnd)) continue;
    if (ev.eventType === PRODUCT_START_EVENT_TYPE) starts += 1;
    else if (ev.eventType === PRODUCT_TERMINATION_EVENT_TYPE) terminations += 1;
  }
  return { starts, terminations, net: starts - terminations };
}

/** Monthly (default) or daily buckets of starts/terminations for trend cards. */
export function buildWorkforceTrendBuckets(
  events: readonly WorkforceEventRow[],
  rangeStart: string,
  rangeEnd: string,
  granularity: TrendGranularity = "monthly",
): TrendBucket[] {
  const map = new Map<string, TrendBucket>();
  for (const ev of events) {
    if (!isCountableEffective(ev.status)) continue;
    if (!inInclusiveRange(ev.effectiveDate, rangeStart, rangeEnd)) continue;
    const isStart = ev.eventType === PRODUCT_START_EVENT_TYPE;
    const isTerm = ev.eventType === PRODUCT_TERMINATION_EVENT_TYPE;
    if (!isStart && !isTerm) continue;
    const key = bucketKeyFor(ev.effectiveDate, granularity);
    const bucket = map.get(key) ?? {
      bucketKey: key,
      starts: 0,
      terminations: 0,
      net: 0,
    };
    if (isStart) bucket.starts += 1;
    if (isTerm) bucket.terminations += 1;
    bucket.net = bucket.starts - bucket.terminations;
    map.set(key, bucket);
  }
  return [...map.values()].sort((a, b) =>
    a.bucketKey < b.bucketKey ? -1 : a.bucketKey > b.bucketKey ? 1 : 0,
  );
}
