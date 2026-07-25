/**
 * Canonical FR-40 / addendum §7.3 reconciliation domain keys (Story 6.4).
 * AR-MIGRATION oracle/tolerances pending — exact match when control present;
 * missing required control = fail-closed for production.
 */

/** @provisional-pending-AR-MIGRATION-freeze */
export const RECONCILIATION_DOMAIN_KEYS = [
  "person",
  "employment",
  "assignment",
  "personnel_event",
  "current_state",
  "team_totals",
  "reference_mappings",
  "headcount",
  "duplicates",
  "orphans",
  "approved_control_totals",
] as const;

export type ReconciliationDomainKey =
  (typeof RECONCILIATION_DOMAIN_KEYS)[number];

export const RECONCILIATION_DOMAIN_LABELS_FA: Record<
  ReconciliationDomainKey,
  string
> = {
  person: "شخص",
  employment: "اشتغال",
  assignment: "انتصاب",
  personnel_event: "رویداد پرسنلی",
  current_state: "وضعیت جاری",
  team_totals: "جمع تیم",
  reference_mappings: "نگاشت مرجع",
  headcount: "ظرفیت نیروی انسانی",
  duplicates: "تکراری‌ها",
  orphans: "یتیم‌ها",
  approved_control_totals: "جمع‌های کنترلی تأییدشده",
};

/**
 * Domains that must have an attested control before production sign-off.
 * All FR-40 package domains are required (fail-closed).
 */
export const REQUIRED_PRODUCTION_DOMAINS: readonly ReconciliationDomainKey[] =
  RECONCILIATION_DOMAIN_KEYS;

/**
 * Domains that may be honestly unavailable when Baseline→Employment/Assignment
 * projector is missing. Unavailable required domains hard-block production cutover
 * (FR-55 waiver does not unlock production until observation is computable / AR oracle).
 */
export const PROJECTOR_GAP_DOMAINS: readonly ReconciliationDomainKey[] = [
  "employment",
  "assignment",
  "current_state",
];

/** @provisional LG-1 integrity classes → critical when mismatched/open */
export const LG1_INTEGRITY_CLASSES = [
  "duplicate",
  "orphan",
  "temporal",
  "assignment",
  "headcount",
  "control_total",
] as const;

export type Lg1IntegrityClass = (typeof LG1_INTEGRITY_CLASSES)[number];

export function isReconciliationDomainKey(
  value: string,
): value is ReconciliationDomainKey {
  return (RECONCILIATION_DOMAIN_KEYS as readonly string[]).includes(value);
}

export function domainIntegrityClass(
  domain: ReconciliationDomainKey,
): Lg1IntegrityClass | null {
  switch (domain) {
    case "duplicates":
      return "duplicate";
    case "orphans":
      return "orphan";
    case "assignment":
      return "assignment";
    case "headcount":
      return "headcount";
    case "approved_control_totals":
      return "control_total";
    case "personnel_event":
    case "employment":
    case "current_state":
      return "temporal";
    default:
      return null;
  }
}
