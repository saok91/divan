/**
 * FR45 configuration health section for ops snapshot (Story 10.1).
 * HR-free; folds into OpsHealthSnapshot.configuration without a second DTO family.
 */

import {
  getSettingsConfigurationDetailFa,
  isSettingsCacheWarmed,
  isSettingsConfigurationDegraded,
  isSettingsStoreUnavailable,
  MSG_SETTINGS_CONFIG_DEGRADED_FA,
  MSG_SETTINGS_STORE_UNAVAILABLE_FA,
} from "./resolver";
import type { ConfigurationHealthSection } from "./types";

export const MSG_SETTINGS_CONFIG_OK_FA =
  "پیکربندی تنظیمات سالم است.";

export const MSG_SETTINGS_CONFIG_NOT_WARMED_FA =
  "کش تنظیمات هنوز گرم نشده؛ مقادیر پیش‌فرض کد در حال استفاده‌اند.";

/**
 * Build configuration section for ops health.
 * Prefer calling after warmSettingsCache at process boot / ops probe.
 */
export function getConfigurationOpsHealthSection(): ConfigurationHealthSection {
  const updatedAt = new Date().toISOString();

  if (!isSettingsCacheWarmed()) {
    return {
      status: "degraded",
      detailFa: MSG_SETTINGS_CONFIG_NOT_WARMED_FA,
      updatedAt,
    };
  }

  if (isSettingsStoreUnavailable()) {
    return {
      status: "degraded",
      detailFa:
        getSettingsConfigurationDetailFa() ?? MSG_SETTINGS_STORE_UNAVAILABLE_FA,
      updatedAt,
    };
  }

  if (isSettingsConfigurationDegraded()) {
    return {
      status: "degraded",
      detailFa:
        getSettingsConfigurationDetailFa() ?? MSG_SETTINGS_CONFIG_DEGRADED_FA,
      updatedAt,
      pendingCount: undefined,
    };
  }

  return {
    status: "ok",
    detailFa: MSG_SETTINGS_CONFIG_OK_FA,
    updatedAt,
  };
}
