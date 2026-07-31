/**
 * @divan/migration — controlled import parse / validate / preview / staging cutover
 * / reconciliation production gate (Stories 6.1–6.4).
 *
 * Domain owns template registry, workbook parse (FR-52), FR-37 validators,
 * ephemeral preview drafts, durable staging, provisional SoD, atomic cutover,
 * batch evidence, FR-39 event-origin helpers, and FR-40 reconciliation workspace.
 * Web stays thin (governed tRPC + wizard UI).
 */

export {
  MigrationError,
  type MigrationErrorCode,
} from "./errors";

export {
  LAUNCH_IMPORT_TEMPLATES,
  LAUNCH_IMPORT_TEMPLATE_KEYS,
  LAUNCH_IMPORT_TEMPLATE_PERSON_EMPLOYMENT,
  getLaunchImportTemplate,
  isLaunchImportTemplateKey,
  requireLaunchImportTemplateCatalogue,
  templateHeaderMap,
  type ImportTemplateColumn,
  type LaunchImportTemplate,
} from "./templates";

export {
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_SHEETS,
  detectImportFileKind,
  hasFormulaControlPrefix,
  literalizeCellValue,
  parseCsvBuffer,
  parseCsvText,
  parseImportFile,
  parseXlsxBuffer,
  resolveImportFileKind,
  type ImportFileKind,
  type ParsedImportMatrix,
} from "./parse-workbook";

export {
  columnMetaForKey,
  formatImportIssueCite,
  validateImportMatrix,
  type ImportIssue,
  type ImportIssueSeverity,
} from "./validate-import";

export {
  SAMPLE_FORMULA_SAFE_TAB_PREFIX,
  generateSampleWorkbook,
  neutralizeSampleCellValue,
  type SampleWorkbookResult,
} from "./sample-workbook";

export {
  IMPORT_DRAFT_TTL_MS,
  IMPORT_MAX_DRAFTS_GLOBAL,
  IMPORT_MAX_DRAFTS_PER_ACTOR,
  assertNoEventStoreAppendInDrafts,
  buildImportPreviewBatch,
  cancelImportPreviewBatch,
  clearImportPreviewDraftStore,
  confirmImportPreviewDraft,
  filterIssuesForVisibleColumns,
  getImportPreviewBatch,
  getStoredDraftForStaging,
  type BuildPreviewOptions,
  type ImportPreviewBatch,
  type ImportPreviewRow,
  type PreviewAccessOptions,
  type PreviewRowSeverity,
} from "./preview-batch";

export {
  MIGRATION_APPROVE_PERMISSION,
  MIGRATION_EXECUTE_PERMISSION,
  MIGRATION_RECONCILE_PERMISSION,
  MIGRATION_SIGN_PERMISSION,
  MSG_SOD_APPROVE_REQUIRED_FA,
  MSG_SOD_EXECUTE_REQUIRED_FA,
  MSG_SOD_RECONCILE_REQUIRED_FA,
  MSG_SOD_SIGN_REQUIRED_FA,
  MSG_SOD_SAME_ACTOR_FA,
  MSG_SOD_UPLOAD_APPROVE_FA,
  MSG_SOD_SAME_SIGNER_FA,
  assertApproveExecuteSegregation,
  assertUploadApproveSegregation,
  assertReconcileSignSegregation,
  assertMigrationApprovePermission,
  assertMigrationExecutePermission,
  assertMigrationReconcilePermission,
  assertMigrationSignPermission,
  type SodPermissionHolder,
} from "./sod";

export {
  buildIdempotencyKey,
  promoteConfirmedDraftToStaging,
  getStagingBatch,
  getStagingBatchByPreviewId,
  approveStagingBatch,
  markStagingStatus,
  rollbackStagingBatch,
  countSuccessfulCutoverEvidence,
  listSuccessfulCutoverEvidence,
  projectStagingBatchForViewer,
  type StagingBatchStatus,
  type StagingBatchRow,
  type StagingBatchRecord,
  type PromoteToStagingInput,
} from "./staging-repo";

export {
  getOpsImportBatchSummary,
  type OpsImportBatchSummary,
} from "./ops-import-summary";

export {
  MIGRATION_ADVISORY_NAMESPACE,
  MSG_CONCURRENT_BATCH_FA,
  buildOverlapKeys,
  assertOverlapKeysPresent,
  advisoryLockKeyPair,
  formatConcurrentBatchMessage,
  acquireOverlapLocks,
  releaseOverlapLocksForBatch,
  type OverlapLockHolder,
} from "./concurrent-mutex";

export {
  persistBatchEvidence,
  getLatestBatchEvidence,
  type BatchEvidenceActors,
  type BatchEvidenceCounts,
  type BatchEvidenceStatus,
  type ImportBatchEvidence,
} from "./batch-evidence";

export {
  BASELINE_RECORDED_EVENT_TYPE,
  classifyEventOrigin,
  isMigrationProvenance,
  type EventOrigin,
  type MigrationProvenance,
} from "./event-origin";

export {
  revalidateStagingBatch,
  revalidateAuthoritativeReferences,
  assertZeroProductionTrace,
  executeImportBatch,
  rollbackImportStaging,
  stagingRowsReadOnly,
  performAtomicCutover,
  mapCutoverCounts,
  type ExecuteBatchResult,
  type ExecuteBatchOptions,
  type CutoverClaimStatus,
} from "./execute-batch";

export {
  commitDayToDayBulk,
  type DayToDayBulkCommitOptions,
  type DayToDayBulkCommitResult,
} from "./commit-day-to-day-bulk";

export {
  SEED_MIGRATION_SOD,
  seedMigrationSodPermissionFixtures,
} from "./seed-sod";

export {
  RECONCILIATION_DOMAIN_KEYS,
  RECONCILIATION_DOMAIN_LABELS_FA,
  REQUIRED_PRODUCTION_DOMAINS,
  PROJECTOR_GAP_DOMAINS,
  LG1_INTEGRITY_CLASSES,
  isReconciliationDomainKey,
  domainIntegrityClass,
  type ReconciliationDomainKey,
  type Lg1IntegrityClass,
} from "./reconciliation-domains";

export {
  computeReconciliationEvidenceHash,
  computeObservationsForBatch,
  createReconciliationRun,
  upsertReconciliationControls,
  runReconciliationCompare,
  setDiscrepancyDisposition,
  signReconciliation,
  verifyProductionGateOnRun,
  assertProductionReconciliationGate,
  getReconciliation,
  listReconciliationRuns,
  buildDomainComparisonRows,
  buildSyntheticSignedRun,
  type ProductionGateResult,
  type DomainComparisonRow,
} from "./reconciliation";

export type {
  ReconciliationRun,
  ReconciliationControl,
  ReconciliationObservation,
  ReconciliationDiscrepancy,
  ReconciliationSignature,
  ReconciliationTier,
  ReconciliationRunStatus,
  DiscrepancySeverity,
  DiscrepancyStatus,
  SignatureRoleCode,
  JsonValue,
} from "./reconciliation-repo";
