/**
 * AR-REPORTING-pluggable metric catalogue (Story 5.4 / FR-35).
 * Launch-required keys are hardcoded; do not invent cohort thresholds or
 * 30/60/90 production freeze values until AR-REPORTING lands.
 */

export const LAUNCH_REQUIRED_METRIC_KEYS = [
  "active_persons",
  "org_unit_counts",
  "headcount_conservation",
  "workforce_trend",
  "team_capacity",
  "starts_terminations",
  "open_headcount",
] as const;

export type LaunchMetricKey = (typeof LAUNCH_REQUIRED_METRIC_KEYS)[number];

export type MetricDefinitionHook = {
  key: LaunchMetricKey;
  titleFa: string;
  /** Launch default granularity for trend-capable metrics. */
  defaultGranularity?: "daily" | "monthly";
};

/** Owner-approved launch defaults — not AR-REPORTING freeze. */
export const LAUNCH_METRIC_DEFINITIONS: readonly MetricDefinitionHook[] = [
  { key: "active_persons", titleFa: "افراد فعال" },
  { key: "org_unit_counts", titleFa: "شمارش واحدهای سازمانی" },
  { key: "headcount_conservation", titleFa: "ظرفیت تأییدشده" },
  {
    key: "workforce_trend",
    titleFa: "روند نیروی کار",
    defaultGranularity: "monthly",
  },
  { key: "team_capacity", titleFa: "ظرفیت تیم‌ها" },
  {
    key: "starts_terminations",
    titleFa: "شروع و خاتمه",
    defaultGranularity: "monthly",
  },
  { key: "open_headcount", titleFa: "ظرفیت باز" },
] as const;

export function isLaunchMetricKey(key: string): key is LaunchMetricKey {
  return (LAUNCH_REQUIRED_METRIC_KEYS as readonly string[]).includes(key);
}

export function requireLaunchMetricCatalogue(): readonly MetricDefinitionHook[] {
  for (const key of LAUNCH_REQUIRED_METRIC_KEYS) {
    const found = LAUNCH_METRIC_DEFINITIONS.find((d) => d.key === key);
    if (!found) {
      throw new Error(`missing_launch_metric_definition:${key}`);
    }
  }
  return LAUNCH_METRIC_DEFINITIONS;
}
