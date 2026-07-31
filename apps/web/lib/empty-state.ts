/**
 * Empty-state taxonomy (Story 8.9 / UX-DR32).
 * Prefer FeedbackMessage kind="empty" for rendering.
 */

import { operationalCopy } from "@/lib/operational-copy";

export type EmptyStateKind = "noDataYet" | "filtered" | "notPermitted";

export type EmptyStateCopy = {
  kind: EmptyStateKind;
  titleFa: string;
  bodyFa: string;
  /** Primary next-step CTA label when applicable. */
  actionLabelFa: string | null;
};

/**
 * Typed helper for empty taxonomy copy.
 * Surface-specific no-data-yet body may override via `noDataYetBodyFa`.
 */
export function emptyStateCopy(
  kind: EmptyStateKind,
  options?: { noDataYetBodyFa?: string; noDataYetActionFa?: string },
): EmptyStateCopy {
  if (kind === "filtered") {
    return {
      kind,
      titleFa: operationalCopy.emptySearch,
      bodyFa: operationalCopy.emptySearch,
      actionLabelFa: operationalCopy.clearFilters,
    };
  }
  if (kind === "notPermitted") {
    return {
      kind,
      titleFa: operationalCopy.accessDeniedTitle,
      bodyFa: operationalCopy.accessDeniedBody,
      actionLabelFa: operationalCopy.accessDeniedReturn,
    };
  }
  return {
    kind: "noDataYet",
    titleFa: options?.noDataYetBodyFa ?? operationalCopy.personListEmpty,
    bodyFa: options?.noDataYetBodyFa ?? operationalCopy.personListEmpty,
    actionLabelFa: options?.noDataYetActionFa ?? null,
  };
}
