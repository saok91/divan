/**
 * @divan/app-settings — governed settings registry, store, resolver (Story 10.1 / AD-7).
 */

export type {
  ConfigurationHealthSection,
  ResolvedSetting,
  SettingsBoundaryClass,
  SettingsEditability,
  SettingsOverrideRow,
  SettingsOwningDomain,
  SettingsParameterDefinition,
  SettingsRange,
  SettingsScalar,
  SettingsValueSource,
  SettingsValueType,
} from "./types";

export {
  GOVERNED_SETTINGS_REGISTRY,
  GovernedSettingsError,
  getCodeDefault,
  getSettingsParameter,
  isGovernedSettingsKey,
  listAdminEditableKeys,
  listGovernedSettingsKeys,
  requireGovernedSettingsRegistry,
  type GovernedSettingsKey,
} from "./registry";

export {
  deleteOverride,
  loadAllOverrides,
  mapOverrideRow,
  upsertOverride,
  type PgQueryable,
} from "./store";

export {
  MSG_SETTINGS_CONFIG_DEGRADED_FA,
  MSG_SETTINGS_STORE_UNAVAILABLE_FA,
  getSettingsConfigurationDetailFa,
  getSettingsDegradedKeys,
  invalidateSettingsCache,
  isSettingsCacheWarmed,
  isSettingsConfigurationDegraded,
  isSettingsStoreUnavailable,
  resetSettingsCacheForTests,
  resolveSetting,
  resolveSettingNumber,
  resolveSettingString,
  resolveSettingStringList,
  warmSettingsCache,
} from "./resolver";

export {
  assertValidSettingsValue,
  invalidSettingsValueMessageFa,
  validateSettingsValue,
} from "./validate";

export {
  MSG_SETTINGS_CONFIG_NOT_WARMED_FA,
  MSG_SETTINGS_CONFIG_OK_FA,
  getConfigurationOpsHealthSection,
} from "./ops-configuration-health";
