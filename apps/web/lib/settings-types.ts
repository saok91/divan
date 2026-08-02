/**
 * Shared settings list DTO (Story 10.2–10.3) — server + client row contract.
 */

import type { SettingsValueSource } from "@divan/app-settings";

export type SettingsParameterRowDto = {
  key: string;
  labelFa: string;
  descriptionFa: string;
  unitFa: string | null;
  value: string | number | boolean | string[];
  defaultValue: string | number | boolean | string[];
  source: SettingsValueSource;
  range: { min?: number; max?: number } | null;
  allowlist: readonly string[] | null;
  editability: "admin_editable" | "read_only_with_evidence";
  changePathFa: string | null;
  lastChangedBy: string | null;
  lastChangedAtIso: string | null;
  valueType: string;
  highImpact: boolean;
  blastRadiusFa: string | null;
};

export type SettingsListByDomainResult = {
  domain: string;
  rows: SettingsParameterRowDto[];
  /** True when override store could not be used — values are code defaults. */
  storeUnavailable: boolean;
  /** Short Persian detail when storeUnavailable (or null). */
  detailFa: string | null;
};

export type SettingsMutationResult = {
  row: SettingsParameterRowDto;
};
