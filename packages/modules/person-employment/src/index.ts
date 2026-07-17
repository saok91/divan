/**
 * @divan/person-employment — Person / Employment domain (AD-3).
 * Story 3.1: Person identity. Story 3.2: Employment projection + invariants.
 * Story 3.3: Data-Dictionary-governed profile fields (FR-7).
 * Start/Return/Terminate product flows = Epic 4 (4.5–4.6).
 */

export {
  getPersonDb,
  setPersonDb,
} from "./db";

export {
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
  PERSON_DATA_CATEGORY,
  NATIONAL_ID_DATA_CATEGORY,
  PersonIdentityError,
  EmploymentError,
  DataDictionaryError,
  MSG_DUPLICATE_PERSONNEL_CODE_FA,
  MSG_DUPLICATE_NATIONAL_ID_FA,
  MSG_PERSON_NOT_FOUND_FA,
  MSG_BLOCKED_IDENTITY_OPERATION_FA,
  MSG_SENTINEL_OPTIONAL_FA,
  MSG_REQUIRED_FIELD_FA,
  MSG_OVERLAPPING_EMPLOYMENT_FA,
  MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
  MSG_EMPLOYMENT_NOT_FOUND_FA,
  MSG_CONCURRENT_EMPLOYMENT_FORBIDDEN_FA,
  MSG_EMPLOYMENT_ALREADY_CLOSED_FA,
  MSG_FIELD_NOT_ENABLED_FA,
  MSG_MOBILE_PHONE_FORMAT_FA,
  MSG_DATA_ELEMENT_NOT_FOUND_FA,
  MSG_DATA_ELEMENT_ENABLE_REJECT_FA,
  MSG_DATA_ELEMENT_ENABLE_LATER_FA,
  MSG_DATA_ELEMENT_ENABLE_INCOMPLETE_FA,
  MSG_FREE_TEXT_PURPOSE_REQUIRED_FA,
  MSG_DERIVED_SENSITIVITY_DOWNGRADE_FA,
} from "./errors";

export type {
  PersonIdentityErrorCode,
  EmploymentErrorCode,
  DataDictionaryErrorCode,
} from "./errors";

export {
  normalizeDigitsForMatch,
  normalizeIranianMobilePhone,
  toLatinDigits,
} from "./digits";

export {
  normalizeOptionalString,
  requireNonEmpty,
} from "./normalize";

export {
  createPerson,
  updatePersonIdentity,
  getPersonById,
  getPersonByPersonnelCode,
  listPersons,
  correctPersonnelCode,
  mergePersons,
  splitPerson,
  matchReturn,
  assertPersonSurvivesEmploymentEnd,
  PERSON_FIELD_MAX,
} from "./person";

export type {
  PersonRecord,
  CreatePersonInput,
  UpdatePersonIdentityInput,
  PersonActorCtx,
} from "./person";

export {
  DATA_DICTIONARY_REGISTRY_VERSION,
  DATA_ELEMENT_MANDATORY_METADATA,
  DATA_ELEMENT_SEED,
  ELEMENT_ID,
  ELEMENT_TO_PERSON_FIELD,
  PERSON_FIELD_CATEGORY,
  PERSON_FIELD_TO_ELEMENT,
  assertDerivedSensitivityAllowed,
  assertFieldEnabled,
  assertFreeTextAllowed,
  assertPersonFieldEnabled,
  enableDataElement,
  getDataElement,
  getEnabledPersonFieldKeys,
  isMetadataComplete,
  listDataElements,
  listEnabledProfileFields,
  seedDataDictionary,
} from "./data-dictionary";

export type {
  DataElementDisposition,
  DataElementMandatoryMetaKey,
  DataElementRecord,
  EnabledProfileField,
  PersonProfileFieldKey,
  SeedDataElementDef,
} from "./data-dictionary";

export {
  projectPersonForRead,
  projectPersonRecord,
} from "./person-projection";

export type { ProjectPersonOptions } from "./person-projection";

export {
  applyEmploymentProjection,
  closeEmploymentProjection,
  listEmploymentsForPerson,
  getEmploymentById,
  getActiveEmploymentAsOf,
  assertValidEmploymentInterval,
  assertNoOverlapWithExisting,
  isEmploymentActiveAsOf,
  assertAtMostOneActiveAsOf,
} from "./employment";

export type {
  EmploymentRecord,
  ApplyEmploymentProjectionInput,
} from "./employment";

export type { EmploymentInterval } from "./employment-invariants";

export {
  EMPLOYMENT_MINIMUM_FACTS,
} from "./employment-minimum-facts";

export type { EmploymentMinimumFact } from "./employment-minimum-facts";

export {
  SEED_PERSON_IDENTITY,
  SEED_EMPLOYMENT_LIFECYCLE,
  seedPersonIdentityFixtures,
  seedPersonPermissionFixtures,
  seedDemoPerson,
  seedDemoEmployments,
  seedEmploymentLifecycleFixtures,
  seedDataDictionaryFixtures,
} from "./seed";

export {
  assertActorHasPersonRead,
  assertActorHasPersonWrite,
  MSG_PERSON_PERMISSION_REQUIRED_FA,
} from "./permissions";

export { POPULATION_SUBJECT_ID_TARGET } from "./population-cutover";
