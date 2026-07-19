/**
 * Pure helpers for Access people panel (Story 4b.5).
 * Kept free of React so selfcheck can assert AC predicates.
 */

export type EntitlementLike = {
  accessRoleIds: string[];
  organizationalScopeIds: string[];
  accessRoleCodes: string[];
  externalDirectoryId: string | null;
};

/** Same empty-assignments predicate as the legacy AccessAdminPanel. */
export function hasNoEntitlementAssignments(
  rows: readonly EntitlementLike[],
): boolean {
  return !rows.some(
    (row) =>
      row.accessRoleIds.length > 0 || row.organizationalScopeIds.length > 0,
  );
}

export function directoryLinkStatus(
  externalDirectoryId: string | null,
): "linked" | "unlinked" {
  return externalDirectoryId?.trim() ? "linked" : "unlinked";
}

/** Normalize directory id for dirty compare / persist (whitespace-only → empty). */
export function normalizeDirectoryLink(
  externalDirectoryId: string | null | undefined,
): string {
  return externalDirectoryId?.trim() || "";
}

/** First role code for enum filter match; cell may still show full join. */
export function primaryRoleCode(accessRoleCodes: string[]): string {
  return accessRoleCodes[0] ?? "";
}

export function joinPersianList(items: string[]): string {
  return items.length > 0 ? items.join("، ") : "—";
}

export const PEOPLE_SECTION_DEFAULT_FILTERS: Record<string, string | string[]> =
  {
    status: ["active"],
  };
