/**
 * @divan/person-employment — Person / Employment domain (AD-3).
 * Story 3.1: Person identity. Story 3.2: Employment projection + invariants.
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
} from "./errors";

export type {
  PersonIdentityErrorCode,
  EmploymentErrorCode,
} from "./errors";

export {
  normalizeDigitsForMatch,
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
} from "./seed";

export {
  assertActorHasPersonRead,
  assertActorHasPersonWrite,
  MSG_PERSON_PERMISSION_REQUIRED_FA,
} from "./permissions";

export { POPULATION_SUBJECT_ID_TARGET } from "./population-cutover";
