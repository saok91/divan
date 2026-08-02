import { readFileSync } from "node:fs";

import {
  appendAccessEvent,
  withTransaction,
} from "@divan/event-store";
import {
  isFutureAsOf,
  parseDateOnly,
} from "@divan/temporal-engine";
import type { Pool } from "pg";

import {
  isCategoryGrantable,
  loadCategoryRegistry,
  type CategoryRegistry,
} from "./categories";
import {
  AuthorizationError,
  MSG_ACCESS_DENIED_FA,
  MSG_AUDIT_APPEND_FAILED_FA,
} from "./authorization-error";
import {
  assertAuditTrustWriterAllowed,
  enforceClockAnomalyOrThrow,
  recordRequiredAppendFailure,
} from "./audit-trust-gate";
import { AuditTrustError } from "./audit-trust";

export {
  AuthorizationError,
  MSG_ACCESS_DENIED_FA,
  MSG_AUDIT_APPEND_FAILED_FA,
  type AuthorizationErrorCode,
} from "./authorization-error";

export {
  DEV_DEMO_CATEGORIES,
  PRODUCTION_SENSITIVE_CATEGORY_HOOKS,
  emptyCategoryRegistry,
  isCategoryGrantable,
  loadCategoryRegistry,
  type CategoryRegistry,
  type CategorySensitivity,
  type SensitiveCategory,
} from "./categories";

export {
  DEMO_INFERENCE_BULK_HOOKS,
  DISABLED_INFERENCE_BULK_HOOKS,
  MSG_SUPPRESSED_COHORT_FA,
  clearInferenceBulkWindowsForTests,
  evaluateInferenceBulk,
  fingerprintAuthorizedSet,
  getInferenceBulkHooks,
  isIdentityRetrievalChannel,
  loadInferenceBulkHooks,
  newInferenceCorrelationId,
  recordInferenceBulkAccessEvent,
  setInferenceBulkHooksForTests,
  symmetricDifferenceSize,
  toGovernedRetrievalPayload,
  type GovernedRetrievalPayload,
  type InferenceBulkAccessOutcome,
  type InferenceBulkChannel,
  type InferenceBulkDecision,
  type InferenceBulkEvaluateInput,
  type InferenceBulkEvaluateResult,
  type InferenceBulkHooks,
  type QueryFingerprint,
  type RecordInferenceBulkAccessInput,
} from "./inference-bulk";

export {
  AUDIT_CONSUME_65_ARTIFACT_CONTRACT,
  AUDIT_EVIDENCE_DATA_CATEGORY,
  AUDIT_EVIDENCE_REVIEW_PERMISSION,
  AUDIT_INFERENCE_BULK_EVIDENCE_ONLY_FA,
  AUDIT_INVESTIGATE_PERMISSION,
  AUDIT_MIGRATION_HONESTY_FA,
  AuditInvestigationError,
  MSG_AUDIT_EMPTY_FILTER_FA,
  MSG_AUDIT_INVESTIGATE_DENIED_FA,
  MSG_AUDIT_QUERY_FAILED_FA,
  MSG_AUDIT_SELF_REVIEW_BLOCKED_FA,
  assertAuditEvidenceSelfReviewAllowed,
  buildAuditInvestigationHonesty,
  isExportArtifactEvidence,
  isMigrationRelatedEvidence,
  type AuditInvestigationErrorCode,
  type AuditInvestigationHonesty,
} from "./investigation";

export {
  MSG_OPS_HEALTH_DENIED_FA,
  MSG_OPS_HEALTH_PROBE_FAILED_FA,
  OPS_HEALTH_FORBIDDEN_DTO_KEYS,
  OPS_HEALTH_READ_PERMISSION,
  OPS_MIGRATION_HONESTY_FA,
  OPS_PLATFORM_DATA_CATEGORY,
  OpsHealthError,
  getBackupEvidenceHook,
  opsHealthDtoContainsForbiddenKeys,
  type BackupEvidenceHook,
  type BackupEvidenceHookStatus,
  type OpsHealthErrorCode,
  type OpsHealthSection,
  type OpsHealthSectionStatus,
  type OpsHealthSnapshot,
} from "./ops-health";

export {
  MSG_SETTINGS_DENIED_FA,
  SETTINGS_CONFIGURATION_DATA_CATEGORY,
  SETTINGS_READ_PERMISSION,
} from "./settings-access";

