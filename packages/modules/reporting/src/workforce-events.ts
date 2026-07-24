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

/**
 * Status-aware filter for Story 5.5 catalogue keys (scheduled /
 * corrected_cancelled_reversed). Do **not** stretch isCountableEffective —
 * Effective-only helpers stay unchanged for dashboard.
 */
export function filterEventsByStatus(
  events: readonly WorkforceEventRow[],
  statuses: readonly string[],
  rangeStart?: string,
  rangeEnd?: string,
): WorkforceEventRow[] {
  const allow = new Set(statuses);
  return events.filter((ev) => {
    if (!allow.has(ev.status)) return false;
    if (rangeStart != null && rangeEnd != null) {
      return inInclusiveRange(ev.effectiveDate, rangeStart, rangeEnd);
    }
    return true;
  });
}

export type EventTypeStatusAggregate = {
  eventType: string;
  status: string;
  count: number;
};

/**
 * Count events by (eventType, status) in optional Effective-Date range.
 * Used for Scheduled and Corrected/Cancelled/Reversed report keys.
 */
export function aggregateEventsByTypeAndStatus(
  events: readonly WorkforceEventRow[],
  statuses: readonly string[],
  rangeStart?: string,
  rangeEnd?: string,
  eventTypes?: readonly string[],
): EventTypeStatusAggregate[] {
  const statusAllow = new Set(statuses);
  const typeAllow = eventTypes ? new Set(eventTypes) : null;
  const map = new Map<string, EventTypeStatusAggregate>();
  for (const ev of events) {
    if (!statusAllow.has(ev.status)) continue;
    if (typeAllow && !typeAllow.has(ev.eventType)) continue;
    if (
      rangeStart != null &&
      rangeEnd != null &&
      !inInclusiveRange(ev.effectiveDate, rangeStart, rangeEnd)
    ) {
      continue;
    }
    const key = `${ev.eventType}\0${ev.status}`;
    const row = map.get(key) ?? {
      eventType: ev.eventType,
      status: ev.status,
      count: 0,
    };
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => {
    if (a.eventType !== b.eventType) {
      return a.eventType < b.eventType ? -1 : 1;
    }
    return a.status < b.status ? -1 : a.status > b.status ? 1 : 0;
  });
}
