/**
 * GovernedDataTable session preferences (Story 8.6 / UX-DR31).
 * Per-account + per-table key in sessionStorage. Fail open to dense + no hidden columns.
 */

import { GOVERNED_TABLE_DEFAULT_DENSITY } from "@/components/governed-data-table/types";

export type TableDensity = "dense" | "comfortable";

export type TablePreferences = {
  density: TableDensity;
  hiddenColumnIds: string[];
};

export const TABLE_PREFS_STORAGE_PREFIX = "divan-table-prefs";

export const DEFAULT_TABLE_PREFERENCES: TablePreferences = {
  density: GOVERNED_TABLE_DEFAULT_DENSITY,
  hiddenColumnIds: [],
};

export function tablePreferencesStorageKey(
  accountId: string,
  preferencesKey: string,
): string {
  return `${TABLE_PREFS_STORAGE_PREFIX}:${accountId}:${preferencesKey}`;
}

function isDensity(value: unknown): value is TableDensity {
  return value === "dense" || value === "comfortable";
}

/**
 * Read prefs. Returns `null` when missing/unreadable so callers can apply
 * their own `defaultDensity`. Fail-open parse errors also return `null`.
 */
export function readTablePreferences(
  accountId: string,
  preferencesKey: string,
): TablePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      tablePreferencesStorageKey(accountId, preferencesKey),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const density = isDensity(record.density)
      ? record.density
      : GOVERNED_TABLE_DEFAULT_DENSITY;
    const hidden = Array.isArray(record.hiddenColumnIds)
      ? record.hiddenColumnIds.filter((id): id is string => typeof id === "string")
      : [];
    return { density, hiddenColumnIds: hidden };
  } catch {
    return null;
  }
}

/** Persist prefs. Fail open if sessionStorage is unavailable. */
export function writeTablePreferences(
  accountId: string,
  preferencesKey: string,
  prefs: TablePreferences,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      tablePreferencesStorageKey(accountId, preferencesKey),
      JSON.stringify({
        density: prefs.density,
        hiddenColumnIds: prefs.hiddenColumnIds,
      }),
    );
  } catch {
    // fail open — preference not persisted
  }
}