export {
  DATA_LIFECYCLE_DATA_CATEGORY,
  DATA_LIFECYCLE_DISPOSE_PERMISSION,
  DATA_LIFECYCLE_HOLD_PERMISSION,
  DATA_LIFECYCLE_READ_PERMISSION,
  DataLifecycleError,
  LEGACY_RETENTION_BLURB_TO_CLASS,
  MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
  MSG_DISPOSAL_PROPAGATION_FAILED_FA,
  MSG_LEGAL_HOLD_ACTIVE_FA,
  MSG_LIFECYCLE_DENIED_FA,
  MSG_LIFECYCLE_METADATA_INCOMPLETE_FA,
  MSG_RESTORE_CATCHUP_REQUIRED_FA,
  MSG_HOLD_NOT_FOUND_FA,
  MSG_DISPOSAL_SCOPE_INCOMPLETE_FA,
  PROVISIONAL_LIFECYCLE_CLASS_CODES,
  disposalActionForClass,
  isProvisionalLifecycleClass,
  parseLifecycleClass,
  type DataLifecycleErrorCode,
  type DisposalRunRecord,
  type DisposalRunStatus,
  type LegalHoldRecord,
  type LegalHoldScopeKind,
  type LegalHoldStatus,
  type PropagationOutcome,
  type PropagationTargetResult,
  type ProvisionalLifecycleClassCode,
} from "./data-lifecycle";

export {
  AUDIT_TRUST_API_DISTINCT_CODES,
  AUDIT_TRUST_DATA_CATEGORY,
  AUDIT_TRUST_DEFAULT_ENV_KEY,
  AUDIT_TRUST_FORBIDDEN_DTO_KEYS,
  AUDIT_TRUST_READ_PERMISSION,
  AUDIT_TRUST_REVIEW_PERMISSION,
  AuditTrustError,
  FR51_BASELINE_FAMILIES,
  MSG_AUDIT_CLOCK_ANOMALY_FA,
  MSG_AUDIT_INTEGRITY_FAILED_FA,
  MSG_AUDIT_TRUST_CONFIG_MISSING_FA,
  MSG_AUDIT_TRUST_DENIED_FA,
  MSG_AUDIT_TRUST_INCIDENT_NOT_FOUND_FA,
  MSG_AUDIT_TRUST_METADATA_INCOMPLETE_FA,
  MSG_AUDIT_TRUST_CLEAR_BLOCKED_FA,
  MSG_AUDIT_TRUST_SELF_REVIEW_BLOCKED_FA,
  MSG_AUDIT_TRUST_SUSPENDED_FA,
  assertAuditTrustSelfReviewAllowed,
  assertClearWriterSuspendAllowed,
  auditTrustDtoContainsForbiddenKeys,
  isAuditTrustApiDistinctCode,
  isNonMonotonicOccurredAt,
  loadAuditTrustProvisionalConfig,
  observeClockSkew,
  type AuditTrustErrorCode,
  type AuditTrustIncident,
  type AuditTrustIncidentKind,
  type AuditTrustIncidentStatus,
  type AuditTrustProvisionalConfig,
  type AuditTrustState,
  type AuditTrustWriterStatus,
  type BaselineCoverageRow,
  type ClockAnomalyObservation,
  type IntegrityVerificationOutcome,
  type IntegrityVerificationRun,
} from "./audit-trust";

export {
  assertAuditTrustWriterAllowed,
  enforceClockAnomalyOrThrow,
  recordCaptureGapIncident,
  recordRequiredAppendFailure,
  runIntegrityVerification,
} from "./audit-trust-gate";

export {
  CORRECTION_CASE_ACTIVE_STATUSES,
  CORRECTION_CASE_CLOSE_PERMISSION,
  CORRECTION_CASE_DATA_CATEGORY,
  CORRECTION_CASE_DECIDE_PERMISSION,
  CORRECTION_CASE_READ_PERMISSION,
  CORRECTION_CASE_STATUSES,
  CORRECTION_CASE_WRITE_PERMISSION,
  CorrectionCaseError,
  MSG_CORRECTION_CASE_ALLOWLIST_UNSET_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_NOT_DOWNLOADABLE_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_NOT_FOUND_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
  MSG_CORRECTION_CASE_BREACHED_FA,
  MSG_CORRECTION_CASE_DEADLINE_REQUIRED_FA,
  MSG_CORRECTION_CASE_DENIED_FA,
  MSG_CORRECTION_CASE_INVALID_TRANSITION_FA,
  MSG_CORRECTION_CASE_NOT_FOUND_FA,
  MSG_CORRECTION_CASE_OUTCOME_TARGET_INVALID_FA,
  MSG_CORRECTION_CASE_PENDING_PUBLICATION_HOOK_FA,
  MSG_CORRECTION_CASE_SELF_REVIEW_BLOCKED_FA,
  assertCorrectionCaseSelfReviewAllowed,
  assertCorrectionCaseTransition,
  canTransitionCorrectionCase,
  decisionStatusFromDecision,
  extensionOfFilename,
  hasActiveContentPrefix,
  inertAttachmentHeaders,
  inspectCorrectionCaseAttachment,
  isBreachedPresentation,
  isDeadlineBreached,
  loadCorrectionCaseAttachmentPolicy,
  minimizeAttachmentFilename,
  type AttachmentInspectionResult,
  type CorrectionCase,
  type CorrectionCaseAttachment,
  type CorrectionCaseAttachmentInspectionStatus,
  type CorrectionCaseAttachmentPolicy,
  type CorrectionCaseDecision,
  type CorrectionCaseErrorCode,
  type CorrectionCaseEvidenceKind,
  type CorrectionCaseEvidenceRef,
  type CorrectionCaseOutcomeLinkType,
  type CorrectionCaseOutcomeLinks,
  type CorrectionCaseStatus,
} from "./correction-case";

