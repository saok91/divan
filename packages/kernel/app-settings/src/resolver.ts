/**
 * Single cached governed-settings resolver (Story 10.1 / AD-7 / FR-45).
 *
 * Boot/warm loads store once → validate → env overlay for RO bindings → cache.
 * Hot resolve path is sync + cache-only (no DB; no per-request process.env).
 * Invalid / missing / unavailable → code default + degraded.
 */

import type { Pool, PoolClient } from "pg";

import { ENV_BINDINGS } from "./env-bindings";
import {
  getCodeDefault,
  getSettingsParameter,
  listGovernedSettingsKeys,
  requireGovernedSettingsRegistry,
} from "./registry";
import { loadAllOverrides, type PgQueryable } from "./store";
import type {
  ResolvedSetting,
  SettingsParameterDefinition,
  SettingsScalar,
  SettingsValueSource,
} from "./types";
import { validateSettingsValue } from "./validate";

export {
  assertValidSettingsValue,
  invalidSettingsValueMessageFa,
  validateSettingsValue,
} from "./validate";

type CacheEntry = {
  value: SettingsScalar;
  source: SettingsValueSource;
  degraded: boolean;
};

type WarmState = {
  warmed: boolean;
  degraded: boolean;
  /** Parameter keys that failed closed from invalid/unavailable store values. */
  degradedKeys: string[];
  detailFa: string | null;
  storeUnavailable: boolean;
  entries: Map<string, CacheEntry>;
};

const state: WarmState = {
  warmed: false,
  degraded: false,
  degradedKeys: [],
  detailFa: null,
  storeUnavailable: false,
  entries: new Map(),
};

let warmQueue: Promise<void> = Promise.resolve();

export const MSG_SETTINGS_CONFIG_DEGRADED_FA =
  "پیکربندی تنظیمات ناقص یا نامعتبر بود؛ مقادیر پیش‌فرض کد اعمال شد.";

export const MSG_SETTINGS_STORE_UNAVAILABLE_FA =
  "مخزن تنظیمات در دسترس نبود؛ مقادیر پیش‌فرض کد اعمال شد.";

function seedCodeDefaults(degraded: boolean): Map<string, CacheEntry> {
  const entries = new Map<string, CacheEntry>();
  for (const key of listGovernedSettingsKeys()) {
    entries.set(key, {
      value: getCodeDefault(key),
      source: "code_default",
      degraded,
    });
  }
  return entries;
}

function applyValidatedOverrides(
  overrides: Array<{ parameterKey: string; valueJson: unknown }>,
): { entries: Map<string, CacheEntry>; degradedKeys: string[] } {
  const entries = seedCodeDefaults(false);
  const degradedKeys: string[] = [];

  for (const row of overrides) {
    let def: SettingsParameterDefinition;
    try {
      def = getSettingsParameter(row.parameterKey);
    } catch {
      // Unknown store key — ignore; do not invent registry entries from store.
      degradedKeys.push(row.parameterKey);
      continue;
    }
    // Store must not override read-only / security posture keys (Gate / FR-60).
    if (def.editability !== "admin_editable") {
      degradedKeys.push(row.parameterKey);
      continue;
    }
    const parsed = validateSettingsValue(def, row.valueJson);
    if (parsed == null) {
      degradedKeys.push(row.parameterKey);
      continue;
    }
    entries.set(row.parameterKey, {
      value: parsed,
      source: "store",
      degraded: false,
    });
  }

  for (const key of degradedKeys) {
    if (!entries.has(key)) continue;
    const cur = entries.get(key)!;
    if (cur.source === "code_default") {
      entries.set(key, { ...cur, degraded: true });
    }
  }

  return { entries, degradedKeys };
}

/**
 * Overlay env-bound RO keys after code defaults + store admin_editable.
 * Capture env once at warm — hot resolve never re-reads process.env.
 */
export function applyEnvironmentOverlay(
  entries: Map<string, CacheEntry>,
  degradedKeys: string[],
  env: NodeJS.ProcessEnv = process.env,
): { entries: Map<string, CacheEntry>; degradedKeys: string[] } {
  const next = new Map(entries);
  const degraded = [...degradedKeys];

  for (const binding of ENV_BINDINGS) {
    let def: SettingsParameterDefinition;
    try {
      def = getSettingsParameter(binding.key);
    } catch {
      continue;
    }
    if (def.editability === "admin_editable") continue;

    const result = binding.bind(def, env);
    if (!result.ok) {
      if (result.reason === "invalid") {
        if (!degraded.includes(binding.key)) degraded.push(binding.key);
        const cur = next.get(binding.key);
        if (cur) {
          const inventoryValue = result.inventoryValue;
          next.set(binding.key, {
            value:
              inventoryValue !== undefined
                ? inventoryValue
                : getCodeDefault(binding.key),
            source:
              inventoryValue !== undefined && binding.emitEnvironmentSource
                ? "environment"
                : "code_default",
            degraded: true,
          });
        }
      }
      // missing → leave seeded code_default (or store — but RO never store)
      continue;
    }

    const source: SettingsValueSource =
      result.fromEnv && binding.emitEnvironmentSource
        ? "environment"
        : "code_default";
    next.set(binding.key, {
      value: result.value,
      source,
      degraded: false,
    });
  }

  return { entries: next, degradedKeys: degraded };
}

/**
 * Warm (or re-warm) the process-local cache from the store + env snapshot.
 * Store unavailable → all code defaults + degraded (no throw), then env overlay.
 */
