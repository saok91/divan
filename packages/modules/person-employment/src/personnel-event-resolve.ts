/**
 * Resolved lifecycle status + chain helpers (Story 4.3 / FR-16 / FR-17).
 * Storage tokens on originals stay attributable; display status is derived.
 */

import type { BusinessEventRecord, BusinessEventStatus } from "@divan/event-store";
import {
  getBusinessEventById,
  listChainLinksForEvent,
  type PgQueryable,
} from "@divan/event-store";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

/** Display lifecycle — derived, never an in-place rewrite of the original row. */
export type ResolvedLifecycleStatus = BusinessEventStatus;

export type EventChainLinks = {
  cancellations: BusinessEventRecord[];
  reversals: BusinessEventRecord[];
  corrections: BusinessEventRecord[];
};

/**
 * Evaluation-by-date: storage Scheduled whose Effective Date has been reached
 * is treated as Effective for readers until Story 4.4 recalc mutates nothing.
 */
export function evaluationStatusAsOf(
  event: Pick<BusinessEventRecord, "status" | "effectiveDate">,
  asOfDate: string = todayDateOnlyTehran(),
): BusinessEventStatus {
  if (event.status === "Draft") return "Draft";
  if (event.status === "Cancelled" || event.status === "Reversed") {
    return event.status;
  }
  if (event.status === "Scheduled" && event.effectiveDate <= asOfDate) {
    return "Effective";
  }
  return event.status;
}

/**
 * Whether the event is still pre-effect (Cancel-eligible) as of date.
 * Neutralizing children are checked by callers via resolveLifecycleStatus.
 */
export function isPreEffectAsOf(
  event: Pick<BusinessEventRecord, "status" | "effectiveDate">,
  asOfDate: string = todayDateOnlyTehran(),
): boolean {
  return evaluationStatusAsOf(event, asOfDate) === "Scheduled";
}

/**
 * Derive display status from storage + neutralizing/correcting children.
 * Convention: Cancel/Reverse rows themselves carry status Cancelled/Reversed;
 * originals keep Scheduled|Effective; resolved Cancelled/Reversed wins for UI.
 */
export function resolveLifecycleStatus(
  event: BusinessEventRecord,
  links: EventChainLinks,
  asOfDate: string = todayDateOnlyTehran(),
): ResolvedLifecycleStatus {
  if (links.cancellations.length > 0) return "Cancelled";
  if (links.reversals.length > 0) return "Reversed";
  // Correction does not erase the original — original stays Scheduled|Effective
  // for attributable history; resolved display follows evaluation-by-date.
  // Deterministic stub: when a correction exists, original remains visible as
  // its evaluation status; callers surface correction links separately.
  return evaluationStatusAsOf(event, asOfDate);
}

export async function loadEventWithResolvedStatus(
  db: PgQueryable,
  eventId: string,
  asOfDate: string = todayDateOnlyTehran(),
): Promise<{
  event: BusinessEventRecord;
  links: EventChainLinks;
  resolvedStatus: ResolvedLifecycleStatus;
} | null> {
  const event = await getBusinessEventById(db, eventId);
  if (!event) return null;
  const links = await listChainLinksForEvent(db, eventId);
  return {
    event,
    links,
    resolvedStatus: resolveLifecycleStatus(event, links, asOfDate),
  };
}

/**
 * Walk corrects_event_id chain looking for self-ref / cycles.
 * Returns the first problem code or null when acyclic.
 */
export async function detectCorrectionCycle(
  db: PgQueryable,
  /** New edge: fromId corrects toId (fromId may be prospective / not yet stored). */
  fromId: string,
  toId: string,
): Promise<"self_ref" | "cycle" | "missing_target" | null> {
  if (fromId === toId) return "self_ref";

  const target = await getBusinessEventById(db, toId);
  if (!target) return "missing_target";

  const seen = new Set<string>([fromId]);
  let current: string | null = toId;
  let depth = 0;
  const MAX = 64;
  while (current) {
    if (seen.has(current)) return "cycle";
    seen.add(current);
    depth += 1;
    if (depth > MAX) return "cycle";
    const row = await getBusinessEventById(db, current);
    if (!row) return "missing_target";
    current = row.correctsEventId;
  }
  return null;
}
