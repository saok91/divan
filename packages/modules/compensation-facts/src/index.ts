/**
 * @divan/compensation-facts — isolated compensation / contractual facts (AD-3 / FR-8).
 * Story 3.4: schema + projection writers + reads. Mutations via Epic 4 (4.8).
 * No payroll / tax / insurance / payslip / payment calculation.
 */

export {
  COMPENSATION_DATA_CATEGORY,
  COMPENSATION_DB_SCHEMA,
} from "./category";

export {
  getCompensationDb,
  setCompensationDb,
} from "./db";

export {
  CompensationError,
  COMPENSATION_READ_PERMISSION,
  MSG_OVERLAPPING_COMPENSATION_FA,
  MSG_INVALID_COMPENSATION_INTERVAL_FA,
  MSG_COMPENSATION_NOT_FOUND_FA,
  MSG_CONCURRENT_COMPENSATION_FORBIDDEN_FA,
  MSG_PERSON_NOT_FOUND_FA,
  MSG_EMPLOYMENT_NOT_FOUND_FA,
  MSG_COMPENSATION_ALREADY_CLOSED_FA,
  MSG_FIELD_NOT_ENABLED_FA,
  MSG_SENTINEL_OPTIONAL_FA,
  MSG_INVALID_FACT_KIND_FA,
  MSG_FREE_TEXT_PURPOSE_REQUIRED_FA,
} from "./errors";

export type { CompensationErrorCode } from "./errors";

export {
  applyCompensationProjection,
  applyContractualProjection,
  closeCompensationProjection,
  listCompensationFactsForPerson,
  listContractualFactsForPerson,
  getCompensationFactById,
  getCompensationAsOf,
  getContractualAsOf,
  FACT_KIND,
  COMPENSATION_FIELD_ELEMENT,
  assertValidCompensationInterval,
  assertNoOverlapWithExisting,
  isCompensationActiveAsOf,
  assertAtMostOneActiveAsOf,
} from "./compensation";

export type {
  FactKind,
  CompensationFactRecord,
  ApplyCompensationProjectionInput,
  ApplyContractualProjectionInput,
} from "./compensation";

export type { CompensationInterval } from "./compensation-invariants";

export {
  projectCompensationRecord,
  COMPENSATION_FIELD_CATEGORY,
} from "./projection";

export type { ProjectCompensationOptions } from "./projection";

export {
  COMPENSATION_MINIMUM_FACTS,
} from "./compensation-minimum-facts";

export type { CompensationMinimumFact } from "./compensation-minimum-facts";

export {
  SEED_COMPENSATION_FACTS,
  seedDemoCompensationFacts,
  seedCompensationFactsFixtures,
} from "./seed";

/**
 * Documents the AD-3 boundary for callers/docs.
 */
export function describeCompensationFactsBoundary(): {
  category: typeof import("./category").COMPENSATION_DATA_CATEGORY;
  schemaOwner: "@divan/compensation-facts";
  dbSchema: typeof import("./category").COMPENSATION_DB_SCHEMA;
  prismaImportAllowedOutsideModule: false;
  payrollCalculationAllowed: false;
} {
  return {
    category: "compensation",
    schemaOwner: "@divan/compensation-facts",
    dbSchema: "compensation",
    prismaImportAllowedOutsideModule: false,
    payrollCalculationAllowed: false,
  };
}
