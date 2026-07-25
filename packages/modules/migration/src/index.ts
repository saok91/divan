/**
 * @divan/migration — controlled import parse / validate / preview / staging cutover
 * (Stories 6.1–6.3).
 *
 * Domain owns template registry, workbook parse (FR-52), FR-37 validators,
 * ephemeral preview drafts, durable staging, provisional SoD, atomic cutover,
 * batch evidence, and FR-39 event-origin classification helpers.
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
  MSG_SOD_APPROVE_REQUIRED_FA,
  MSG_SOD_EXECUTE_REQUIRED_FA,
  MSG_SOD_SAME_ACTOR_FA,
  MSG_SOD_UPLOAD_APPROVE_FA,
  assertApproveExecuteSegregation,
  assertUploadApproveSegregation,
  assertMigrationApprovePermission,
  assertMigrationExecutePermission,
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
  type ExecuteBatchResult,
  type ExecuteBatchOptions,
} from "./execute-batch";

export {
  SEED_MIGRATION_SOD,
  seedMigrationSodPermissionFixtures,
} from "./seed-sod";