export async function warmSettingsCache(
  db: PgQueryable,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const run = async () => {
    requireGovernedSettingsRegistry();
    try {
      const rows = await loadAllOverrides(db);
      const applied = applyValidatedOverrides(rows);
      const overlaid = applyEnvironmentOverlay(
        applied.entries,
        applied.degradedKeys,
        env,
      );
      state.entries = overlaid.entries;
      state.degradedKeys = overlaid.degradedKeys;
      state.degraded = overlaid.degradedKeys.length > 0;
      state.detailFa =
        overlaid.degradedKeys.length > 0 ? MSG_SETTINGS_CONFIG_DEGRADED_FA : null;
      state.storeUnavailable = false;
      state.warmed = true;
    } catch {
      const seeded = seedCodeDefaults(true);
      const overlaid = applyEnvironmentOverlay(seeded, [], env);
      state.entries = overlaid.entries;
      state.degradedKeys = overlaid.degradedKeys;
      state.degraded = true;
      state.detailFa = MSG_SETTINGS_STORE_UNAVAILABLE_FA;
      state.storeUnavailable = true;
      state.warmed = true;
    }
  };

  warmQueue = warmQueue.then(run, run);
  await warmQueue;
}

/**
 * Warm from env only (no DB) — tests / early boot inventory.
 * Still marks warmed so resolveSetting* is sync/cache-only afterward.
 * `storeUnavailable` stays true — there is no settings store in this path.
 */
export async function warmSettingsCacheFromEnvOnly(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const run = async () => {
    requireGovernedSettingsRegistry();
    const seeded = seedCodeDefaults(false);
    const overlaid = applyEnvironmentOverlay(seeded, [], env);
    state.entries = overlaid.entries;
    state.degradedKeys = overlaid.degradedKeys;
    state.degraded = overlaid.degradedKeys.length > 0;
    state.detailFa =
      overlaid.degradedKeys.length > 0 ? MSG_SETTINGS_CONFIG_DEGRADED_FA : null;
    state.storeUnavailable = true;
    state.warmed = true;
  };
  warmQueue = warmQueue.then(run, run);
  await warmQueue;
}

/**
 * Invalidate and optionally re-warm. Concurrent resolves never see half maps
 * because swap happens atomically after build inside the warm queue.
 */
export async function invalidateSettingsCache(
  db?: PgQueryable | Pool | PoolClient,
): Promise<void> {
  if (db) {
    await warmSettingsCache(db);
    return;
  }
  const run = async () => {
    state.warmed = false;
    state.entries = new Map();
    state.degraded = false;
    state.degradedKeys = [];
    state.detailFa = null;
    state.storeUnavailable = false;
  };
  warmQueue = warmQueue.then(run, run);
  await warmQueue;
}

/** Test helper — reset process cache without DB. */
export function resetSettingsCacheForTests(): void {
  state.warmed = false;
  state.entries = new Map();
  state.degraded = false;
  state.degradedKeys = [];
  state.detailFa = null;
  state.storeUnavailable = false;
  warmQueue = Promise.resolve();
}

function ensureEntry(key: string): CacheEntry {
  getSettingsParameter(key); // fail-closed unknown
  if (!state.warmed) {
    // Not yet warmed: fail closed to code default (no DB on hot path).
    // Mark degraded so FR45 is not silent-OK before boot/ops warm.
    return {
      value: getCodeDefault(key),
      source: "code_default",
      degraded: true,
    };
  }
  const entry = state.entries.get(key);
  if (!entry) {
    return {
      value: getCodeDefault(key),
      source: "code_default",
      degraded: true,
    };
  }
  return entry;
}

export function resolveSetting<T extends SettingsScalar = SettingsScalar>(
  key: string,
): ResolvedSetting<T> {
  const entry = ensureEntry(key);
  return {
    key,
    value: entry.value as T,
    source: entry.source,
    degraded:
      entry.degraded ||
      (state.warmed &&
        state.degraded &&
        entry.source === "code_default" &&
        state.degradedKeys.includes(key)),
  };
}

export function resolveSettingNumber(key: string): ResolvedSetting<number> {
  const resolved = resolveSetting<number>(key);
  if (typeof resolved.value !== "number") {
    return {
      key,
      value: getCodeDefault(key) as number,
      source: "code_default",
      degraded: true,
    };
  }
  return resolved;
}

export function resolveSettingString(key: string): ResolvedSetting<string> {
  const resolved = resolveSetting<string>(key);
  if (typeof resolved.value !== "string") {
    return {
      key,
      value: getCodeDefault(key) as string,
      source: "code_default",
      degraded: true,
    };
  }
  return resolved;
}

export function resolveSettingBoolean(key: string): ResolvedSetting<boolean> {
  const resolved = resolveSetting<boolean>(key);
  if (typeof resolved.value !== "boolean") {
    return {
      key,
      value: getCodeDefault(key) as boolean,
      source: "code_default",
      degraded: true,
    };
  }
  return resolved;
}

export function resolveSettingStringList(
  key: string,
): ResolvedSetting<readonly string[]> {
  const resolved = resolveSetting<readonly string[]>(key);
  if (!Array.isArray(resolved.value)) {
    return {
      key,
      value: getCodeDefault(key) as readonly string[],
      source: "code_default",
      degraded: true,
    };
  }
  return resolved;
}

export function isSettingsConfigurationDegraded(): boolean {
  return state.warmed && state.degraded;
}

export function getSettingsDegradedKeys(): readonly string[] {
  return state.degradedKeys;
}

export function getSettingsConfigurationDetailFa(): string | null {
  return state.detailFa;
}

export function isSettingsCacheWarmed(): boolean {
  return state.warmed;
}

export function isSettingsStoreUnavailable(): boolean {
  return state.storeUnavailable;
}
