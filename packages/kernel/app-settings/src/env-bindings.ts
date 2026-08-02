/**
 * Env bindings for read-only inventory keys (Story 10.4 / AD-7).
 * Pure parsers shared by warm overlay and module cutover — no circular imports.
 * Capture at warm time; hot resolve stays sync/cache-only.
 */

import { readFileSync } from "node:fs";

import { validateSettingsValue } from "./validate";
import type { SettingsParameterDefinition, SettingsScalar } from "./types";

export type EnvBindingKind =
  | "direct" // parse env var with validateSettingsValue
  | "derived"; // custom binder (LDAP posture, inference, trust, pool, baseline, categories)

export type EnvBinding = {
  key: string;
  /** Env var name when kind is direct; optional hint for derived. */
  envKey?: string;
  kind: EnvBindingKind;
  /**
   * When true, successful bind sets source "environment".
   * Derived code-only binders (category count) keep code_default.
   */
  emitEnvironmentSource: boolean;
  bind: (
    def: SettingsParameterDefinition,
    env: NodeJS.ProcessEnv,
  ) =>
    | { ok: true; value: SettingsScalar; fromEnv: boolean }
    | {
        ok: false;
        reason: "missing" | "invalid";
        /** When set, inventory shows this value + degraded instead of bare code default. */
        inventoryValue?: SettingsScalar;
      };
};

function trim(raw: string | undefined): string {
  return (raw ?? "").trim();
}

