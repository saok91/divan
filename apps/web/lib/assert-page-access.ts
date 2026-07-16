/**
 * Layout ≠ RSC / page-level access assert pattern (Epic 1 retro).
 *
 * `(app)/layout.tsx` path swap alone does NOT stop forbidden `page.tsx` execution.
 * Any future data-fetching route MUST call this (or equivalent) in the page or a
 * shared page wrapper BEFORE loaders — chrome/nav hide is not authz.
 *
 * Story 2.1 ships the helper; domain RSC loaders still deferred.
 */
import {
  canAccessPath,
  type CoarseRole,
} from "@divan/identity-access";

export class PageAccessDeniedError extends Error {
  readonly pathname: string;
  readonly coarseRole: CoarseRole;

  constructor(pathname: string, coarseRole: CoarseRole) {
    super("PAGE_ACCESS_DENIED");
    this.name = "PageAccessDeniedError";
    this.pathname = pathname;
    this.coarseRole = coarseRole;
  }
}

/**
 * Assert coarse path access before any data loader.
 * Future: may also call audit-envelope for category-scoped RSC fetches.
 */
export function assertPageAccess(
  coarseRole: CoarseRole,
  pathname: string,
): void {
  if (!canAccessPath(coarseRole, pathname)) {
    throw new PageAccessDeniedError(pathname, coarseRole);
  }
}
