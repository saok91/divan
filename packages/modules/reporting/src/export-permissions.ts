/**
 * Provisional export permissions (Story 6.5 / FR-41).
 * AR-ACCESS / AR-DATA pending freeze — code-marked fail-closed keys only.
 *
 * Envelope policy must use action: "export" (not read) — 6.4 lesson.
 */

import { resolveSettingNumber } from "@divan/app-settings";

/** @provisional-pending-AR-ACCESS-freeze */
export const REPORT_EXPORT_PERMISSION = "report.export";

/** @provisional-pending-AR-ACCESS-freeze */
export const PERSON_EXPORT_PERMISSION = "person.export";

/**
 * @provisional-pending-AR-ACCESS-freeze
 * get / download / revoke managed artifacts (surface-agnostic retrieve gate).
 * Seed alongside report.export / person.export; handler still soft-checks surface key.
 */
export const EXPORT_RETRIEVE_PERMISSION = "export.retrieve";

/**
 * @provisional — default managed-artifact TTL via AD-7 resolver (Story 10.1).
 * Short fail-closed window (hours), not a signed retention policy.
 */
export function EXPORT_ARTIFACT_TTL_MS(): number {
  return resolveSettingNumber("export.artifact_ttl_ms").value;
}

/**
 * @provisional — custody acknowledgement threshold via AD-7 resolver (Story 10.1).
 * Bulk retrieval even without sensitive columns. Not an AR volume threshold.
 */
export function EXPORT_CUSTODY_BULK_ROW_THRESHOLD(): number {
  return resolveSettingNumber("export.custody_bulk_row_threshold").value;
}

export const CLASSIFICATION_INTERNAL_FA = "داخلی — محدود";
export const CLASSIFICATION_SENSITIVE_FA = "حساس — محدود";
export const HANDLING_DEFAULT_FA =
  "فقط گیرندهٔ مجاز؛ پس از انقضا دریافت از سامانه ممکن نیست.";
export const CUSTODY_BOUNDARY_FA =
  "دیوان پیوند/خروجی مدیریت‌شده را لغو می‌کند؛ نسخه‌های محلی، ایمیل یا اشتراک خارج از سامانه تحت کنترل دیوان نیستند و باید طبق فرایند سازمانی امحا شوند.";
