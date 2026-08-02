/**
 * Governed settings override store (Story 10.1 / AD-7).
 * Raw SQL via pg — not Prisma. Migrations-only schema.
 */

import type { Pool, PoolClient } from "pg";

import {
  GovernedSettingsError,
  getSettingsParameter,
} from "./registry";
import type { SettingsOverrideRow, SettingsScalar } from "./types";
import { assertValidSettingsValue } from "./validate";

export type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

function asIso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function asIsoOrNull(value: unknown): string | null {
  if (value == null) return null;
  return asIso(value);
}

export function mapOverrideRow(row: Record<string, unknown>): SettingsOverrideRow {
  return {
    parameterKey: String(row.parameter_key),
    valueJson: row.value_json,
    updatedAt: asIso(row.updated_at),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
    reason: row.reason == null ? null : String(row.reason),
    previousValueJson: row.previous_value_json ?? null,
    effectAt: asIsoOrNull(row.effect_at),
  };
}

export async function loadAllOverrides(
  db: PgQueryable,
): Promise<SettingsOverrideRow[]> {
  const res = await db.query(
    `SELECT parameter_key, value_json, updated_at, updated_by, reason,
            previous_value_json, effect_at
       FROM app_settings.parameter_override`,
  );
  return (res.rows as Record<string, unknown>[]).map(mapOverrideRow);
}

async function refreshCacheAfterMutation(db: PgQueryable): Promise<void> {
  const { invalidateSettingsCache } = await import("./resolver");
  await invalidateSettingsCache(db);
}

export async function upsertOverride(
  db: PgQueryable,
  input: {
    parameterKey: string;
    value: SettingsScalar;
    updatedBy?: string | null;
    reason?: string | null;
    effectAt?: string | null;
  },
): Promise<SettingsOverrideRow> {
  const def = getSettingsParameter(input.parameterKey);
  if (def.editability !== "admin_editable") {
    throw new GovernedSettingsError(
      "SETTINGS_INVALID_DEFINITION",
      `پارامتر فقط‌خواندنی قابل ذخیره در مخزن نیست: ${input.parameterKey}`,
    );
  }
  // Shared parse — reject before write (do not rely on warm degrade).
  const parsed = assertValidSettingsValue(def, input.value);

  const effectAt =
    input.effectAt == null || String(input.effectAt).trim() === ""
      ? null
      : input.effectAt;

  const res = await db.query(
    `INSERT INTO app_settings.parameter_override AS o
       (parameter_key, value_json, updated_at, updated_by, reason,
        previous_value_json, effect_at)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP, $3, $4, NULL, $5::timestamptz)
     ON CONFLICT (parameter_key) DO UPDATE SET
       previous_value_json = o.value_json,
       value_json = EXCLUDED.value_json,
       updated_at = CURRENT_TIMESTAMP,
       updated_by = EXCLUDED.updated_by,
       reason = EXCLUDED.reason,
       effect_at = EXCLUDED.effect_at
     RETURNING parameter_key, value_json, updated_at, updated_by, reason,
               previous_value_json, effect_at`,
    [
      input.parameterKey,
      JSON.stringify(parsed),
      input.updatedBy ?? null,
      input.reason ?? null,
      effectAt,
    ],
  );
  const row = mapOverrideRow(res.rows[0] as Record<string, unknown>);
  await refreshCacheAfterMutation(db);
  return row;
}

/**
 * Reset to code default = delete store row (full audited reset product = 10.5).
 */
export async function deleteOverride(
  db: PgQueryable,
  parameterKey: string,
): Promise<boolean> {
  getSettingsParameter(parameterKey);
  const res = await db.query(
    `DELETE FROM app_settings.parameter_override
      WHERE parameter_key = $1
      RETURNING parameter_key`,
    [parameterKey],
  );
  const deleted = (res.rowCount ?? 0) > 0;
  await refreshCacheAfterMutation(db);
  return deleted;
}
