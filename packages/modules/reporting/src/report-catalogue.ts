/**
 * AR-REPORTING-pluggable report catalogue (Story 5.5 / FR-36).
 * Launch-required keys are hardcoded; do not invent cohort thresholds or
 * silently drop FR-36 scenarios without explicit PRD change.
 */

export const LAUNCH_REQUIRED_REPORT_KEYS = [
  "active_persons",
  "all_persons",
  "org_state",
  "team_membership_manager",
  "distributions",
  "starts",
  "terminations",
  "transfers",
  "role_grade_compensation_changes",
  "headcount_approvals_capacity",
  "overrides",
  "scheduled",
  "corrected_cancelled_reversed",
  "import_batch_outcomes",
] as const;

export type LaunchReportKey = (typeof LAUNCH_REQUIRED_REPORT_KEYS)[number];

export type ReportDefinitionHook = {
  key: LaunchReportKey;
  titleFa: string;
  /** When true, catalogue soft-omits unless actor holds compensation.read. */
  requiresCompensationRead?: boolean;
  /** When true, catalogue soft-omits unless actor holds organization.read. */
  requiresOrganizationRead?: boolean;
  /** When true, catalogue soft-omits unless actor holds headcount approval read. */
  requiresHeadcountApprovalRead?: boolean;
};

/** Owner-approved launch defaults — not AR-REPORTING freeze. */
export const LAUNCH_REPORT_DEFINITIONS: readonly ReportDefinitionHook[] = [
  { key: "active_persons", titleFa: "افراد فعال" },
  { key: "all_persons", titleFa: "همه افراد (شامل خاتمه‌یافته)" },
  {
    key: "org_state",
    titleFa: "وضعیت جاری سازمان",
    requiresOrganizationRead: true,
  },
  {
    key: "team_membership_manager",
    titleFa: "اعضای هر تیم و مدیر میانی",
    requiresOrganizationRead: true,
  },
  { key: "distributions", titleFa: "توزیع نقش، عنوان، گرید و همکاری" },
  { key: "starts", titleFa: "شروع‌ها" },
  { key: "terminations", titleFa: "خاتمه‌ها" },
  { key: "transfers", titleFa: "جابه‌جایی تیم" },
  {
    key: "role_grade_compensation_changes",
    titleFa: "تغییر نقش، گرید و جبران خدمت",
    requiresCompensationRead: true,
  },
  {
    key: "headcount_approvals_capacity",
    titleFa: "تأیید ظرفیت و ظرفیت مصرف‌شده/آزاد",
    requiresOrganizationRead: true,
    requiresHeadcountApprovalRead: true,
  },
  {
    key: "overrides",
    titleFa: "استثناهای ظرفیت",
    requiresHeadcountApprovalRead: true,
  },
  { key: "scheduled", titleFa: "رویدادهای زمان‌بندی‌شده" },
  {
    key: "corrected_cancelled_reversed",
    titleFa: "رویدادهای اصلاح / لغو / معکوس",
  },
  {
    key: "import_batch_outcomes",
    titleFa: "نتیجه دسته‌های واردسازی",
  },
] as const;

export function isLaunchReportKey(key: string): key is LaunchReportKey {
  return (LAUNCH_REQUIRED_REPORT_KEYS as readonly string[]).includes(key);
}

/** Event / Effective-Date measure keys — require rangeStart + rangeEnd. */
export const REPORT_KEYS_REQUIRING_EFFECTIVE_RANGE = [
  "starts",
  "terminations",
  "transfers",
  "role_grade_compensation_changes",
  "scheduled",
  "corrected_cancelled_reversed",
] as const satisfies readonly LaunchReportKey[];

export function reportRequiresEffectiveDateRange(
  key: LaunchReportKey,
): boolean {
  return (REPORT_KEYS_REQUIRING_EFFECTIVE_RANGE as readonly string[]).includes(
    key,
  );
}

/**
 * Person / event population keys — when teamId is set, intersect authorized
 * subjects with team membership as-of (AC#2 org filter).
 */
export const REPORT_KEYS_TEAM_POPULATION_INTERSECT = [
  "active_persons",
  "all_persons",
  "distributions",
  "starts",
  "terminations",
  "transfers",
  "role_grade_compensation_changes",
  "scheduled",
  "corrected_cancelled_reversed",
] as const satisfies readonly LaunchReportKey[];

export function reportUsesTeamPopulationIntersect(
  key: LaunchReportKey,
): boolean {
  return (
    REPORT_KEYS_TEAM_POPULATION_INTERSECT as readonly string[]
  ).includes(key);
}

export function requireLaunchReportCatalogue(): readonly ReportDefinitionHook[] {
  for (const key of LAUNCH_REQUIRED_REPORT_KEYS) {
    const found = LAUNCH_REPORT_DEFINITIONS.find((d) => d.key === key);
    if (!found) {
      throw new Error(`missing_launch_report_definition:${key}`);
    }
  }
  return LAUNCH_REPORT_DEFINITIONS;
}

export const MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA =
  "گزارش نتیجه دسته‌های واردسازی پس از Epic ۶ (مهاجرت) فعال می‌شود؛ دادهٔ واردسازی هنوز در دسترس نیست.";
