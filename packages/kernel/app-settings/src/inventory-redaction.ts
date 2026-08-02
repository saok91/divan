/**
 * Settings inventory secret redaction (Story 10.4 / AC #3).
 * Fail-closed: refuse to emit secret-shaped keys or values.
 */

import { GovernedSettingsError, getSettingsParameter } from "./registry";
import type { SettingsParameterDefinition, SettingsScalar } from "./types";

/** Substrings / exact env names that must never appear in inventory serialization. */
export const BANNED_SECRET_PATTERNS: readonly RegExp[] = Object.freeze([
  /password/i,
  /secret/i,
  /token/i,
  /private[_\s-]?key/i,
  /connection[_\s-]?string/i,
  /DATABASE_URL/i,
  /LDAP_BIND_PASSWORD/i,
  /LDAP_TLS_CA/i,
  /LDAP_BIND_DN/i,
  /BEGIN\s+(RSA\s+)?PRIVATE\s+KEY/i,
  /BEGIN\s+CERTIFICATE/i,
]);

const BANNED_KEY_FRAGMENTS = Object.freeze([
  "password",
  "secret",
  "token",
  "private_key",
  "connection_string",
  "database_url",
  "bind_password",
  "tls_ca",
  "bind_dn",
]);

export function isSecretShapedKey(key: string): boolean {
  const lower = key.toLowerCase();
  return BANNED_KEY_FRAGMENTS.some((f) => lower.includes(f));
}

export function valueLooksLikeSecret(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (s.length === 0) return false;
  for (const re of BANNED_SECRET_PATTERNS) {
    if (re.test(s)) return true;
  }
  // Connection-string heuristic (never inventory DATABASE_URL-like values).
  if (/postgres(ql)?:\/\//i.test(s) || /ldap(s)?:\/\/[^/\s]+:[^@\s]+@/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * Serialize a registry value for list DTO / export / access-event payloads.
 * Throws when the key or value is secret-shaped (fail closed).
 */
export function serializeSettingsInventoryValue(
  def: SettingsParameterDefinition,
  value: SettingsScalar,
): string | number | boolean | string[] {
  if (isSecretShapedKey(def.key)) {
    throw new GovernedSettingsError(
      "SETTINGS_INVALID_DEFINITION",
      `کلید حساس در فهرست موجودی مجاز نیست: ${def.key}`,
    );
  }
  if (typeof def.defaultValue === "string" && valueLooksLikeSecret(def.defaultValue)) {
    throw new GovernedSettingsError(
      "SETTINGS_INVALID_DEFINITION",
      `مقدار پیش‌فرض حساس برای ${def.key} مجاز نیست.`,
    );
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (valueLooksLikeSecret(item)) {
        throw new GovernedSettingsError(
          "SETTINGS_INVALID_DEFINITION",
          `مقدار فهرست حساس برای ${def.key} مجاز نیست.`,
        );
      }
    }
    return [...value];
  }
  if (typeof value === "string" && valueLooksLikeSecret(value)) {
    throw new GovernedSettingsError(
      "SETTINGS_INVALID_DEFINITION",
      `مقدار حساس برای ${def.key} مجاز نیست.`,
    );
  }
  return value as string | number | boolean;
}

/** Resolve + redact by key — refuses unknown/secret-shaped registry mistakes. */
export function serializeInventoryValueForKey(
  key: string,
  value: SettingsScalar,
): string | number | boolean | string[] {
  const def = getSettingsParameter(key);
  return serializeSettingsInventoryValue(def, value);
}

/** Assert registry defaults/allowlists never embed banned secret material. */
export function assertRegistryFreeOfSecrets(
  defs: readonly SettingsParameterDefinition[],
): void {
  for (const def of defs) {
    if (isSecretShapedKey(def.key)) {
      throw new GovernedSettingsError(
        "SETTINGS_INVALID_DEFINITION",
        `کلید شبیه secret در رجیستری: ${def.key}`,
      );
    }
    if (
      typeof def.defaultValue === "string" &&
      valueLooksLikeSecret(def.defaultValue)
    ) {
      throw new GovernedSettingsError(
        "SETTINGS_INVALID_DEFINITION",
        `defaultValue شبیه secret برای ${def.key}`,
      );
    }
    if (def.allowlist) {
      for (const item of def.allowlist) {
        if (valueLooksLikeSecret(item) || /PASSWORD|SECRET|DATABASE_URL|LDAP_TLS_CA/i.test(item)) {
          throw new GovernedSettingsError(
            "SETTINGS_INVALID_DEFINITION",
            `allowlist شبیه secret برای ${def.key}`,
          );
        }
      }
    }
    if (
      def.changePathFa &&
      /LDAP_BIND_PASSWORD|DATABASE_URL|LDAP_TLS_CA/.test(def.changePathFa)
    ) {
      // changePathFa may name env vars for operators — naming the var is OK;
      // ensure we never put the *value* there. Pattern names alone are allowed.
    }
  }
}
