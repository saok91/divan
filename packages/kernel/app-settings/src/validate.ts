/**
 * Shared settings value parse/validate (Story 10.3).
 * One implementation for warm path and reject-before-write apply path.
 */

import { GovernedSettingsError } from "./registry";
import type { SettingsParameterDefinition, SettingsScalar } from "./types";

function isNumberLike(def: SettingsParameterDefinition): boolean {
  return def.valueType === "number" || def.valueType === "duration_ms";
}

/**
 * Validate a candidate value against a registry definition.
 * Returns null when the candidate is not valid for this definition.
 */
export function validateSettingsValue(
  def: SettingsParameterDefinition,
  raw: unknown,
): SettingsScalar | null {
  if (raw == null) return null;

  if (isNumberLike(def)) {
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : NaN;
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    if (def.range?.min != null && n < def.range.min) return null;
    if (def.range?.max != null && n > def.range.max) return null;
    return n;
  }

  if (def.valueType === "boolean") {
    if (typeof raw === "boolean") return raw;
    if (raw === "true" || raw === 1 || raw === "1") return true;
    if (raw === "false" || raw === 0 || raw === "0") return false;
    return null;
  }

  if (def.valueType === "string") {
    if (typeof raw !== "string") return null;
    if (def.allowlist && def.allowlist.length > 0) {
      if (!def.allowlist.includes(raw)) return null;
    }
    return raw;
  }

  if (def.valueType === "string_list") {
    let list: unknown[] | null = null;
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        return null;
      }
    }
    if (!list || !list.every((x) => typeof x === "string")) return null;
    const strings = list as string[];
    if (strings.length === 0) return null;
    if (def.allowlist && def.allowlist.length > 0) {
      for (const s of strings) {
        if (!def.allowlist.includes(s)) return null;
      }
    }
    // Deduplicate while preserving first-seen order (UI toggles never emit dupes).
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const s of strings) {
      if (seen.has(s)) continue;
      seen.add(s);
      unique.push(s);
    }
    return unique;
  }

  return null;
}

export function invalidSettingsValueMessageFa(
  def: SettingsParameterDefinition,
): string {
  if (isNumberLike(def) && def.range) {
    const min = def.range.min != null ? String(def.range.min) : "—";
    const max = def.range.max != null ? String(def.range.max) : "—";
    return `مقدار «${def.labelFa}» خارج از بازهٔ مجاز است (حداقل ${min}، حداکثر ${max}).`;
  }
  if (
    (def.valueType === "string" || def.valueType === "string_list") &&
    def.allowlist &&
    def.allowlist.length > 0
  ) {
    return `مقدار «${def.labelFa}» باید زیرمجموعهٔ غیرخالی از فهرست مجاز باشد.`;
  }
  return `مقدار «${def.labelFa}» نامعتبر است.`;
}

/** Reject-before-write: throws GovernedSettingsError when parse fails. */
export function assertValidSettingsValue(
  def: SettingsParameterDefinition,
  raw: unknown,
): SettingsScalar {
  const parsed = validateSettingsValue(def, raw);
  if (parsed == null) {
    throw new GovernedSettingsError(
      "SETTINGS_INVALID_DEFINITION",
      invalidSettingsValueMessageFa(def),
    );
  }
  return parsed;
}
