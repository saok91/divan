/**
 * @divan/person-employment — Person / Employment / Org domain (AD-3).
 * Story 3.1: Person identity. Story 3.2: Employment projection + invariants.
 * Story 3.3: Data-Dictionary-governed profile fields (FR-7).
 * Story 3.5: Organizational Unit hierarchy (FR-9) — not OrganizationalScope authz.
 * Story 3.6: Job reference concepts (FR-10) — Role / Title / Ladder / Grade / Seniority.
 * Story 3.7: Primary Assignment integrity (FR-11) — projection + exactly-one + Team/job facts.
 * Story 3.8: Secondary Assignment fidelity (FR-12) — dual-role projection; no headcount; inventory gate.
 * Story 3.9: Derived management relationships (FR-13) — compute from Primary+org+Role; no editable shadow.
 * Story 4.2: Draft working store + finalize/conflict substrate (FR-15 / FR-19 / AD-6).
 * Story 4.3: Scheduled semantics + Cancel / Reverse / Correction (FR-16 / FR-17).
 * Start/Return/Terminate / Secondary create-change-end product flows = Epic 4 (4.5–4.8).
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
  ORGANIZATION_READ_PERMISSION,
  ORGANIZATION_WRITE_PERMISSION,
  ORGANIZATION_DATA_CATEGORY,
  JOB_REFERENCE_READ_PERMISSION,
  JOB_REFERENCE_WRITE_PERMISSION,
  JOB_REFERENCE_DATA_CATEGORY,
  PersonIdentityError,
  EmploymentError,
  DataDictionaryError,
  OrgUnitError,
  JobRefError,
  PrimaryAssignmentError,
  SecondaryAssignmentError,
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
  MSG_ORG_UNIT_NOT_FOUND_FA,
  MSG_INVALID_PARENT_TYPE_FA,
  MSG_CHILD_OUTSIDE_PARENT_VALIDITY_FA,
  MSG_IMPOSSIBLE_REPARENT_FA,
  MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA,
  MSG_DUPLICATE_ORG_CODE_FA,
  MSG_INVALID_ORG_INTERVAL_FA,
  MSG_ORG_DEACTIVATE_END_REQUIRED_FA,
  MSG_INVALID_ORG_UNIT_TYPE_FA,
  MSG_CORRUPT_ORG_UNIT_TYPE_FA,
  MSG_INACTIVE_PARENT_FA,
  MSG_ORG_NAME_REQUIRED_FA,
  MSG_ORG_CODE_REQUIRED_FA,
  MSG_BLOCKED_ORG_OPERATION_FA,
  MSG_ORG_PERMISSION_REQUIRED_FA,
  MSG_JOB_REF_NOT_FOUND_FA,
  MSG_GRADE_NOT_IN_LADDER_FA,
  MSG_DUPLICATE_JOB_REF_CODE_FA,
  MSG_DUPLICATE_JOB_REF_RANK_FA,
  MSG_INVALID_HALF_GRADE_RANK_FA,
  MSG_LADDER_HAS_ACTIVE_GRADES_FA,
  MSG_BLOCKED_JOB_REF_OPERATION_FA,
  MSG_INVALID_JOB_REF_INTERVAL_FA,
  MSG_JOB_REF_DEACTIVATE_END_REQUIRED_FA,
  MSG_JOB_REF_NAME_REQUIRED_FA,
  MSG_JOB_REF_CODE_REQUIRED_FA,
  MSG_JOB_REF_LADDER_REQUIRED_FA,
  MSG_JOB_REF_RANK_REQUIRED_FA,
  MSG_INACTIVE_LADDER_FA,
  MSG_JOB_REF_PERMISSION_REQUIRED_FA,
  MSG_OVERLAPPING_PRIMARY_ASSIGNMENT_FA,
  MSG_PRIMARY_ASSIGNMENT_REQUIRED_FA,
  MSG_PRIMARY_COVERAGE_GAP_FA,
  MSG_PRIMARY_OUTSIDE_EMPLOYMENT_FA,
  MSG_TEAM_UNIT_REQUIRED_FA,
  MSG_PRIMARY_ASSIGNMENT_NOT_FOUND_FA,
  MSG_PRIMARY_ALREADY_CLOSED_FA,
  MSG_INVALID_PRIMARY_INTERVAL_FA,
  MSG_PRIMARY_REF_NOT_FOUND_FA,
  MSG_OVERLAPPING_EQUIVALENT_SECONDARY_FA,
  MSG_SECONDARY_OUTSIDE_EMPLOYMENT_FA,
  MSG_SECONDARY_REASON_REQUIRED_FA,
  MSG_SECONDARY_REASON_OUT_OF_INVENTORY_FA,
  MSG_SECONDARY_PERSON_MISMATCH_FA,
  MSG_SECONDARY_ASSIGNMENT_NOT_FOUND_FA,
  MSG_SECONDARY_ALREADY_CLOSED_FA,
  MSG_INVALID_SECONDARY_INTERVAL_FA,
  MSG_SECONDARY_REF_NOT_FOUND_FA,
  ManagementRelationshipError,
  MSG_AMBIGUOUS_TEAM_MANAGER_FA,
  MSG_AMBIGUOUS_MANAGEMENT_SCOPE_FA,
  MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
  MSG_SENIOR_MANAGER_POLICY_UNDEFINED_FA,
  PERSONNEL_EVENT_DRAFT_PERMISSION,
  PERSONNEL_EVENT_FINALIZE_PERMISSION,
  PERSONNEL_EVENT_CANCEL_PERMISSION,
  PERSONNEL_EVENT_REVERSE_PERMISSION,
  PERSONNEL_EVENT_CORRECT_PERMISSION,
  COMPENSATION_WRITE_PERMISSION,
  PERSONNEL_EVENT_DATA_CATEGORY,
  PersonnelEventError,
  MSG_DRAFT_NOT_FOUND_FA,
  MSG_DRAFT_NOT_EDITABLE_FA,
  MSG_DRAFT_ALREADY_FINALIZED_FA,
  MSG_DRAFT_DELETED_FA,
  MSG_DRAFT_VERSION_CONFLICT_FA,
  MSG_FINALIZE_BLOCKED_FA,
  MSG_FINALIZE_WARNING_ACK_REQUIRED_FA,
  MSG_FINALIZE_OVERRIDE_REQUIRED_FA,
  MSG_FINALIZE_STALE_SNAPSHOT_FA,
  MSG_FINALIZE_PENDING_REVIEW_FA,
  MSG_FINALIZE_IDEMPOTENCY_CONFLICT_FA,
  MSG_INVALID_DRAFT_EFFECTIVE_DATE_FA,
  MSG_PERSONNEL_EVENT_PERMISSION_REQUIRED_FA,
  MSG_COMPENSATION_WRITE_REQUIRED_FA,
  MSG_SENSITIVE_DRAFT_PAYLOAD_FA,
  MSG_HEADCOUNT_CHECK_BLOCKED_FA,
  MSG_HEADCOUNT_NO_CAPACITY_FA,
  MSG_HEADCOUNT_PORT_UNAVAILABLE_FA,
  MSG_MISSING_PERSONNEL_CODE_FA,
  MSG_ANONYMIZED_RETURN_BLOCKED_FA,
  MSG_BASELINE_BOUNDARY_BLOCKED_FA,
  MSG_BASELINE_BOUNDARY_INVALID_FA,
  MSG_ASOF_INVALID_FA,
  MSG_BASELINE_DISCLOSURE_LIMITED_FA,
  MSG_BASELINE_DISCLOSURE_UNCONFIGURED_FA,
  MSG_BASELINE_DISCLOSURE_WITHIN_FA,
  MSG_RISK_TIER_PENDING_REVIEW_FA,
  MSG_EVENT_NOT_FOUND_FA,
  MSG_CANCEL_REASON_REQUIRED_FA,
  MSG_REVERSE_REASON_REQUIRED_FA,
  MSG_CORRECTION_REASON_REQUIRED_FA,
  MSG_CANCEL_WRONG_STATE_FA,
  MSG_CANCEL_AFTER_EFFECT_FA,
  MSG_REVERSE_WRONG_STATE_FA,
  MSG_CORRECTION_WRONG_STATE_FA,
  MSG_FINALIZE_LIFECYCLE_CHAIN_FORBIDDEN_FA,
  MSG_CORRECTION_SELF_REF_FA,
  MSG_CORRECTION_CYCLE_FA,
  MSG_BROKEN_CORRECTION_REF_FA,
} from "./errors";

export type {
  PersonIdentityErrorCode,
  EmploymentErrorCode,
  DataDictionaryErrorCode,
  OrgUnitErrorCode,
  JobRefErrorCode,
  PrimaryAssignmentErrorCode,
  SecondaryAssignmentErrorCode,
  ManagementRelationshipErrorCode,
  PersonnelEventErrorCode,
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
  getPersonsByIds,
  getPersonByPersonnelCode,
  listPersons,
  listPersonsForScopedSearch,
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
  bindDataDictionaryRegistryVersion,
  assertDerivedSensitivityAllowed,
  assertFieldEnabled,
  assertFreeTextAllowed,
  assertPersonFieldEnabled,
  enableDataElement,
  getDataElement,
  getEnabledPersonFieldKeys,
  isMetadataComplete,
  isRetentionLifecycleClassComplete,
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
  createOrgUnit,
  activateOrgUnit,
  deactivateOrgUnit,
  updateOrgUnitIdentity,
  reparentOrgUnit,
  getOrgUnitById,
  getOrgUnitByCode,
  getOrgUnitAsOf,
  listOrgUnits,
  listChildren,
  getHierarchyAsOf,
  assertOrgUnitDeactivationAllowed,
  registerOrgUnitDependencyHook,
  clearOrgUnitDependencyHooksForTests,
  assertValidOrgInterval,
  assertChildWithinParent,
  assertValidParentType,
  isOrgUnitActiveAsOf,
} from "./org-unit";

export { ORG_UNIT_TYPES, REQUIRED_PARENT_TYPE } from "./org-unit-invariants";

export type {
  OrgUnitRecord,
  CreateOrgUnitInput,
  UpdateOrgUnitIdentityInput,
  OrgUnitHierarchyNode,
  OrgUnitDependencyCheckResult,
  OrgUnitDependencyHook,
} from "./org-unit";

export type { OrgInterval, OrgUnitType } from "./org-unit-invariants";

export {
  createOrganizationalRole,
  activateOrganizationalRole,
  deactivateOrganizationalRole,
  updateOrganizationalRoleIdentity,
  getOrganizationalRoleById,
  getOrganizationalRoleByCode,
  listOrganizationalRoles,
  createJobTitle,
  activateJobTitle,
  deactivateJobTitle,
  updateJobTitleIdentity,
  getJobTitleById,
  getJobTitleByCode,
  listJobTitles,
  createLadder,
  activateLadder,
  deactivateLadder,
  updateLadderIdentity,
  getLadderById,
  getLadderByCode,
  listLadders,
  createGrade,
  activateGrade,
  deactivateGrade,
  updateGradeIdentity,
  getGradeById,
  getGradeByCode,
  listGradesForLadder,
  createSeniority,
  activateSeniority,
  deactivateSeniority,
  updateSeniorityIdentity,
  getSeniorityById,
  getSeniorityByCode,
  listSeniorities,
  assertJobRefDeactivationAllowed,
  assertJobRefChangeAllowed,
  registerJobRefDependencyHook,
  clearJobRefDependencyHooksForTests,
  assertValidJobRefInterval,
  assertGradeBelongsToLadder,
  assertValidHalfGradeRank,
  isJobRefActiveAsOf,
  JOB_REF_NO_GRADE_SENIORITY_MAPPING,
} from "./job-reference";

export type {
  JobRefBaseRecord,
  OrganizationalRoleRecord,
  JobTitleRecord,
  LadderRecord,
  GradeRecord,
  SeniorityRecord,
  CreateJobRefInput,
  CreateGradeInput,
  UpdateJobRefIdentityInput,
  UpdateGradeIdentityInput,
  JobRefDependencyCheckResult,
  JobRefDependencyHook,
  JobRefInterval,
  JobRefConcept,
} from "./job-reference";

export {
  applyPrimaryAssignmentProjection,
  closePrimaryAssignmentProjection,
  listPrimaryAssignmentsForEmployment,
  getPrimaryAssignmentById,
  getActivePrimaryAssignmentAsOf,
  resolveTeamMembershipAsOf,
  ensurePrimaryAssignmentHooksRegistered,
  resetPrimaryAssignmentHooksRegistrationForTests,
  assertValidPrimaryInterval,
  assertNoOverlapWithExistingPrimaries,
  isPrimaryActiveAsOf,
  assertExactlyOneActivePrimaryAsOf,
  assertPrimaryWithinEmployment,
  assertPrimaryCoverageForActiveEmployment,
  assertTeamUnitIsTeam,
  assertGradeMatchesLadder,
} from "./primary-assignment";

export type {
  PrimaryAssignmentRecord,
  ApplyPrimaryAssignmentProjectionInput,
  TeamMembershipAsOf,
} from "./primary-assignment";

export type { PrimaryInterval } from "./primary-assignment-invariants";

export {
  applySecondaryAssignmentProjection,
  closeSecondaryAssignmentProjection,
  getSecondaryAssignmentById,
  listSecondaryAssignmentsForEmployment,
  listSecondaryAssignmentsForPerson,
  listActiveSecondaryAssignmentsAsOf,
  ensureSecondaryAssignmentHooksRegistered,
  resetSecondaryAssignmentHooksRegistrationForTests,
  assertValidSecondaryInterval,
  assertNoEquivalentOverlap,
  assertPersonMatchesEmployment,
  assertSecondaryWithinEmployment,
  isSecondaryActiveAsOf,
  assertSecondaryGradeMatchesLadder,
  AR_SECONDARY_INVENTORY,
  assertReasonTypeInInventory,
  isReasonTypeInInventory,
  normalizeReasonType,
} from "./secondary-assignment";

export type {
  SecondaryAssignmentRecord,
  ApplySecondaryAssignmentProjectionInput,
  ListActiveSecondaryAsOfScope,
  SecondaryInterval,
  ArSecondaryReasonType,
} from "./secondary-assignment";

export {
  resolveTeamManagerAsOf,
  listTeamMembersAsOf,
  listManagedPersonsAsOf,
  deriveManagementEdgesAsOf,
  resolveSeniorManagerScopeOrgUnitAsOf,
  buildManagementRelationshipsFromDerivation,
} from "./management-relationship";

export type {
  TeamManagerAsOf,
  ManagementEdge,
  PopulationManagementRelationship,
  ListTeamMembersOptions,
} from "./management-relationship";

export {
  AR_MANAGEMENT_ROLE_REGISTRY,
  assertManagementRoleRegistryValid,
  isMiddleManagerRoleCode,
  isSeniorManagerRoleCode,
  isApprovedSeniorManagerTargetUnitType,
  normalizeManagementRoleCode,
} from "./management-role-registry";

export type {
  ArMiddleManagerRoleCode,
  ArSeniorManagerRoleCode,
} from "./management-role-registry";

export {
  assertValidAsOfDate,
  intersectHalfOpenIntervals,
  throwAmbiguousTeamManager,
  throwAmbiguousManagementScope,
} from "./management-relationship-invariants";

export type { HalfOpenInterval } from "./management-relationship-invariants";

export {
  EMPLOYMENT_MINIMUM_FACTS,
} from "./employment-minimum-facts";

export type { EmploymentMinimumFact } from "./employment-minimum-facts";

export {
  SEED_PERSON_IDENTITY,
  SEED_EMPLOYMENT_LIFECYCLE,
  SEED_ORGANIZATION_HIERARCHY,
  SEED_JOB_REFERENCES,
  SEED_PRIMARY_ASSIGNMENT,
  SEED_SECONDARY_ASSIGNMENT,
  SEED_MANAGEMENT_RELATIONSHIPS,
  SEED_PERSONNEL_EVENT,
  seedPersonIdentityFixtures,
  seedPersonPermissionFixtures,
  seedPersonnelEventPermissionFixtures,
  seedDemoPerson,
  seedDemoEmployments,
  seedEmploymentLifecycleFixtures,
  seedDataDictionaryFixtures,
  seedOrganizationPermissionFixtures,
  seedDemoOrganizationHierarchy,
  seedOrganizationHierarchyFixtures,
  seedJobReferencePermissionFixtures,
  seedHeadcountApprovalPermissionFixtures,
  seedHeadcountExemptionPermissionFixtures,
  seedHeadcountOverridePermissionFixtures,
  SEED_HEADCOUNT_OVERRIDE,
  seedDemoJobReferences,
  seedJobReferenceFixtures,
  seedDemoPrimaryAssignments,
  seedPrimaryAssignmentFixtures,
  seedDemoSecondaryAssignments,
  seedSecondaryAssignmentFixtures,
  seedDemoManagementRelationships,
  seedManagementRelationshipFixtures,
} from "./seed";

export {
  assertActorHasPersonRead,
  assertActorHasPersonWrite,
  assertActorHasOrganizationRead,
  assertActorHasOrganizationWrite,
  assertActorHasJobReferenceRead,
  assertActorHasJobReferenceWrite,
  assertActorHasPersonnelEventDraft,
  assertActorHasPersonnelEventFinalize,
  assertActorHasPersonnelEventCancel,
  assertActorHasPersonnelEventReverse,
  assertActorHasPersonnelEventCorrect,
  assertActorHasCompensationWrite,
  actorHasCompensationRead,
  getPersonnelEventLifecycleCaps,
  MSG_PERSON_PERMISSION_REQUIRED_FA,
} from "./permissions";

export {
  getCurrentPersonState,
  listScheduledFutureChanges,
  listPlannedChangesThroughAsOf,
  listRemainingScheduledAfterAsOf,
  buildBaselineDisclosure,
  currentPersonStateFactsForCompare,
  MSG_CURRENT_STATE_RECALC_PENDING_FA,
  MSG_CURRENT_STATE_RECALC_FAILED_FA,
  MSG_CURRENT_STATE_RECALC_STALE_FA,
  MSG_SCHEDULED_SCAN_TRUNCATED_FA,
  SCHEDULED_CHANGES_APPLY_LIMIT,
} from "./current-person-state";

export type {
  BaselineDisclosure,
  DisposalDisclosure,
  CurrentPersonState,
  CurrentPersonStateActorAuthz,
  CurrentPersonStateFreshnessBlock,
  CurrentPersonStateFreshnessCode,
  GetCurrentPersonStateDeps,
  GetCurrentPersonStateOptions,
  GetCurrentPersonStateResult,
  PersonViewSemantics,
  ScheduledFutureChange,
} from "./current-person-state";

export {
  getBaselineBoundaryDate,
  BASELINE_BOUNDARY_ENV,
} from "./baseline-boundary";

export {
  getHistoricalOrgHeadcountState,
  historicalOrgHeadcountFactsForCompare,
  MSG_HIST_ORG_RECALC_PENDING_FA,
  MSG_HIST_ORG_RECALC_FAILED_FA,
  MSG_HIST_ORG_RECALC_STALE_FA,
  MSG_HIST_ORG_TEAM_NOT_ACTIVE_FA,
} from "./historical-org-headcount";

export type {
  OrgUnitCountsByType,
  TeamMembershipDetail,
  PlannedMembershipDelta,
  HistoricalOrgHeadcountFreshnessCode,
  HistoricalOrgHeadcountFreshnessBlock,
  HistoricalOrgHeadcountState,
  GetHistoricalOrgHeadcountStateResult,
  GetHistoricalOrgHeadcountStateOptions,
  GetHistoricalOrgHeadcountStateDeps,
} from "./historical-org-headcount";

export { POPULATION_SUBJECT_ID_TARGET } from "./population-cutover";

export {
  isPersonUuid,
  currentColleagueFromState,
  projectPersonnelListRow,
  comparePersonnelListRows,
  rowMatchesPersonnelQuery,
  PERSONNEL_LIST_MAX_ROWS,
} from "./personnel-list-projector";

export type {
  PersonnelListRowDto,
  PersonnelListLabelBundle,
} from "./personnel-list-projector";

export {
  createDraft,
  getDraft,
  updateDraft,
  deleteDraft,
  listOpenDraftsForPerson,
  listOpenDraftsForPersons,
  listDraftsByIds,
  assertDraftEditable,
  stripClientTrustedHeadcountOverrideFields,
} from "./personnel-event-draft";

export type {
  DraftStatus,
  PersonnelEventDraftRecord,
  CreateDraftInput,
  UpdateDraftInput,
} from "./personnel-event-draft";

export {
  buildEvaluationSnapshot,
  classifyConflicts,
  assertSnapshotFresh,
  hasBlockingConflicts,
  warningCodesRequiringAck,
  codesRequiringOverride,
  dateOnlyFromDb,
  HEADCOUNT_CONSUMING_EVENT_TYPES,
  HEADCOUNT_CAPACITY_PORT_EVENT_TYPES,
  WARNING_ACK_ALLOW_LIST,
} from "./personnel-event-conflicts";

export type {
  ConflictSeverity,
  ConflictFinding,
  EvaluationSnapshot,
  ConflictPolicy,
  BuildSnapshotInput,
  SnapshotReadOptions,
} from "./personnel-event-conflicts";

export {
  START_RETURN_EVENT_TYPES,
  PRODUCT_START_EVENT_TYPE,
  PRODUCT_RETURN_EVENT_TYPE,
  SCAFFOLD_EVENT_TYPE,
  parseStartReturnPayload,
  applyStartReturnProjections,
  applyStartScheduledReserve,
  releaseStartReservationOnCancel,
  compensateOrphanStartReturnProjections,
  capacityResultToConflict,
} from "./personnel-event-start-return";

export type {
  StartReturnPayloadFacts,
  MissingFact,
} from "./personnel-event-start-return";

export {
  TERMINATION_EVENT_TYPES,
  PRODUCT_TERMINATION_EVENT_TYPE,
  LEAN_TERMINATION_REASON_EXAMPLES,
  parseTerminationPayload,
  applyTerminationProjections,
  compensateTerminationApply,
  findIncompatibleFutureEvents,
  incompatibleFutureToConflict,
  priorDateOnly,
} from "./personnel-event-termination";

export type {
  TerminationPayloadFacts,
  MissingTerminationFact,
  TerminationApplyResult,
  TerminationAssignmentClose,
  IncompatibleFutureEvent,
} from "./personnel-event-termination";

export {
  TRANSFER_EVENT_TYPES,
  PRODUCT_TRANSFER_EVENT_TYPE,
  NON_PRODUCT_TRANSFER_EVENT_TYPE,
  parseTransferPayload,
  isTransferNoop,
  isTransferEffectUnapplied,
  applyTransferProjections,
  applyTransferScheduledReserve,
  compensateTransferApply,
  undoTransferApply,
  releaseTransferReservationOnCancel,
  findIncompatibleFutureEventsForTransfer,
  incompatibleTransferFutureToConflict,
} from "./personnel-event-transfer";

export type {
  TransferPayloadFacts,
  MissingTransferFact,
  TransferApplyResult,
  TransferIncompatibleFutureEvent,
} from "./personnel-event-transfer";

export {
  JOB_LEVEL_EVENT_TYPES,
  JOB_LEVEL_CAPACITY_EVENT_TYPES,
  PRODUCT_ORG_ROLE_CHANGED,
  PRODUCT_JOB_TITLE_CHANGED,
  PRODUCT_SENIORITY_CHANGED,
  PRODUCT_LADDER_CHANGED,
  PRODUCT_GRADE_CHANGED,
  PRODUCT_PROMOTION_RECORDED,
  parseJobLevelPayload,
  resolveSuccessorPrimary,
  isJobFactsNoop,
  matchingBucketChanged,
  isJobLevelEffectUnapplied,
  applyJobLevelProjections,
  applyJobLevelScheduledReserve,
  compensateJobLevelApply,
  undoJobLevelApply,
  releaseJobLevelReservationOnCancel,
  findIncompatibleFutureEventsForJobLevel,
  incompatibleJobLevelFutureToConflict,
} from "./personnel-event-job-level";

export type {
  JobLevelOverlayFacts,
  JobLevelSuccessorFacts,
  MissingJobLevelFact,
  JobLevelApplyResult,
  JobLevelIncompatibleFutureEvent,
} from "./personnel-event-job-level";

export {
  COMPENSATION_EVENT_TYPES,
  PRODUCT_COMPENSATION_EVENT_TYPE,
  PRODUCT_CONTRACT_EVENT_TYPE,
  parseCompensationPayload,
  applyCompensationProjections,
  compensateCompensationApply,
  undoCompensationApply,
  clearCompensationSidecarForDraft,
  peekCompensationSidecarForDraft,
} from "./personnel-event-compensation";

export type {
  CompensationStructuralFacts,
  MissingCompensationFact,
  CompensationApplyResult,
} from "./personnel-event-compensation";

export {
  finalizeDraft,
  evaluateDraftForFinalize,
  inferRiskTiers,
  evaluateRiskTiers,
  TERMINATION_PRODUCT_RISK_TIERS,
  COMPENSATION_PRODUCT_RISK_TIERS,
  PERSONNEL_EVENT_PRODUCT_RISK_TIERS,
} from "./personnel-event-finalize";

export type {
  RiskTierKind,
  RiskTierConfig,
  FinalizeAcknowledgement,
  FinalizeOverride,
  FinalizeDraftInput,
  FinalizeDraftResult,
} from "./personnel-event-finalize";

export {
  setProjectionRefreshHook,
  resetProjectionRefreshHook,
  getProjectionRefreshHook,
  runProjectionRefreshHook,
  runWithProjectionRefreshHook,
  defaultProjectionRefreshHook,
} from "./personnel-event-projection-hook";

export type {
  ProjectionRefreshContext,
  ProjectionRefreshHook,
} from "./personnel-event-projection-hook";

export {
  evaluationStatusAsOf,
  isPreEffectAsOf,
  resolveLifecycleStatus,
  loadEventWithResolvedStatus,
  detectCorrectionCycle,
} from "./personnel-event-resolve";

export type {
  ResolvedLifecycleStatus,
  EventChainLinks,
} from "./personnel-event-resolve";

export {
  cancelPersonnelEvent,
  reversePersonnelEvent,
  correctPersonnelEvent,
} from "./personnel-event-lifecycle";

export type {
  LifecycleActorInput,
  LifecycleResult,
  CorrectPersonnelEventInput,
} from "./personnel-event-lifecycle";

export {
  TEMPORAL_RECALCULATE_QUEUE,
  isPastDatedEffective,
  markRecalculationPending,
  clearRecalculationStatus,
  markRecalculationFailed,
  markRecalculationStale,
  getRecalculationStatus,
  getPlatformRecalcSignal,
  getOpsRecalcAggregate,
  enqueueRecalculationAfterCommit,
  scheduleHeavyRecalculation,
  runHistoricalRecalculation,
  loadOrderedEventsForRecalc,
  listPendingRecalculationJobs,
  reenqueuePendingRecalculationIfNeeded,
  setRecalcEnqueue,
  setRecalcEnqueueForTest,
  runWithRecalcEnqueue,
  recalcJobKey,
} from "./personnel-event-recalc";

export type {
  RecalculationRowStatus,
  RecalculationStatusRow,
  RecalcJobPayload,
  PlatformRecalcSignal,
  OpsRecalcAggregate,
  RecalcEnqueueFn,
} from "./personnel-event-recalc";

export {
  assertNoActiveHoldForArtifact,
  placeHold,
  releaseHold,
  runDisposal,
  getDisposalLimitDisclosure,
  findActiveHoldsIntersecting,
  getDisposalRun,
  listDisposalRuns,
  listLegalHolds,
  listPropagationResults,
  MSG_DISPOSAL_LIMIT_DISCLOSURE_FA,
  type DisposalScope,
  type DisposedFieldMarker,
  type DisposeArtifactFn,
  type ListArtifactsForScopeFn,
  type OnPublicationSourceDisposedFn,
  type RunDisposalDeps,
  type RunDisposalResult,
  type PgQueryable as LifecyclePgQueryable,
} from "./data-lifecycle";

export {
  addCorrectionCaseEvidenceRef,
  closeCorrectionCase,
  decideCorrectionCase,
  escalateOverdueCases,
  getCorrectionCaseAttachmentDownload,
  getCorrectionCaseById,
  getCorrectionCaseDetail,
  linkCorrectionCaseOutcome,
  listAttachments as listCorrectionCaseAttachments,
  listCorrectionCaseSummaries,
  listOutcomeLinks as listCorrectionCaseOutcomeLinks,
  openCorrectionCase,
  updateCorrectionCaseProgress,
  uploadCorrectionCaseAttachment,
  type CorrectionCaseDetail,
} from "./correction-case";

export type { PgQueryable as CorrectionCasePgQueryable } from "./correction-case-repo";