export {
  LAUNCH_ARTIFACT_APPROVE_PERMISSION,
  LAUNCH_ARTIFACT_DATA_CATEGORY,
  LAUNCH_ARTIFACT_IDS,
  LAUNCH_ARTIFACT_MANAGE_PERMISSION,
  LAUNCH_ARTIFACT_READ_PERMISSION,
  LAUNCH_ARTIFACT_REBASELINE_PERMISSION,
  LAUNCH_ARTIFACT_SEED_META,
  LAUNCH_ARTIFACT_WAIVER_PERMISSION,
  LaunchArtifactError,
  MSG_CONFLICT_UNRESOLVED_FA,
  MSG_CONTROLLING_VERSION_UNRESOLVED_FA,
  MSG_LAUNCH_ARTIFACT_DENIED_FA,
  MSG_LAUNCH_ARTIFACT_EXPIRED_FA,
  MSG_LAUNCH_ARTIFACT_NOT_FOUND_FA,
  MSG_LAUNCH_ARTIFACT_SUPERSEDED_FA,
  MSG_LAUNCH_ARTIFACT_VERSION_CONFLICT_FA,
  MSG_REBASELINE_INCOMPLETE_FA,
  MSG_REBASELINE_REQUIRED_FA,
  MSG_WAIVER_APPROVER_NOT_INDEPENDENT_FA,
  MSG_WAIVER_EXPIRED_FA,
  MSG_WAIVER_INVALID_FA,
  MSG_WAIVER_NON_WAIVERABLE_FA,
  NON_WAIVERABLE_GATE_CODES,
  approveRebaseline,
  approveVersion,
  assertArtifactsUsable,
  assertWaiverAllowed,
  closeWaiver,
  countChangeControlSignals,
  createVersion,
  isLaunchArtifactId,
  isNonWaiverableGate,
  isWaiverExpired,
  issueWaiver,
  listArtifacts,
  listConflicts,
  listOpenWaivers,
  listRebaselines,
  listVersions,
  openConflict,
  recordOperationEvidence,
  refreshExpiryStates,
  requireRebaseline,
  resolveConflict,
  resolveControllingVersion,
  seedLaunchArtifactRegister,
  type ChangeControlGateResult,
  type ControllingVersionRef,
  type LaunchArtifactConflict,
  type LaunchArtifactErrorCode,
  type LaunchArtifactId,
  type LaunchArtifactRegisterRow,
  type LaunchArtifactVersion,
  type LaunchArtifactWaiver,
  type RebaselineRecord,
  type WaiverInput,
} from "./launch-artifact";

export {
  EVALUATION_SNAPSHOT_DATA_CATEGORY,
  EVALUATION_SNAPSHOT_KINDS,
  EVALUATION_SNAPSHOT_MANAGE_PERMISSION,
  EVALUATION_SNAPSHOT_READ_PERMISSION,
  EVALUATION_SNAPSHOT_STATUSES,
  EvaluationSnapshotError,
  MSG_EVAL_SNAPSHOT_DENIED_FA,
  MSG_EVAL_SNAPSHOT_EXPIRED_FA,
  MSG_EVAL_SNAPSHOT_MISMATCH_FA,
  MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
  MSG_EVAL_SNAPSHOT_PERMISSION_CHANGED_FA,
  MSG_EVAL_SNAPSHOT_REF_CHANGED_FA,
  MSG_EVAL_SNAPSHOT_STALE_FA,
  MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
  assertEvaluationFingerprintMatch,
  assertSameEvaluationSnapshot,
  beginEvaluationSnapshot,
  bindOperationToSnapshot,
  computeContentFingerprint,
  countEvaluationSnapshotSignals,
  getEvaluationSnapshot,
  listRecentEvaluationSnapshots,
  markEvaluationSnapshotTerminal,
  revalidateEvaluationSnapshot,
  stableStringify,
  throwEvaluationSnapshotConflict,
  type AuthoritativeEvaluationSnapshot,
  type BeginEvaluationSnapshotInput,
  type BindOperationToSnapshotInput,
  type EvaluationSnapshotBindResult,
  type EvaluationSnapshotConflict,
  type EvaluationSnapshotErrorCode,
  type EvaluationSnapshotKind,
  type EvaluationSnapshotStatus,
} from "./evaluation-snapshot";

