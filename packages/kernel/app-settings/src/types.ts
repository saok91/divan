/**
 * Governed settings types (Story 10.1 / FR-60 / AD-7).
 * Registry = code definitions; store = persisted overrides; resolver = SoT reads.
 */

export type SettingsValueType =
  | "number"
  | "string"
  | "boolean"
  | "duration_ms"
  | "string_list";

export type SettingsEditability =
  | "admin_editable"
  | "read_only_with_evidence";

/** UX-DR36 tab domains. */
export type SettingsOwningDomain =
  | "general_display"
  | "data_retention"
  | "import_export"
  | "capacity_hiring"
  | "access_session"
  | "audit_integrity"
  | "infrastructure";

export type SettingsBoundaryClass = "operational" | "security_posture";

export type SettingsValueSource = "code_default" | "store" | "environment";

export type SettingsScalar = number | string | boolean | readonly string[];

export type SettingsRange = {
  min?: number;
  max?: number;
};

export type SettingsParameterDefinition = {
  key: string;
  labelFa: string;
  descriptionFa: string;
  valueType: SettingsValueType;
  unitFa: string | null;
  range: SettingsRange | null;
  allowlist: readonly string[] | null;
  defaultValue: SettingsScalar;
  editability: SettingsEditability;
  owningDomain: SettingsOwningDomain;
  /** Required when editability is read_only_with_evidence. */
  changePathFa: string | null;
  highImpact: boolean;
  blastRadiusFa: string | null;
  boundaryClass: SettingsBoundaryClass;
};

export type ResolvedSetting<T extends SettingsScalar = SettingsScalar> = {
  value: T;
  source: SettingsValueSource;
  degraded: boolean;
  key: string;
};

export type SettingsOverrideRow = {
  parameterKey: string;
  valueJson: unknown;
  updatedAt: string;
  updatedBy: string | null;
  reason: string | null;
  previousValueJson: unknown | null;
  effectAt: string | null;
};

/**
 * FR45-compatible section shape (mirrors OpsHealthSection structurally;
 * audit-envelope remains the DTO owner — no circular import).
 */
export type ConfigurationHealthSection = {
  status: "ok" | "degraded" | "unavailable";
  detailFa?: string;
  updatedAt?: string;
  pendingCount?: number;
};
