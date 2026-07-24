/**
 * Reporting BC — dashboard (5.4) + report catalogue (5.5 / FR-36).
 *
 * Consumers must call InferenceBulkPort (`@divan/audit-envelope`
 * evaluateInferenceBulk / web `runGovernedRetrieval` channel `dashboard`|`report`)
 * after PopulationPort intersection — same control plane as count/export.
 * Do not invent a parallel threshold stack here.
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
