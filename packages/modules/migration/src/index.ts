/**
 * @divan/migration — controlled import parse / validate / preview (Story 6.1).
 *
 * Domain owns template registry, workbook parse (FR-52), FR-37 validators, and
 * ephemeral preview drafts. Production cutover / Baseline / SoD = Stories 6.2+.
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
  type BuildPreviewOptions,
  type ImportPreviewBatch,
  type ImportPreviewRow,
  type PreviewAccessOptions,
  type PreviewRowSeverity,
} from "./preview-batch";
