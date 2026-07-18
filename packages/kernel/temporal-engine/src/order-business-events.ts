/**
 * Canonical apply / reconstruct ordering (Story 4.4 / FR-18).
 *
 * Authoritative order (never reuse DESC UI timeline sort):
 *   1. effectiveDate ASC (date-only YYYY-MM-DD)
 *   2. coalesce(finalizedAt, registeredAt) ASC
 *   3. id ASC (UUID) only when timestamps equal
 *
 * Exclusive interval ends remain via dateOnlyInInterval / intervalsOverlap —
 * this module does not invent calendar rules.
 */

export type ApplyOrderableBusinessEvent = {
  id: string;
  /** Date-only YYYY-MM-DD. */
  effectiveDate: string;
  registeredAt: Date | string | number;
  finalizedAt?: Date | string | number | null;
};

function toEpochMs(value: Date | string | number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/** coalesce(finalizedAt, registeredAt) as epoch ms. */
export function applyOrderTimestampMs(
  event: ApplyOrderableBusinessEvent,
): number {
  if (event.finalizedAt != null && event.finalizedAt !== "") {
    return toEpochMs(event.finalizedAt);
  }
  return toEpochMs(event.registeredAt);
}

/**
 * Comparator for authoritative apply / reconstruct order.
 * Returns negative if `a` precedes `b`.
 */
export function compareBusinessEventsForApply(
  a: ApplyOrderableBusinessEvent,
  b: ApplyOrderableBusinessEvent,
): number {
  if (a.effectiveDate < b.effectiveDate) return -1;
  if (a.effectiveDate > b.effectiveDate) return 1;

  const ta = applyOrderTimestampMs(a);
  const tb = applyOrderTimestampMs(b);
  if (ta < tb) return -1;
  if (ta > tb) return 1;

  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** Stable sort into authoritative apply order (does not mutate input). */
export function orderBusinessEventsForApply<
  T extends ApplyOrderableBusinessEvent,
>(events: readonly T[]): T[] {
  return [...events].sort(compareBusinessEventsForApply);
}

/**
 * SQL twin for list/load paths (must match compareBusinessEventsForApply exactly):
 *
 *   ORDER BY effective_date ASC,
 *            COALESCE(finalized_at, registered_at) ASC,
 *            id ASC
 */
export const APPLY_ORDER_SQL_ORDER_BY =
  "effective_date ASC, COALESCE(finalized_at, registered_at) ASC, id ASC" as const;