function parsePositiveInt(raw: string | undefined): number | null {
  if (raw == null || trim(raw) === "") return null;
  const n = Number.parseInt(trim(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Shared with identity-access cutover — unknown → null (fail closed). */
export function parseIdentityProviderMode(
  raw: string | undefined,
): "seeded" | "ldap" | null {
  const v = trim(raw).toLowerCase();
  if (v === "") return null;
  if (v === "ldap" || v === "seeded") return v;
  return null;
}

export function parseSessionTimeoutSeconds(
  raw: string | undefined,
  fallback: number,
): number {
  const n = parsePositiveInt(raw);
  return n ?? fallback;
}

/** LDAP required env presence (no URL/DN/password values). */
export function isLdapConfigured(env: NodeJS.ProcessEnv): boolean {
  const url = trim(env.LDAP_URL);
  const bindDn = trim(env.LDAP_BIND_DN);
  const bindPassword = env.LDAP_BIND_PASSWORD ?? "";
  const baseDn = trim(env.LDAP_BASE_DN);
  const userFilter = trim(env.LDAP_USER_FILTER);
  const idAttribute = trim(env.LDAP_ID_ATTRIBUTE);
  if (!url || !bindDn || bindPassword === "" || !baseDn || !userFilter || !idAttribute) {
    return false;
  }
  if (!userFilter.includes("{{username}}")) return false;
  if (!url.startsWith("ldap://") && !url.startsWith("ldaps://")) return false;
  return true;
}

export function parseLdapUrlScheme(
  env: NodeJS.ProcessEnv,
): "ldap" | "ldaps" | "unset" {
  const url = trim(env.LDAP_URL).toLowerCase();
  if (url.startsWith("ldaps://")) return "ldaps";
  if (url.startsWith("ldap://")) return "ldap";
  return "unset";
}

export function parseLdapTlsRejectUnauthorized(env: NodeJS.ProcessEnv): boolean {
  const rejectRaw = trim(env.LDAP_TLS_REJECT_UNAUTHORIZED).toLowerCase();
  return rejectRaw !== "false";
}

export function parseLdapConnectTimeoutMs(env: NodeJS.ProcessEnv): number {
  return parsePositiveInt(env.LDAP_CONNECT_TIMEOUT_MS) ?? 10_000;
}

export function parseLdapCreateMappingMode(
  env: NodeJS.ProcessEnv,
): "forbidden" | "mapped" | "invalid" {
  const trimmed = trim(env.LDAP_CREATE_MAPPING_JSON);
  if (trimmed === "") return "forbidden";
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "invalid";
    }
    return Object.keys(parsed as Record<string, unknown>).length > 0
      ? "mapped"
      : "forbidden";
  } catch {
    return "invalid";
  }
}

/**
 * JSON-safe stand-in for DISABLED_INFERENCE_BULK_HOOKS.minimumCohortSize
 * (`Number.POSITIVE_INFINITY`) — comparisons treat this as "never small enough".
 */
export const DISABLED_INFERENCE_MIN_COHORT_SENTINEL = Number.MAX_SAFE_INTEGER;

/** Mirrors loadInferenceBulkHooks without importing audit-envelope. */
export function bindInferenceBulkEffective(env: NodeJS.ProcessEnv): {
  enabled: boolean;
  minCohort: number;
  maxVolumePerRequest: number;
  maxVolumePerWindow: number;
  fromEnvFlag: boolean;
} {
  const flag = trim(env.AUDIT_INFERENCE_BULK_ENABLED).toLowerCase();
  const fromEnvFlag = flag === "true" || flag === "false";
  let enabled: boolean;
  if (flag === "false") enabled = false;
  else if (flag === "true") enabled = true;
  else enabled = (env.NODE_ENV ?? "").toLowerCase() !== "production";

  if (!enabled) {
    // DISABLED posture — volumes 0; cohort = Infinity stand-in (not 0).
    return {
      enabled: false,
      minCohort: DISABLED_INFERENCE_MIN_COHORT_SENTINEL,
      maxVolumePerRequest: 0,
      maxVolumePerWindow: 0,
      fromEnvFlag,
    };
  }
  return {
    enabled: true,
    minCohort: 3,
    maxVolumePerRequest: 10,
    maxVolumePerWindow: 20,
    fromEnvFlag,
  };
}

/** Mirrors loadAuditTrustProvisionalConfig defaults (no throw on enforce missing). */
export function bindAuditTrustEffective(env: NodeJS.ProcessEnv): {
  enforce: boolean;
  maxClockSkewMs: number;
  verificationWindowHours: number;
  /** 0 = none (null TTL). */
  suspendTtlMs: number;
  fromEnv: boolean;
  invalid: boolean;
} {
  const enforce =
    env.DIVAN_AUDIT_TRUST_ENFORCE === "1" ||
    env.DIVAN_AUDIT_TRUST_ENFORCE === "true";
  const skew = parsePositiveInt(env.DIVAN_AUDIT_TRUST_MAX_CLOCK_SKEW_MS);
  const windowHours = parsePositiveInt(
    env.DIVAN_AUDIT_TRUST_VERIFICATION_WINDOW_HOURS,
  );
  const ttlRaw = trim(env.DIVAN_AUDIT_TRUST_SUSPEND_TTL_MS);
  let suspendTtlMs = 0;
  let ttlInvalid = false;
  if (ttlRaw === "" || ttlRaw === "0" || ttlRaw === "none") {
    suspendTtlMs = 0;
  } else {
    const ttl = parsePositiveInt(ttlRaw);
    if (ttl == null) ttlInvalid = true;
    else suspendTtlMs = ttl;
  }

  const anyTrustEnv =
    trim(env.DIVAN_AUDIT_TRUST_ENFORCE) !== "" ||
    trim(env.DIVAN_AUDIT_TRUST_MAX_CLOCK_SKEW_MS) !== "" ||
    trim(env.DIVAN_AUDIT_TRUST_VERIFICATION_WINDOW_HOURS) !== "" ||
    ttlRaw !== "";

  if (enforce && (skew == null || windowHours == null)) {
    return {
      enforce: true,
      maxClockSkewMs: 120_000,
      verificationWindowHours: 24,
      suspendTtlMs: 0,
      fromEnv: true,
      invalid: true,
    };
  }

  return {
    enforce,
    maxClockSkewMs: skew ?? 120_000,
    verificationWindowHours: windowHours ?? 24,
    suspendTtlMs,
    fromEnv: anyTrustEnv,
    invalid: ttlInvalid,
  };
}

/** Mirrors packages/db defaultPoolMax — pure, no pool required. */
export function bindPgPoolMax(env: NodeJS.ProcessEnv): {
  value: number;
  fromEnv: boolean;
} {
  const fromEnv = Number(env.DIVAN_PG_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return { value: Math.trunc(fromEnv), fromEnv: true };
  }
  return {
    value: (env.NODE_ENV ?? "").toLowerCase() === "production" ? 10 : 5,
    fromEnv: false,
  };
}

/** Date-only or unset — never invent epoch. Invalid → invalid. */
export function bindBaselineBoundaryDate(env: NodeJS.ProcessEnv): {
  value: string;
  fromEnv: boolean;
  invalid: boolean;
} {
  const raw = trim(env.DIVAN_BASELINE_BOUNDARY_DATE);
  if (raw === "") {
    return { value: "unset", fromEnv: false, invalid: false };
  }
  // date-only YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { value: "unset", fromEnv: true, invalid: true };
  }
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return { value: "unset", fromEnv: true, invalid: true };
  }
  // Reject calendar-impossible days that Date rolls forward (e.g. 2024-02-31).
  if (d.toISOString().slice(0, 10) !== raw) {
    return { value: "unset", fromEnv: true, invalid: true };
  }
  return { value: raw, fromEnv: true, invalid: false };
}

/**
 * Registered category count posture — mirrors loadCategoryRegistry decision tree
 * without importing audit-envelope (avoid circular deps).
 */
