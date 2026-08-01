/**
 * Shared reconcile deep-link query builders (Story 9.7).
 * Consumers hydrate these keys — keep naming aligned with panel URL contracts.
 */

export type EventsReconcileQuery = {
  teamId?: string;
  eventType?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  personId?: string;
};

export type ListReconcileQuery = {
  teamId?: string;
};

export type CapacityReconcileQuery = {
  teamId?: string;
};

function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
): void {
  const trimmed = value?.trim();
  if (trimmed) params.set(key, trimmed);
}

/** `/personnel-events/events` with optional filter presets. */
export function eventsReconcileHref(query: EventsReconcileQuery = {}): string {
  const params = new URLSearchParams();
  appendParam(params, "teamId", query.teamId);
  appendParam(params, "eventType", query.eventType);
  appendParam(params, "effectiveFrom", query.effectiveFrom);
  appendParam(params, "effectiveTo", query.effectiveTo);
  appendParam(params, "person", query.personId);
  const qs = params.toString();
  return qs ? `/personnel-events/events?${qs}` : "/personnel-events/events";
}

/** `/personnel/list` with optional team preset. */
export function personnelListReconcileHref(
  query: ListReconcileQuery = {},
): string {
  const params = new URLSearchParams();
  appendParam(params, "teamId", query.teamId);
  const qs = params.toString();
  return qs ? `/personnel/list?${qs}` : "/personnel/list";
}

/** `/headcount/capacity` with optional team preset. */
export function capacityReconcileHref(
  query: CapacityReconcileQuery = {},
): string {
  const params = new URLSearchParams();
  appendParam(params, "teamId", query.teamId);
  const qs = params.toString();
  return qs ? `/headcount/capacity?${qs}` : "/headcount/capacity";
}
