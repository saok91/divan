/**
 * Project compensation facts through category omit (Story 3.4 / FR-8).
 * Unauthorized compensation keys → key absence (never mask with 0 / ***).
 */

import {
  omitUnauthorizedCategories,
  type CategoryRegistry,
} from "@divan/audit-envelope";

import type { CompensationFactRecord } from "./compensation";
import { COMPENSATION_DATA_CATEGORY } from "./category";

/** All sensitive compensation/contractual value keys map to compensation category. */
export const COMPENSATION_FIELD_CATEGORY: Record<string, string> = {
  amount: COMPENSATION_DATA_CATEGORY,
  components: COMPENSATION_DATA_CATEGORY,
  currency: COMPENSATION_DATA_CATEGORY,
  changeType: COMPENSATION_DATA_CATEGORY,
  notes: COMPENSATION_DATA_CATEGORY,
  collaborationType: COMPENSATION_DATA_CATEGORY,
  contractType: COMPENSATION_DATA_CATEGORY,
  contractingEntity: COMPENSATION_DATA_CATEGORY,
  insuringEntity: COMPENSATION_DATA_CATEGORY,
  contractReference: COMPENSATION_DATA_CATEGORY,
  contractStartDate: COMPENSATION_DATA_CATEGORY,
  contractEndDateExclusive: COMPENSATION_DATA_CATEGORY,
};

const VALUE_KEYS = Object.keys(COMPENSATION_FIELD_CATEGORY);

export type ProjectCompensationOptions = {
  allowedCategories: ReadonlySet<string>;
  categories: CategoryRegistry;
};

/**
 * Omit unauthorized compensation category keys.
 * Structural keys (id, dates, provenance) remain for authorized callers
 * that already passed envelope — value keys still require category grant.
 */
export function projectCompensationRecord(
  fact: CompensationFactRecord,
  options: ProjectCompensationOptions,
): Partial<CompensationFactRecord> {
  const gated: Record<string, unknown> = {
    id: fact.id,
    personId: fact.personId,
    employmentId: fact.employmentId,
    factKind: fact.factKind,
    startDate: fact.startDate,
    endDateExclusive: fact.endDateExclusive,
    sourceEventId: fact.sourceEventId,
    recordedAt: fact.recordedAt,
    createdAt: fact.createdAt,
    updatedAt: fact.updatedAt,
  };

  for (const key of VALUE_KEYS) {
    gated[key] = fact[key as keyof CompensationFactRecord];
  }

  return omitUnauthorizedCategories(
    gated,
    COMPENSATION_FIELD_CATEGORY,
    options.allowedCategories,
    options.categories,
  ) as Partial<CompensationFactRecord>;
}
