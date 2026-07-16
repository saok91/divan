/**
 * Permission-safe personnel search seam for command palette.
 * Story 1.6: stub returns empty (Epic 5 / Story 5.1 plugs real search).
 *
 * TODO(Epic 5 / OQ-2): Uniform timing/copy for out-of-scope vs not-found
 * must land with AR-ACCESS — do not invent enumeration-safe delays here.
 */

export type PersonnelSearchHit = {
  id: string;
  /** Display label (name + code when real data exists). */
  label: string;
  /** Profile route when Story 5.1 wires navigation. */
  href: string;
};

export type PersonnelSearchParams = {
  query: string;
  /** Latin-normalized query for matching (digits stripped/normalized). */
  normalizedQuery: string;
};

/**
 * Async empty stub — shape preserved so Story 5.1 can replace the body
 * without rewriting the command palette.
 */
export async function searchPersonnel(
  params: PersonnelSearchParams,
): Promise<PersonnelSearchHit[]> {
  void params;
  // Short delay so aria-busy is observable in smoke tests.
  // TODO(Epic 5 / OQ-2): replace with real permission-safe search + AR-ACCESS timing.
  await new Promise((resolve) => setTimeout(resolve, 120));
  return [];
}