export function bindEnvelopeCategoryCount(env: NodeJS.ProcessEnv): number {
  const path = trim(env.AUDIT_ENVELOPE_CATEGORY_PATH);
  if (path !== "") {
    try {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as { categories?: unknown };
      return Array.isArray(parsed.categories) ? parsed.categories.length : 0;
    } catch {
      return 0;
    }
  }
  if (trim(env.AUDIT_ENVELOPE_USE_DEV_FIXTURE).toLowerCase() === "false") {
    return 0;
  }
  const production = (env.NODE_ENV ?? "").toLowerCase() === "production";
  // PRODUCTION_SENSITIVE_CATEGORY_HOOKS.length === 7
  // DEV_DEMO_CATEGORIES.length === 25
  return production ? 7 : 25;
}

function directBind(
  envKey: string,
): EnvBinding["bind"] {
  return (def, env) => {
    const raw = env[envKey];
    if (raw == null || trim(String(raw)) === "") {
      return { ok: false, reason: "missing" };
    }
    const parsed = validateSettingsValue(def, raw);
    if (parsed == null) return { ok: false, reason: "invalid" };
    return { ok: true, value: parsed, fromEnv: true };
  };
}

/**
 * All env-bound / derived RO inventory keys.
 * Order does not matter; warm applies each independently.
 */