export {
  acknowledgeTrustIncident,
  assignTrustIncident,
  checkAppendOnlyTriggerPresent,
  clearWriterSuspend,
  closeTrustIncident,
  countAccessEventsInWindow,
  ensureWriterStateRow,
  getTrustIncident,
  getWriterState,
  insertIntegrityVerificationRun,
  listRecentAccessOccurredAt,
  listTrustIncidents,
  openTrustIncident,
  selectDbNow,
  setWriterSuspended,
  type PgQueryable as AuditTrustPgQueryable,
} from "./audit-trust-repo";

export type EvaluationMode = "current" | "as_of";

export type CoarseAuthzContext = {
  accountId: string;
  /** Navigation context only — never an implicit allow for sensitive categories. */
  coarseRole: string;
  /** Prisma OrganizationalScope ids the actor holds (active). */
  organizationalScopeIds: string[];
  /**
   * Stable scope codes/aliases (e.g. org:selfcheck) matching policy tokens.
   * Story 2.6: one identity space for demos — codes seed-aligned with policy.
   */
  organizationalScopeCodes?: string[];
};

export type AuthorizeAction = "read" | "write" | "export" | string;

export type AuthorizeInput = {
  context: CoarseAuthzContext;
  permission: string;
  dataCategory: string;
  action: AuthorizeAction;
  organizationalScope: string;
  operation: string;
  correlationId: string;
  /**
   * When true (default), access event append is mandatory with the outcome.
   * Append failure fails the operation (FR-51 direction).
   */
  sensitive?: boolean;
  /**
   * Optional non-sensitive detail for the access event (e.g. before/after
   * snapshots). Never include HR field values or passwords.
   */
  payload?: Record<string, unknown>;
  /**
   * Evaluation time semantics (Story 2.6 / FR-47). Default `current`.
   * `as_of` requires a valid date-only `asOfDate` (Asia/Tehran calendar day).
   */
  evaluationMode?: EvaluationMode;
  /** Date-only YYYY-MM-DD when evaluationMode is as_of. Timestamps → deny. */
  asOfDate?: string;
};

export type AuthorizeResult = {
  decisionId: string;
  /** Future as-of demos are planned, not Effective (AR-TEMPORAL). */
  resultSemantics?: "effective" | "planned";
  evaluationMode: EvaluationMode;
  asOfDate: string | null;
};

export type PolicyRule = {
  permission: string;
  dataCategory: string;
  action: string;
  organizationalScope: string;
};

export type PolicyRegistry = {
  rules: readonly PolicyRule[];
};

/**
 * Tiny local/dev fixture — proves default-deny + controlled allows.
 * Not the AR-ACCESS launch matrix. Coarse roles never appear as allow keys.
 *
 * Read ≠ export: `demo.sensitive_hr.read` allows read only; export on the same
 * (or related) tuple denies unless an explicit `action: "export"` rule exists.
 *
 * Scope tokens (`org:selfcheck`) must match OrganizationalScope.code bindings
 * (Story 2.6 membership). `org:any` is for access.administration only — actor
 * must still hold at least one active scope (no unbounded HR retrieval).
 */
