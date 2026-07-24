/**
 * Permission-safe personnel search seam for command palette (Story 5.1 / FR-33).
 *
 * TODO(OQ-2): Uniform timing/copy for out-of-scope vs not-found
 * must land with AR-ACCESS — do not invent enumeration-safe delays here.
 */

import { vanillaApi } from "@/lib/trpc/vanilla";

export type PersonnelSearchHit = {
  id: string;
  /** Display label (name + code when real data exists). */
  label: string;
  /** Profile deep-link (Story 5.1). */
  href: string;
};

export type PersonnelSearchParams = {
  query: string;
  /** Latin-normalized query for matching (digits stripped/normalized). */
  normalizedQuery: string;
};

function profileHref(personId: string): string {
  return `/personnel/profile/${encodeURIComponent(personId)}`;
}

/**
 * Same permission-safe server search as فهرست پرسنل (`person.search`).
 * Client-only — returns [] on empty query, network/auth errors, or denied.
 */
export async function searchPersonnel(
  params: PersonnelSearchParams,
): Promise<PersonnelSearchHit[]> {
  if (typeof window === "undefined") {
    return [];
  }

  const q = (params.normalizedQuery || params.query).trim();
  if (!q) return [];

  try {
    const result = await vanillaApi.person.search.query({
      channel: "search",
      normalizedQuery: q,
    });

    if (result.outcome !== "allowed") {
      return [];
    }

    return result.rows.map((row) => ({
      id: row.id,
      label: `${row.givenName} ${row.familyName} (${row.personnelCode})`.trim(),
      href: profileHref(row.id),
    }));
  } catch {
    return [];
  }
}
