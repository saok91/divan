/**
 * Client-safe UUID shape check (Story 9.7).
 * Do NOT import `@divan/person-employment` in Client Components — that package
 * pulls `pg` into the browser bundle.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` looks like a UUID (Person / Team / Event ids). */
export function isUuid(id: string): boolean {
  return UUID_RE.test(id.trim());
}