export const DEV_DEMO_POLICY: PolicyRegistry = {
  rules: [
    {
      permission: "demo.selfcheck.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "demo.sensitive_hr.read",
      dataCategory: "demo.sensitive_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "demo.sensitive_hr.export",
      dataCategory: "demo.sensitive_hr",
      action: "export",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "demo.retrieval.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    // Story 2.3 — access administration (coarse role is never an allow key)
    {
      permission: "access.administration",
      dataCategory: "identity.access_admin",
      action: "read",
      organizationalScope: "org:any",
    },
    {
      permission: "access.administration",
      dataCategory: "identity.access_admin",
      action: "write",
      organizationalScope: "org:any",
    },
    // Story 3.1 — Person identity (coarse role is never an allow key)
    {
      permission: "person.read",
      dataCategory: "identity.person",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "person.write",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 4.2–4.3 / 9.6 — personnel event draft/finalize/lifecycle
    // (PermissionSet seed alone is insufficient; envelope needs exact tuples.)
    {
      permission: "personnel_event.draft",
      dataCategory: "identity.person",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "personnel_event.draft",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "personnel_event.finalize",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "personnel_event.cancel",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "personnel_event.reverse",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "personnel_event.correct",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 3.5 — Organization hierarchy (coarse role is never an allow key)
    {
      permission: "organization.read",
      dataCategory: "organization.unit",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "organization.write",
      dataCategory: "organization.unit",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 3.6 — Job reference concepts (FR-10)
    {
      permission: "job_reference.read",
      dataCategory: "organization.job_reference",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "job_reference.write",
      dataCategory: "organization.job_reference",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 4.12 — Headcount Approval lifecycle (FR-28)
    {
      permission: "headcount.approval.read",
      dataCategory: "organization.headcount_approval",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "headcount.approval.write",
      dataCategory: "organization.headcount_approval",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 4.13 — Exemption + match reselect (FR-29)
    {
      permission: "headcount.exemption.read",
      dataCategory: "organization.headcount_exemption",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "headcount.exemption.write",
      dataCategory: "organization.headcount_exemption",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "headcount.match.reselect",
      dataCategory: "organization.headcount_approval",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 4.14 — Override catalogue (FR-32)
    {
      permission: "headcount.override.read",
      dataCategory: "organization.headcount_override",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "headcount.override.write",
      dataCategory: "organization.headcount_override",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 6.2 — provisional migration SoD (AR-MIGRATION pending freeze)
    {
      permission: "migration.approve",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "migration.execute",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 6.4 — provisional reconciliation SoD (AR-MIGRATION pending freeze)
    {
      permission: "migration.reconcile",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "migration.reconcile",
      dataCategory: "identity.person",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "migration.sign",
      dataCategory: "identity.person",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "migration.sign",
      dataCategory: "identity.person",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    // Story 6.5 — provisional governed export (AR-ACCESS / AR-DATA pending freeze)
    // IMPORTANT: action must be "export" (not read) — 6.4 meta mismatch lesson.
    {
      permission: "report.export",
      dataCategory: "identity.person",
      action: "export",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "person.export",
      dataCategory: "identity.person",
      action: "export",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "export.retrieve",
      dataCategory: "identity.person",
      action: "export",
      organizationalScope: "org:selfcheck",
    },
    // Story 7.1 — provisional audit investigation (AR-ACCESS / AR-AUDIT pending freeze)
    // IMPORTANT: action must be "read" for search (6.4 meta mismatch lesson).
    {
      permission: "audit.investigate",
      dataCategory: "audit.evidence",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "audit.evidence.review",
      dataCategory: "audit.evidence",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 7.2 — provisional ops health (AR-ACCESS / AR-NFR pending freeze)
    {
      permission: "ops.health.read",
      dataCategory: "ops.platform",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    // Story 10.2 — provisional settings surface (AR-ACCESS / AR-DATA pending freeze)
    {
      permission: "settings.read",
      dataCategory: "settings.configuration",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    // Story 7.3 — provisional data lifecycle / legal hold (AR-ACCESS / AR-DATA pending freeze)
    {
      permission: "data.lifecycle.read",
      dataCategory: "data.lifecycle",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "data.lifecycle.hold",
      dataCategory: "data.lifecycle",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "data.lifecycle.dispose",
      dataCategory: "data.lifecycle",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 7.4 — provisional audit trust fail-safe (AR-ACCESS / AR-AUDIT pending freeze)
    {
      permission: "audit.trust.read",
      dataCategory: "audit.trust",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "audit.trust.review",
      dataCategory: "audit.trust",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 7.5 — provisional correction cases (AR-ACCESS / AR-DATA pending freeze)
    {
      permission: "correction.case.read",
      dataCategory: "correction.case",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "correction.case.write",
      dataCategory: "correction.case",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "correction.case.decide",
      dataCategory: "correction.case",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "correction.case.close",
      dataCategory: "correction.case",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 7.6 — provisional decision publication (AR-ACCESS / AR-REPORTING pending freeze)
    {
      permission: "report.publication.read",
      dataCategory: "report.publication",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "report.publication.publish",
      dataCategory: "report.publication",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "report.publication.supersede",
      dataCategory: "report.publication",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "report.publication.manage",
      dataCategory: "report.publication",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 7.7 — provisional Launch Artifact Register (AR-ACCESS / FR-55 pending freeze)
    {
      permission: "launch.artifact.read",
      dataCategory: "launch.artifact",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "launch.artifact.manage",
      dataCategory: "launch.artifact",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "launch.artifact.approve",
      dataCategory: "launch.artifact",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "launch.artifact.waiver",
      dataCategory: "launch.artifact",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "launch.artifact.rebaseline",
      dataCategory: "launch.artifact",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
    // Story 7.8 — provisional evaluation snapshot metadata (AR-ACCESS / FR-56 pending freeze)
    {
      permission: "evaluation.snapshot.read",
      dataCategory: "evaluation.snapshot",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
    {
      permission: "evaluation.snapshot.manage",
      dataCategory: "evaluation.snapshot",
      action: "write",
      organizationalScope: "org:selfcheck",
    },
  ],
};

/** Sensitive fixture with no policy rule — every coarse role must deny. */
export const DEMO_SENSITIVE_TUPLE = {
  permission: "demo.sensitive.read",
  dataCategory: "demo.sensitive_hr",
  action: "read",
  organizationalScope: "org:any",
  operation: "demo.sensitive.read",
} as const;

/**
 * Category-view read allow (demo) — does **not** imply export.
 * Used for omit-when-authorized and read≠export proofs.
 */
export const DEMO_SENSITIVE_HR_READ_TUPLE = {
  permission: "demo.sensitive_hr.read",
  dataCategory: "demo.sensitive_hr",
  action: "read",
  organizationalScope: "org:selfcheck",
  operation: "demo.sensitive_hr.read",
} as const;

/**
 * Export attempt on the read permission tuple — must deny (no export rule for
 * this 4-tuple even though a related read rule exists).
 */
export const DEMO_SENSITIVE_EXPORT_DENY_TUPLE = {
  permission: "demo.sensitive_hr.read",
  dataCategory: "demo.sensitive_hr",
  action: "export",
  organizationalScope: "org:selfcheck",
  operation: "demo.sensitive.export",
} as const;

/** Explicit export allow fixture (demo only). */
export const DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE = {
  permission: "demo.sensitive_hr.export",
  dataCategory: "demo.sensitive_hr",
  action: "export",
  organizationalScope: "org:selfcheck",
  operation: "demo.sensitive_hr.export",
} as const;

/** Fixture row for omit selfcheck / demo query. */
export const DEMO_OMIT_FIXTURE_PAYLOAD = {
  displayName: "نمونه",
  teamLabel: "تیم الف",
  compensationHint: "SHOULD_OMIT_WHEN_UNAUTHORIZED",
} as const;

/** Field → category map for {@link DEMO_OMIT_FIXTURE_PAYLOAD}. */
export const DEMO_OMIT_FIELD_CATEGORIES: Record<
  keyof typeof DEMO_OMIT_FIXTURE_PAYLOAD,
  string
> = {
  displayName: "demo.non_hr",
  teamLabel: "demo.non_hr",
  compensationHint: "demo.sensitive_hr",
};

export function emptyPolicyRegistry(): PolicyRegistry {
  return { rules: [] };
}

/**
 * Load policy registry.
 * - `AUDIT_ENVELOPE_POLICY_PATH` → JSON `{ "rules": [...] }`
 * - `AUDIT_ENVELOPE_USE_DEV_FIXTURE=false` → empty (all deny)
 * - otherwise non-production → DEV_DEMO_POLICY; production → empty
 *
 * Fail-closed: unreadable/invalid policy file or bad shape → empty registry (deny all).
 * Production matrix is owned by AR-ACCESS — this is a configurable fail-closed hook only.
 */
export function loadPolicyRegistry(
  env: NodeJS.ProcessEnv = process.env,
): PolicyRegistry {
  const path = env.AUDIT_ENVELOPE_POLICY_PATH?.trim();
  if (path) {
    try {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as { rules?: unknown };
      const rules = Array.isArray(parsed?.rules) ? parsed.rules : [];
      return { rules: rules as PolicyRule[] };
    } catch {
      return emptyPolicyRegistry();
    }
  }

  if (env.AUDIT_ENVELOPE_USE_DEV_FIXTURE?.trim().toLowerCase() === "false") {
    return emptyPolicyRegistry();
  }

  if ((env.NODE_ENV ?? "").toLowerCase() === "production") {
    return emptyPolicyRegistry();
  }

  return DEV_DEMO_POLICY;
}

/**
 * Exact-match policy only — **not** a public authz API.
 * Callers must use {@link evaluateAuthorization} so the category registry
 * gate cannot be bypassed.
 */
function evaluatePolicyExact(
  registry: PolicyRegistry,
  request: {
    permission: string;
    dataCategory: string;
    action: string;
    organizationalScope: string;
  },
): "allow" | "deny" {
  if (!registry.rules.length) return "deny";

  const hit = registry.rules.some(
    (r) =>
      r.permission === request.permission &&
      r.dataCategory === request.dataCategory &&
      r.action === request.action &&
      r.organizationalScope === request.organizationalScope,
  );
  return hit ? "allow" : "deny";
}

/**
 * Actor must hold the request scope (Story 2.6).
 * - `org:any`: access-admin wildcard — requires ≥1 active membership (not unbounded HR).
 * - otherwise: match by scope code alias OR by cuid id.
 */
export function actorHoldsOrganizationalScope(
  context: CoarseAuthzContext,
  requestScope: string,
): boolean {
  const scope = requestScope.trim();
  if (!scope) return false;

  const ids = context.organizationalScopeIds ?? [];
  const codes = context.organizationalScopeCodes ?? [];

  if (scope === "org:any") {
    return ids.length > 0;
  }

  if (codes.includes(scope)) return true;
  if (ids.includes(scope)) return true;
  return false;
}

export type EvaluationTimeResult =
  | {
      ok: true;
      evaluationMode: EvaluationMode;
      asOfDate: string | null;
      resultSemantics: "effective" | "planned";
    }
  | { ok: false; reason: string };

/**
 * Resolve evaluation mode / as-of. Invalid or ambiguous as-of → fail-closed.
 */
export function resolveEvaluationTime(input: {
  evaluationMode?: EvaluationMode;
  asOfDate?: string;
  now?: Date;
}): EvaluationTimeResult {
  const mode: EvaluationMode = input.evaluationMode ?? "current";
  const now = input.now ?? new Date();

  if (mode === "current") {
    if (input.asOfDate !== undefined && input.asOfDate.trim() !== "") {
      // Explicit asOf with current mode is ambiguous → deny
      return { ok: false, reason: "as_of_ambiguous_with_current" };
    }
    return {
      ok: true,
      evaluationMode: "current",
      asOfDate: null,
      resultSemantics: "effective",
    };
  }

  const parsed = parseDateOnly(input.asOfDate);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }

  const planned = isFutureAsOf(parsed.value, now);
  return {
    ok: true,
    evaluationMode: "as_of",
    asOfDate: parsed.value,
    resultSemantics: planned ? "planned" : "effective",
  };
}

/**
 * Full authorization eval: category registry gate **first**, then policy.
 * Disabled/unknown category → deny even if a rogue policy rule mentions it.
 * Does **not** check membership — use {@link evaluateAuthorizationWithMembership}.
 */
export function evaluateAuthorization(
  policy: PolicyRegistry,
  categories: CategoryRegistry,
  request: {
    permission: string;
    dataCategory: string;
    action: string;
    organizationalScope: string;
  },
): "allow" | "deny" {
  if (!isCategoryGrantable(categories, request.dataCategory)) {
    return "deny";
  }
  return evaluatePolicyExact(policy, request);
}

/**
 * Policy + membership. Prefer this for Story 2.6+ paths.
 */
export function evaluateAuthorizationWithMembership(
  policy: PolicyRegistry,
  categories: CategoryRegistry,
  request: {
    permission: string;
    dataCategory: string;
    action: string;
    organizationalScope: string;
  },
  context: CoarseAuthzContext,
): "allow" | "deny" {
  if (evaluateAuthorization(policy, categories, request) === "deny") {
    return "deny";
  }
  return actorHoldsOrganizationalScope(context, request.organizationalScope)
    ? "allow"
    : "deny";
}

/**
 * Project a row so unauthorized / disabled category keys are **absent**
 * (not masked as `0`, `null`, `"—"`, or redacted placeholders).
 *
 * **Map completeness contract:** keys absent from `fieldCategory` pass through
 * unchanged (ordinary / uncategorized fields). Callers must map every
 * sensitive field — an unmapped sensitive key will leak. Prefer exhaustive
 * maps (e.g. `Record<keyof Row, string>`) at each call site.
 *
 * `allowedCategories` alone is not enough: a category must also be
 * grantable in `categories` (registered + enabled). Disabled / unknown ids
 * in the allow set are ignored.
 *
 * API/response omit is authoritative in Story 2.2; profile DOM omit follows
 * the same rule when person profiles land (Story 5.2+ / UX OQ-3).
 */
export function omitUnauthorizedCategories<T extends Record<string, unknown>>(
  row: T,
  fieldCategory: Record<string, string>,
  allowedCategories: ReadonlySet<string>,
  categories: CategoryRegistry,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(row) as (keyof T & string)[]) {
    const categoryId = fieldCategory[key];
    if (categoryId === undefined) {
      out[key] = row[key];
      continue;
    }
    if (
      allowedCategories.has(categoryId) &&
      isCategoryGrantable(categories, categoryId)
    ) {
      out[key] = row[key];
    }
  }
  return out;
}

export type AuditEnvelopeDeps = {
  pool: Pool;
  getPolicy: () => PolicyRegistry;
  /** Defaults to {@link loadCategoryRegistry} when omitted. */
  getCategories?: () => CategoryRegistry;
};

export type AuditEnvelope = {
  authorizeOrThrow: (input: AuthorizeInput) => Promise<AuthorizeResult>;
};

/**
 * Default-deny authorize API. Coarse role is context only — never an allow key.
 * Category registry gates before policy. Membership is mandatory (Story 2.6).
 * Evaluation time / as-of validated fail-closed. Sensitive decisions append
 * `event_class=access` atomically with the outcome.
 */
export function createAuditEnvelope(deps: AuditEnvelopeDeps): AuditEnvelope {
  const getCategories = deps.getCategories ?? (() => loadCategoryRegistry());

  return {
    async authorizeOrThrow(input: AuthorizeInput): Promise<AuthorizeResult> {
      const sensitive = input.sensitive !== false;

      const time = resolveEvaluationTime({
        evaluationMode: input.evaluationMode,
        asOfDate: input.asOfDate,
      });

      let decision: "allow" | "deny" = "deny";
      let denyReason: string | null = null;

      try {
        if (!time.ok) {
          decision = "deny";
          denyReason = time.reason;
        } else {
          const policyDecision = evaluateAuthorization(
            deps.getPolicy(),
            getCategories(),
            {
              permission: input.permission,
              dataCategory: input.dataCategory,
              action: input.action,
              organizationalScope: input.organizationalScope,
            },
          );
          if (policyDecision === "deny") {
            decision = "deny";
            denyReason = "default_deny_or_no_matching_rule";
          } else if (
            !actorHoldsOrganizationalScope(
              input.context,
              input.organizationalScope,
            )
          ) {
            decision = "deny";
            denyReason = "scope_membership_missing";
          } else {
            decision = "allow";
          }
        }
      } catch {
        throw new AuthorizationError(
          "FORBIDDEN",
          MSG_ACCESS_DENIED_FA,
          input.correlationId,
          null,
          "authz_dependency_failed",
        );
      }

      const evaluationMode: EvaluationMode = time.ok
        ? time.evaluationMode
        : (input.evaluationMode ?? "current");
      const asOfDate = time.ok ? time.asOfDate : null;
      const resultSemantics = time.ok ? time.resultSemantics : "effective";

      const scope = {
        permission: input.permission,
        dataCategory: input.dataCategory,
        action: input.action,
        organizationalScope: input.organizationalScope,
        actorCoarseRole: input.context.coarseRole,
        actorOrganizationalScopeIds: input.context.organizationalScopeIds,
        actorOrganizationalScopeCodes:
          input.context.organizationalScopeCodes ?? [],
        evaluationMode,
        asOfDate,
        resultSemantics,
      };

      const eventPayload = {
        ...input.payload,
        ...(denyReason ? { denyReason } : {}),
        evaluationMode,
        asOfDate,
        resultSemantics,
      };

      if (!sensitive) {
        if (decision === "deny") {
          throw new AuthorizationError(
            "FORBIDDEN",
            MSG_ACCESS_DENIED_FA,
            input.correlationId,
            null,
            denyReason,
          );
        }
        return {
          decisionId: input.correlationId,
          evaluationMode,
          asOfDate,
          resultSemantics,
        };
      }

      // Required-audit path: trust suspend + clock anomaly fail-closed (Story 7.4)
      try {
        await assertAuditTrustWriterAllowed(deps.pool, {
          correlationId: input.correlationId,
          permission: input.permission,
        });
        await enforceClockAnomalyOrThrow(deps.pool, {
          correlationId: input.correlationId,
          actorAccountId: input.context.accountId,
          permission: input.permission,
        });
      } catch (err) {
        if (err instanceof AuditTrustError) throw err;
        if (err instanceof AuthorizationError) throw err;
        await recordRequiredAppendFailure(deps.pool, {
          correlationId: input.correlationId,
          actorAccountId: input.context.accountId,
        });
        throw new AuthorizationError(
          "AUDIT_APPEND_FAILED",
          MSG_AUDIT_APPEND_FAILED_FA,
          input.correlationId,
          null,
          "audit_trust_gate_failed",
        );
      }

      let decisionId: string;
      try {
        decisionId = await withTransaction(deps.pool, async (client) => {
          const { id } = await appendAccessEvent(client, {
            correlationId: input.correlationId,
            actorAccountId: input.context.accountId,
            operation: input.operation,
            scope,
            result: decision,
            reason:
              decision === "deny"
                ? (denyReason ?? "default_deny_or_no_matching_rule")
                : "explicit_allow_rule",
            payload: eventPayload,
          });
          return id;
        });
      } catch (err) {
        if (err instanceof AuthorizationError) throw err;
        if (err instanceof AuditTrustError) throw err;
        await recordRequiredAppendFailure(deps.pool, {
          correlationId: input.correlationId,
          actorAccountId: input.context.accountId,
        });
        throw new AuthorizationError(
          "AUDIT_APPEND_FAILED",
          MSG_AUDIT_APPEND_FAILED_FA,
          input.correlationId,
          null,
          "audit_append_failed",
        );
      }

      if (decision === "deny") {
        throw new AuthorizationError(
          "FORBIDDEN",
          MSG_ACCESS_DENIED_FA,
          input.correlationId,
          decisionId,
          denyReason,
        );
      }

      return {
        decisionId,
        evaluationMode,
        asOfDate,
        resultSemantics,
      };
    },
  };
}
