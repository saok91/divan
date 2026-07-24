/**
 * Reporting BC — dashboard metric assembly (Story 5.4 / FR-35).
 *
 * Consumers must call InferenceBulkPort (`@divan/audit-envelope`
 * evaluateInferenceBulk / web `runGovernedRetrieval` channel `dashboard`)
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
  MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA,
  assertHeadcountConservation,
  type HeadcountConservationQuantities,
  type HeadcountConservationResult,
} from "./headcount-conservation";

export {
  aggregateStartsTerminations,
  buildWorkforceTrendBuckets,
  type WorkforceEventRow,
  type TrendGranularity,
  type StartsTerminationsAggregate,
  type TrendBucket,
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
