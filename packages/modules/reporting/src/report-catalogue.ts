/**
 * AR-REPORTING-pluggable report catalogue (Story 5.5 / FR-36).
 * Launch-required keys are hardcoded; do not invent cohort thresholds or
 * silently drop FR-36 scenarios without explicit PRD change.
 *
 * Subject + purposeFa (Story 9.5) — presentation metadata only; keys unchanged.
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

/** UX subject tabs for the reports workspace (Story 9.5 / UX-DR33). */
export const REPORT_SUBJECTS = [
  "personnel",
  "organization",
  "events",
  "capacity",
  "data-entry",
] as const;

export type ReportSubject = (typeof REPORT_SUBJECTS)[number];

export type ReportDefinitionHook = {
  key: LaunchReportKey;
  titleFa: string;
  /** Section-tab subject grouping (Story 9.5). */
  subject: ReportSubject;
  /** One-line operator-facing purpose under the rail name. */
  purposeFa: string;
  /** When true, catalogue marks non-runnable unless actor holds compensation.read. */
  requiresCompensationRead?: boolean;
  /** When true, catalogue marks non-runnable unless actor holds organization.read. */
  requiresOrganizationRead?: boolean;
  /** When true, catalogue marks non-runnable unless actor holds headcount approval read. */
  requiresHeadcountApprovalRead?: boolean;
};

/** Owner-approved launch defaults — not AR-REPORTING freeze. */
export const LAUNCH_REPORT_DEFINITIONS: readonly ReportDefinitionHook[] = [
  {
    key: "active_persons",
    titleFa: "افراد فعال",
    subject: "personnel",
    purposeFa: "فهرست افراد فعال در محدوده دسترسی شما",
  },
  {
    key: "all_persons",
    titleFa: "همه افراد (شامل خاتمه‌یافته)",
    subject: "personnel",
    purposeFa: "همه افراد شامل خاتمه‌یافته در محدوده دسترسی",
  },
  {
    key: "org_state",
    titleFa: "وضعیت جاری سازمان",
    subject: "organization",
    purposeFa: "وضعیت جاری واحدهای سازمانی قابل‌مشاهده",
    requiresOrganizationRead: true,
  },
  {
    key: "team_membership_manager",
    titleFa: "اعضای هر تیم و مدیر میانی",
    subject: "organization",
    purposeFa: "اعضای هر تیم و مدیر میانی در ساختار سازمان",
    requiresOrganizationRead: true,
  },
  {
    key: "distributions",
    titleFa: "توزیع نقش، عنوان، گرید و همکاری",
    subject: "personnel",
    purposeFa: "توزیع نقش، عنوان شغلی، گرید و نوع همکاری",
  },
  {
    key: "starts",
    titleFa: "شروع‌ها",
    subject: "events",
    purposeFa: "شروع‌های اشتغال در بازهٔ انتخابی",
  },
  {
    key: "terminations",
    titleFa: "خاتمه‌ها",
    subject: "events",
    purposeFa: "خاتمه‌های اشتغال در بازهٔ انتخابی",
  },
  {
    key: "transfers",
    titleFa: "جابه‌جایی تیم",
    subject: "events",
    purposeFa: "جابه‌جایی تیم در بازهٔ انتخابی",
  },
  {
    key: "role_grade_compensation_changes",
    titleFa: "تغییر نقش، گرید و جبران خدمت",
    subject: "events",
    purposeFa: "تغییرات نقش، گرید و جبران خدمت در بازه",
    requiresCompensationRead: true,
  },
  {
    key: "headcount_approvals_capacity",
    titleFa: "تأیید ظرفیت و ظرفیت مصرف‌شده/آزاد",
    subject: "capacity",
    purposeFa: "تأیید ظرفیت و ظرفیت مصرف‌شده یا آزاد",
    requiresOrganizationRead: true,
    requiresHeadcountApprovalRead: true,
  },
  {
    key: "overrides",
    titleFa: "استثناهای ظرفیت",
    subject: "capacity",
    purposeFa: "استثناهای ظرفیت هدکانت در محدوده دسترسی",
    requiresHeadcountApprovalRead: true,
  },
  {
    key: "scheduled",
    titleFa: "رویدادهای زمان‌بندی‌شده",
    subject: "events",
    purposeFa: "رویدادهای زمان‌بندی‌شده که هنوز مؤثر نشده‌اند",
  },
  {
    key: "corrected_cancelled_reversed",
    titleFa: "رویدادهای اصلاح / لغو / معکوس",
    subject: "events",
    purposeFa: "رویدادهای اصلاح‌شده، لغو یا معکوس‌شده",
  },
  {
    key: "import_batch_outcomes",
    titleFa: "نتیجه دسته‌های واردسازی",
    subject: "data-entry",
    purposeFa: "نتیجه دسته‌های واردسازی داده",
  },
] as const;

export function isLaunchReportKey(key: string): key is LaunchReportKey {
  return (LAUNCH_REQUIRED_REPORT_KEYS as readonly string[]).includes(key);
}

export function isReportSubject(value: string): value is ReportSubject {
  return (REPORT_SUBJECTS as readonly string[]).includes(value);
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
    if (!found.subject || !found.purposeFa.trim()) {
      throw new Error(`incomplete_launch_report_metadata:${key}`);
    }
  }
  return LAUNCH_REPORT_DEFINITIONS;
}

export function reportsForSubject(
  subject: ReportSubject,
): readonly ReportDefinitionHook[] {
  return LAUNCH_REPORT_DEFINITIONS.filter((d) => d.subject === subject);
}

export const MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA =
  "گزارش نتیجه دسته‌های واردسازی پس از Epic ۶ (مهاجرت) فعال می‌شود؛ دادهٔ واردسازی هنوز در دسترس نیست.";
