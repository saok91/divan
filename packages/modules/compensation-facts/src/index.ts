/**
 * Compensation facts module boundary (Story 2.2 / AD-3).
 *
 * Contract (enforce when Story 3.4 lands):
 * - Compensation facts live in a **dedicated schema + repository** owned by
 *   this module — not scattered across other domains.
 * - Other modules and `apps/web` MUST NOT import Prisma models, raw SQL, or
 *   table names for compensation data directly.
 * - Callers reach compensation only through this module’s public API, and only
 *   after audit-envelope authorize (`dataCategory: "compensation"`, separate
 *   `action: "export"` when exporting). Category stays **disabled** until an
 *   AR-DATA disposition enables it (Story 2.2 registry hooks).
 *
 * This file is a typed seam only — no Prisma schema, migrations, or payroll
 * logic (FR8 / Story 3.4).
 */

/** Stable category id — must stay aligned with audit-envelope category hooks. */
export const COMPENSATION_DATA_CATEGORY = "compensation" as const;

/**
 * Placeholder repository surface. Real implementation lands in Story 3.4.
 * Importing this type from unrelated modules is fine; importing DB clients
 * for compensation tables from outside this package is not.
 */
export type CompensationFactsRepository = {
  readonly _brand: "CompensationFactsRepository";
};

/**
 * Documents the boundary for callers/docs. No runtime DB access yet.
 */
export function describeCompensationFactsBoundary(): {
  category: typeof COMPENSATION_DATA_CATEGORY;
  schemaOwner: "@divan/compensation-facts";
  prismaImportAllowedOutsideModule: false;
} {
  return {
    category: COMPENSATION_DATA_CATEGORY,
    schemaOwner: "@divan/compensation-facts",
    prismaImportAllowedOutsideModule: false,
  };
}
