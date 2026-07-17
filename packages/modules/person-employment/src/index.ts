/**
 * @divan/person-employment — Person / Employment domain (AD-3).
 * Story 3.1: Person identity master-data only. Employment mutations = Epic 4.
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
  MSG_DUPLICATE_PERSONNEL_CODE_FA,
  MSG_DUPLICATE_NATIONAL_ID_FA,
  MSG_PERSON_NOT_FOUND_FA,
  MSG_BLOCKED_IDENTITY_OPERATION_FA,
  MSG_SENTINEL_OPTIONAL_FA,
  MSG_REQUIRED_FIELD_FA,
} from "./errors";

export type { PersonIdentityErrorCode } from "./errors";

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
  SEED_PERSON_IDENTITY,
  seedPersonIdentityFixtures,
  seedPersonPermissionFixtures,
  seedDemoPerson,
} from "./seed";

export {
  assertActorHasPersonRead,
  assertActorHasPersonWrite,
  MSG_PERSON_PERMISSION_REQUIRED_FA,
} from "./permissions";

export { POPULATION_SUBJECT_ID_TARGET } from "./population-cutover";
