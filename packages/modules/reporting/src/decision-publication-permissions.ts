/**
 * Provisional decision-publication permissions (Story 7.6 / FR-54).
 * AR-ACCESS / AR-REPORTING / AR-DATA pending freeze — code-marked fail-closed keys only.
 *
 * SoD: do NOT auto-grant to audit.investigate / ops.health.read / audit.trust.review.
 * Bound to hr.admin via seed-publication until AR-ACCESS freezes publisher role.
 */

/** @provisional-pending-AR-ACCESS-freeze — list/get publications + notices */
export const REPORT_PUBLICATION_READ_PERMISSION = "report.publication.read";

/** @provisional-pending-AR-ACCESS-freeze — create publication from reviewed run */
export const REPORT_PUBLICATION_PUBLISH_PERMISSION = "report.publication.publish";

/**
 * @provisional-pending-AR-ACCESS-freeze
 * Manual supersession notice (system-triggered notices still attributable).
 */
export const REPORT_PUBLICATION_SUPERSEDE_PERMISSION =
  "report.publication.supersede";

/**
 * @provisional-pending-AR-ACCESS-freeze
 * Mark non-reproducible / attach package metadata (admin repair path).
 */
export const REPORT_PUBLICATION_MANAGE_PERMISSION = "report.publication.manage";

/**
 * Ordinary publication category — NOT person `health`;
 * not data.lifecycle / correction.case / export / audit.trust.
 * @provisional-pending-AR-ACCESS-freeze / @provisional-pending-AR-REPORTING-freeze
 */
export const REPORT_PUBLICATION_DATA_CATEGORY = "report.publication";

/**
 * @provisional-pending-AR-REPORTING-freeze
 * Fail-closed when publish requires a version string and this is unset/empty.
 */
export const PROVISIONAL_REPORT_VERSION =
  "@provisional-pending-AR-REPORTING-freeze";

/**
 * @provisional-pending-AR-REPORTING-freeze
 * Metric/policy version recorded at publish time (FR-55 product is 7.7).
 */
export const PROVISIONAL_METRIC_VERSION =
  "@provisional-pending-AR-REPORTING-freeze";

/**
 * Prefer register-backed AR-REPORTING version label when present;
 * keep provisional honesty when label still carries provisional marker.
 */
export function resolvePublicationVersionStrings(
  controllingVersionLabel: string | null | undefined,
): { reportVersion: string; metricVersion: string; provisional: boolean } {
  const label = controllingVersionLabel?.trim() ?? "";
  if (!label || label.includes("@provisional-pending")) {
    return {
      reportVersion: PROVISIONAL_REPORT_VERSION,
      metricVersion: PROVISIONAL_METRIC_VERSION,
      provisional: true,
    };
  }
  return {
    reportVersion: label,
    metricVersion: label,
    provisional: false,
  };
}

/**
 * @provisional-pending-AR-DATA-freeze
 * Empty allowlist → disposal forks to `non-reproducible-after-disposal`
 * unless report key is listed (metadata-only package; no unauthorized PII).
 * Set PUBLICATION_PACKAGE_RETAIN=1 to allow all keys in non-prod selfcheck.
 */
export const PUBLICATION_PACKAGE_ALLOWED_REPORT_KEYS: readonly string[] = [];

export function isPublicationPackageRetainAllowed(reportKey: string): boolean {
  if (process.env.PUBLICATION_PACKAGE_RETAIN?.trim() === "1") return true;
  return PUBLICATION_PACKAGE_ALLOWED_REPORT_KEYS.includes(reportKey);
}

export const PUBLICATION_STATUS = {
  published: "published",
  superseded: "superseded",
  nonReproducibleAfterDisposal: "non-reproducible-after-disposal",
  packageRetained: "package_retained",
} as const;

export type PublicationStatus =
  (typeof PUBLICATION_STATUS)[keyof typeof PUBLICATION_STATUS];

export const REPRODUCIBILITY_STATE = {
  reproducible: "reproducible",
  packageRetained: "package_retained",
  nonReproducibleAfterDisposal: "non-reproducible-after-disposal",
} as const;

export type ReproducibilityState =
  (typeof REPRODUCIBILITY_STATE)[keyof typeof REPRODUCIBILITY_STATE];

export const PUBLICATION_NOTICE_KINDS = [
  "correction",
  "metric_policy_change",
  "disposal",
  "supersession",
] as const;

export type PublicationNoticeKind =
  (typeof PUBLICATION_NOTICE_KINDS)[number];
