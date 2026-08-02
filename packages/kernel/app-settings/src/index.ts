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
  applyEnvironmentOverlay,
  getSettingsConfigurationDetailFa,
  getSettingsDegradedKeys,
  invalidateSettingsCache,
  isSettingsCacheWarmed,
  isSettingsConfigurationDegraded,
  isSettingsStoreUnavailable,
  resetSettingsCacheForTests,
  resolveSetting,
  resolveSettingBoolean,
  resolveSettingNumber,
  resolveSettingString,
  resolveSettingStringList,
  warmSettingsCache,
  warmSettingsCacheFromEnvOnly,
} from "./resolver";

export {
  assertValidSettingsValue,
  invalidSettingsValueMessageFa,
  validateSettingsValue,
} from "./validate";

export {
  ENV_BINDINGS,
  DISABLED_INFERENCE_MIN_COHORT_SENTINEL,
  bindAuditTrustEffective,
  bindBaselineBoundaryDate,
  bindEnvelopeCategoryCount,
  bindInferenceBulkEffective,
  bindPgPoolMax,
  getEnvBinding,
  isLdapConfigured,
  listEnvBoundKeys,
  parseIdentityProviderMode,
  parseLdapConnectTimeoutMs,
  parseLdapCreateMappingMode,
  parseLdapTlsRejectUnauthorized,
  parseLdapUrlScheme,
  parseSessionTimeoutSeconds,
} from "./env-bindings";

export {
  BANNED_SECRET_PATTERNS,
  assertRegistryFreeOfSecrets,
  isSecretShapedKey,
  serializeInventoryValueForKey,
  serializeSettingsInventoryValue,
  valueLooksLikeSecret,
} from "./inventory-redaction";

export {
  MSG_SETTINGS_CONFIG_NOT_WARMED_FA,
  MSG_SETTINGS_CONFIG_OK_FA,
  getConfigurationOpsHealthSection,
} from "./ops-configuration-health";
