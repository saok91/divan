/**
 * Reporting BC — dashboard (5.4) + report catalogue (5.5 / FR-36)
 * + governed export artifacts (6.5 / FR-41 / FR-52).
 *
 * Consumers must call InferenceBulkPort (`@divan/audit-envelope`
 * evaluateInferenceBulk / web `runGovernedRetrieval` channel
 * `dashboard`|`report`|`export`) after PopulationPort intersection —
 * same control plane as count/export. Do not invent a parallel threshold stack.
 */

export {
  LAUNCH_REQUIRED_METRIC_KEYS,
  LAUNCH_METRIC_DEFINITIONS,
  isLaunchMetricKey,
  requireLaunchMetricCatalogue,
  type LaunchMetricKey,
  type MetricDefinitionHook,
} from "./metric-catalogue";

export {
  LAUNCH_REQUIRED_REPORT_KEYS,
  LAUNCH_REPORT_DEFINITIONS,
  MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA,
  REPORT_KEYS_REQUIRING_EFFECTIVE_RANGE,
  REPORT_KEYS_TEAM_POPULATION_INTERSECT,
  isLaunchReportKey,
  reportRequiresEffectiveDateRange,
  reportUsesTeamPopulationIntersect,
  requireLaunchReportCatalogue,
  type LaunchReportKey,
  type ReportDefinitionHook,
} from "./report-catalogue";

export {
  MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA,
  assertHeadcountConservation,
  type HeadcountConservationQuantities,
  type HeadcountConservationResult,
} from "./headcount-conservation";

export {
  aggregateStartsTerminations,
  aggregateEventsByTypeAndStatus,
  buildWorkforceTrendBuckets,
  filterEventsByStatus,
  type WorkforceEventRow,
  type TrendGranularity,
  type StartsTerminationsAggregate,
  type TrendBucket,
  type EventTypeStatusAggregate,
} from "./workforce-events";

export {
  assembleDashboardSnapshot,
  conservationOrFail,
  defaultAsOfToday,
  type DashboardMetricOutcome,
  type DashboardMetricCardDto,
  type DashboardSnapshotFilter,
  type DashboardSnapshotCaps,
  type AssembleDashboardSnapshotInput,
  type DashboardSnapshotResult,
} from "./dashboard-snapshot";

export {
  assembleReportRun,
  defaultReportAsOfToday,
  type ReportRunOutcome,
  type ReportColumnDef,
  type ReportCellValue,
  type ReportRowDto,
  type ReportRunFilter,
  type ReportRunCaps,
  type AssembleReportRunInput,
  type ReportRunResult,
} from "./report-run";

export {
  ExportError,
  MSG_EXPORT_DENIED_FA,
  MSG_REAUTH_FAILED_FA,
  MSG_ARTIFACT_EXPIRED_FA,
  MSG_ARTIFACT_REVOKED_FA,
  MSG_ARTIFACT_DISPOSED_FA,
  MSG_ARTIFACT_NOT_FOUND_FA,
  MSG_CUSTODY_ACK_REQUIRED_FA,
  MSG_SENSITIVE_EXPORT_DENIED_FA,
  MSG_SNAPSHOT_MISMATCH_FA,
  MSG_FORMAT_UNSUPPORTED_FA,
  MSG_CONTENT_MISSING_FA,
  type ExportErrorCode,
} from "./export-errors";

export {
  REPORT_EXPORT_PERMISSION,
  PERSON_EXPORT_PERMISSION,
  EXPORT_RETRIEVE_PERMISSION,
  EXPORT_ARTIFACT_TTL_MS,
  EXPORT_CUSTODY_BULK_ROW_THRESHOLD,
  CLASSIFICATION_INTERNAL_FA,
  CLASSIFICATION_SENSITIVE_FA,
  HANDLING_DEFAULT_FA,
  CUSTODY_BOUNDARY_FA,
} from "./export-permissions";

export {
  computeExportSnapshotHash,
  filterExportFields,
  assertNoSensitiveWithoutExport,
  resolveClassification,
  requiresCustodyAcknowledgement,
  createExportArtifact,
  downloadExportArtifact,
  revokeExportArtifact,
  disposeExportArtifact,
  listExportArtifactIdsForScope,
  panelDtoFromArtifact,
  newExportCorrelationId,
  type ExportReauthFn,
  type ExportFieldDef,
  type StableSnapshotInput,
  type CreateExportArtifactInput,
  type CreateExportArtifactResult,
  type DownloadExportArtifactInput,
  type DownloadExportArtifactResult,
} from "./export-artifact";

export {
  getExportArtifactById,
  getExportArtifactWithBytes,
  listRetrievalsForArtifact,
  type ExportArtifactRecord,
  type ExportArtifactWithBytes,
  type ExportRetrievalRecord,
  type ExportSourceSurface,
  type ExportFormat,
  type ExportArtifactState,
  type PgQueryable as ExportPgQueryable,
} from "./export-artifact-repo";

export {
  neutralizeExportCellValue,
  writeFormulaSafeCsv,
  writeFormulaSafeXlsx,
  csvContainsUnquotedFormulaRisk,
  FORMULA_SAFE_TAB_PREFIX,
  type ExportColumn,
  type ExportCellValue,
  type ExportRow,
} from "./formula-safe-export";
