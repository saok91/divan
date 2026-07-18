/**
 * Pure AR-TEMPORAL date helpers (Story 2.6).
 * Date-only YYYY-MM-DD in Asia/Tehran calendar day semantics.
 * Exclusive interval ends ([start, end)) — do not invent new calendar rules.
 * Apply-order / rebuild comparator lives in order-business-events.ts (Story 4.4).
 */

export const TEHRAN_TZ = "Asia/Tehran";

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Validate a date-only string. Rejects timestamps, timezone suffixes,
 * and impossible calendar days. Fail-closed for authz callers.
 */
export function parseDateOnly(
  raw: unknown,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "as_of_missing" };
  }
  if (typeof raw !== "string") {
    return { ok: false, reason: "as_of_invalid_type" };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "as_of_empty" };
  }
  // Reject timestamps / time / timezone fragments
  if (/[T\s]|Z|[+-]\d{2}:?\d{2}$/i.test(trimmed) || trimmed.includes(":")) {
    return { ok: false, reason: "as_of_ambiguous_timestamp" };
  }
  const m = DATE_ONLY_RE.exec(trimmed);
  if (!m) {
    return { ok: false, reason: "as_of_invalid_format" };
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    return { ok: false, reason: "as_of_invalid_calendar" };
  }
  // Construct UTC noon probe to avoid DST edge on pure calendar validity
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    return { ok: false, reason: "as_of_invalid_calendar" };
  }
  return { ok: true, value: trimmed };
}

/** Today's calendar date in Asia/Tehran as YYYY-MM-DD. */
export function todayDateOnlyTehran(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    throw new Error("tehran_date_unavailable");
  }
  return `${y}-${m}-${d}`;
}

/**
 * True when `asOf` is strictly after today's Tehran date (future → planned, not Effective).
 */
export function isFutureAsOf(
  asOfDate: string,
  now: Date = new Date(),
): boolean {
  const parsed = parseDateOnly(asOfDate);
  if (!parsed.ok) return false;
  return parsed.value > todayDateOnlyTehran(now);
}

/**
 * Half-open interval [start, end): end exclusive.
 * Missing end → unbounded future; missing start → unbounded past.
 */
export function dateOnlyInInterval(
  date: string,
  start: string | null | undefined,
  endExclusive: string | null | undefined,
): boolean {
  const d = parseDateOnly(date);
  if (!d.ok) return false;
  if (start) {
    const s = parseDateOnly(start);
    if (!s.ok || d.value < s.value) return false;
  }
  if (endExclusive) {
    const e = parseDateOnly(endExclusive);
    if (!e.ok || d.value >= e.value) return false;
  }
  return true;
}

/** Overlap of two half-open date-only intervals. */
export function intervalsOverlap(
  aStart: string | null | undefined,
  aEndExclusive: string | null | undefined,
  bStart: string | null | undefined,
  bEndExclusive: string | null | undefined,
): boolean {
  const aS = aStart ?? "0001-01-01";
  const aE = aEndExclusive ?? "9999-12-31";
  const bS = bStart ?? "0001-01-01";
  const bE = bEndExclusive ?? "9999-12-31";
  return aS < bE && bS < aE;
}