export const ENV_BINDINGS: readonly EnvBinding[] = Object.freeze([
  {
    key: "session.idle_timeout_seconds",
    envKey: "AUTH_SESSION_IDLE_TIMEOUT_SECONDS",
    kind: "direct",
    emitEnvironmentSource: true,
    bind: directBind("AUTH_SESSION_IDLE_TIMEOUT_SECONDS"),
  },
  {
    key: "session.absolute_timeout_seconds",
    envKey: "AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS",
    kind: "direct",
    emitEnvironmentSource: true,
    bind: directBind("AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS"),
  },
  {
    key: "identity.provider_mode",
    envKey: "IDENTITY_PROVIDER",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const raw = env.IDENTITY_PROVIDER;
      if (raw == null || trim(raw) === "") {
        return { ok: false, reason: "missing" };
      }
      const parsed = parseIdentityProviderMode(raw);
      if (parsed == null) return { ok: false, reason: "invalid" };
      return { ok: true, value: parsed, fromEnv: true };
    },
  },
  {
    key: "identity.ldap_configured",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const configured = isLdapConfigured(env);
      const anyLdapHint =
        trim(env.LDAP_URL) !== "" ||
        trim(env.LDAP_BIND_DN) !== "" ||
        trim(env.LDAP_BASE_DN) !== "";
      return {
        ok: true,
        value: configured,
        fromEnv: anyLdapHint || configured,
      };
    },
  },
  {
    key: "identity.ldap_url_scheme",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const scheme = parseLdapUrlScheme(env);
      return {
        ok: true,
        value: scheme,
        fromEnv: scheme !== "unset",
      };
    },
  },
  {
    key: "identity.ldap_tls_reject_unauthorized",
    envKey: "LDAP_TLS_REJECT_UNAUTHORIZED",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const raw = trim(env.LDAP_TLS_REJECT_UNAUTHORIZED);
      return {
        ok: true,
        value: parseLdapTlsRejectUnauthorized(env),
        fromEnv: raw !== "",
      };
    },
  },
  {
    key: "identity.ldap_connect_timeout_ms",
    envKey: "LDAP_CONNECT_TIMEOUT_MS",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (def, env) => {
      const raw = trim(env.LDAP_CONNECT_TIMEOUT_MS);
      if (raw === "") return { ok: false, reason: "missing" };
      const n = parsePositiveInt(raw);
      if (n == null) return { ok: false, reason: "invalid" };
      const parsed = validateSettingsValue(def, n);
      if (parsed == null) return { ok: false, reason: "invalid" };
      return { ok: true, value: parsed, fromEnv: true };
    },
  },
  {
    key: "identity.ldap_create_mapping_mode",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const mode = parseLdapCreateMappingMode(env);
      if (mode === "invalid") return { ok: false, reason: "invalid" };
      const raw = trim(env.LDAP_CREATE_MAPPING_JSON);
      return {
        ok: true,
        value: mode,
        fromEnv: raw !== "",
      };
    },
  },
  {
    key: "audit.inference_bulk_enabled",
    envKey: "AUDIT_INFERENCE_BULK_ENABLED",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const eff = bindInferenceBulkEffective(env);
      // Always apply effective posture; environment source only when flag set.
      return {
        ok: true,
        value: eff.enabled,
        fromEnv: eff.fromEnvFlag,
      };
    },
  },
  {
    key: "audit.inference_bulk_min_cohort",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const eff = bindInferenceBulkEffective(env);
      return {
        ok: true,
        value: eff.minCohort,
        fromEnv: eff.fromEnvFlag,
      };
    },
  },
  {
    key: "audit.inference_bulk_max_volume_per_request",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const eff = bindInferenceBulkEffective(env);
      return {
        ok: true,
        value: eff.maxVolumePerRequest,
        fromEnv: eff.fromEnvFlag,
      };
    },
  },
  {
    key: "audit.inference_bulk_max_volume_per_window",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const eff = bindInferenceBulkEffective(env);
      return {
        ok: true,
        value: eff.maxVolumePerWindow,
        fromEnv: eff.fromEnvFlag,
      };
    },
  },
  {
    key: "audit.trust_enforce",
    envKey: "DIVAN_AUDIT_TRUST_ENFORCE",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const eff = bindAuditTrustEffective(env);
      if (eff.invalid && eff.enforce) {
        // Runtime fail-closes when enforce+incomplete; do not show false.
        return {
          ok: false,
          reason: "invalid",
          inventoryValue: true,
        };
      }
      return {
        ok: true,
        value: eff.enforce,
        fromEnv: trim(env.DIVAN_AUDIT_TRUST_ENFORCE) !== "",
      };
    },
  },
  {
    key: "audit.trust_max_clock_skew_ms",
    envKey: "DIVAN_AUDIT_TRUST_MAX_CLOCK_SKEW_MS",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (def, env) => {
      const eff = bindAuditTrustEffective(env);
      if (eff.invalid && eff.enforce) {
        return { ok: false, reason: "invalid" };
      }
      const raw = trim(env.DIVAN_AUDIT_TRUST_MAX_CLOCK_SKEW_MS);
      if (raw === "") return { ok: false, reason: "missing" };
      const parsed = validateSettingsValue(def, eff.maxClockSkewMs);
      if (parsed == null) return { ok: false, reason: "invalid" };
      return { ok: true, value: parsed, fromEnv: true };
    },
  },
  {
    key: "audit.trust_verification_window_hours",
    envKey: "DIVAN_AUDIT_TRUST_VERIFICATION_WINDOW_HOURS",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (def, env) => {
      const eff = bindAuditTrustEffective(env);
      if (eff.invalid && eff.enforce) return { ok: false, reason: "invalid" };
      const raw = trim(env.DIVAN_AUDIT_TRUST_VERIFICATION_WINDOW_HOURS);
      if (raw === "") return { ok: false, reason: "missing" };
      const parsed = validateSettingsValue(def, eff.verificationWindowHours);
      if (parsed == null) return { ok: false, reason: "invalid" };
      return { ok: true, value: parsed, fromEnv: true };
    },
  },
  {
    key: "audit.trust_suspend_ttl_ms",
    envKey: "DIVAN_AUDIT_TRUST_SUSPEND_TTL_MS",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (def, env) => {
      const eff = bindAuditTrustEffective(env);
      if (eff.invalid) return { ok: false, reason: "invalid" };
      const raw = trim(env.DIVAN_AUDIT_TRUST_SUSPEND_TTL_MS);
      if (raw === "") return { ok: false, reason: "missing" };
      const parsed = validateSettingsValue(def, eff.suspendTtlMs);
      if (parsed == null) return { ok: false, reason: "invalid" };
      return { ok: true, value: parsed, fromEnv: true };
    },
  },
  {
    key: "audit.envelope_category_count",
    kind: "derived",
    emitEnvironmentSource: false,
    bind: (_def, env) => ({
      ok: true,
      value: bindEnvelopeCategoryCount(env),
      fromEnv: false,
    }),
  },
  {
    key: "infra.pg_pool_max",
    envKey: "DIVAN_PG_POOL_MAX",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (def, env) => {
      const { value, fromEnv } = bindPgPoolMax(env);
      const parsed = validateSettingsValue(def, value);
      if (parsed == null) return { ok: false, reason: "invalid" };
      // Always apply effective max (prod/dev default); environment only when env set.
      return { ok: true, value: parsed, fromEnv };
    },
  },
  {
    key: "infra.baseline_boundary_date",
    envKey: "DIVAN_BASELINE_BOUNDARY_DATE",
    kind: "derived",
    emitEnvironmentSource: true,
    bind: (_def, env) => {
      const b = bindBaselineBoundaryDate(env);
      if (b.invalid) return { ok: false, reason: "invalid" };
      if (!b.fromEnv) return { ok: false, reason: "missing" };
      return { ok: true, value: b.value, fromEnv: true };
    },
  },
]);

export function getEnvBinding(key: string): EnvBinding | undefined {
  return ENV_BINDINGS.find((b) => b.key === key);
}

export function listEnvBoundKeys(): readonly string[] {
  return ENV_BINDINGS.map((b) => b.key);
}
