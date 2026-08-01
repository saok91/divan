/**
 * Canonical personnel profile deep-link helper (Story 9.7).
 * Path identity is always UUID (or code that the profile page redirects to UUID).
 */

export type ProfileHrefOptions = {
  /** When set, profile timeline should honor `?event=` focus. */
  eventId?: string;
};

/**
 * Build `/personnel/profile/{personId}` with optional `?event=` query.
 */
export function profileHref(
  personId: string,
  options?: ProfileHrefOptions | string,
): string {
  const eventId =
    typeof options === "string" ? options : options?.eventId;
  const base = `/personnel/profile/${encodeURIComponent(personId)}`;
  if (!eventId) return base;
  return `${base}?event=${encodeURIComponent(eventId)}`;
}
