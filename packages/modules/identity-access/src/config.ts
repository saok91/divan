import type { IdentityProvider, SessionTimeoutConfig } from "./types";
import {
  COARSE_ROLES,
  DEV_DEFAULT_ABSOLUTE_TIMEOUT_SECONDS,
  DEV_DEFAULT_IDLE_TIMEOUT_SECONDS,
  type CoarseRole,
} from "./types";

/**
 * Active identity provider. Seeded is for local/dev/CI only.
 * Unknown values do NOT silently fall back to seeded (freeze: no silent seed path).
 * Returns null when IDENTITY_PROVIDER is set to an unsupported value.
 */
export function getIdentityProvider(
  env: NodeJS.ProcessEnv = process.env,
): IdentityProvider | null {
  const raw = (env.IDENTITY_PROVIDER ?? "seeded").trim().toLowerCase();
  if (raw === "ldap") return "ldap";
  if (raw === "seeded") return "seeded";
  return null;
}

/**
 * Session idle/absolute timeout hooks (NFR7 substrate).
 * Reads env; falls back to documented dev defaults — do not claim AR-IDENTITY compliance.
 */
export function getSessionTimeoutConfig(
  env: NodeJS.ProcessEnv = process.env,
): SessionTimeoutConfig {
  return {
    idleTimeoutSeconds: parsePositiveInt(
      env.AUTH_SESSION_IDLE_TIMEOUT_SECONDS,
      DEV_DEFAULT_IDLE_TIMEOUT_SECONDS,
    ),
    absoluteTimeoutSeconds: parsePositiveInt(
      env.AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS,
      DEV_DEFAULT_ABSOLUTE_TIMEOUT_SECONDS,
    ),
  };
}

/**
 * LDAP connection settings — values come only from Infra/AR-IDENTITY sign-off.
 * Do not hardcode org topology. Missing/invalid required keys → treat as unavailable.
 */
export type LdapConfig = {
  url: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  /** Filter template; must include `{{username}}` placeholder. */
  userFilter: string;
  /** Immutable directory id attribute (Infra-approved). */
  idAttribute: string;
  /** Login name attribute used in search/filter context. */
  loginAttribute: string;
  displayNameAttribute: string;
  /** Optional account-state attributes (Infra fills). Empty = not checked. */
  disabledAttr: string | null;
  disabledValues: readonly string[];
  lockedAttr: string | null;
  lockedValues: readonly string[];
  expiredAttr: string | null;
  expiredValues: readonly string[];
  /** TLS: CA PEM path or inline PEM; rejectUnauthorized default true. */
  tlsCa: string | null;
  tlsRejectUnauthorized: boolean;
  connectTimeoutMs: number;
  /**
   * Explicit create-on-first-login map: directory id or username → CoarseRole.
   * Empty map = create forbidden (pre-provision / first-link only).
   */
  createMapping: ReadonlyMap<string, CoarseRole>;
};

/**
 * Parse LDAP env. Returns null when required config is missing/invalid
 * (caller must treat as PROVIDER_UNAVAILABLE — never fall back to seeded).
 */
export function getLdapConfig(
  env: NodeJS.ProcessEnv = process.env,
): LdapConfig | null {
  const url = trimOrEmpty(env.LDAP_URL);
  const bindDn = trimOrEmpty(env.LDAP_BIND_DN);
  const bindPassword = env.LDAP_BIND_PASSWORD ?? "";
  const baseDn = trimOrEmpty(env.LDAP_BASE_DN);
  const userFilter = trimOrEmpty(env.LDAP_USER_FILTER);
  const idAttribute = trimOrEmpty(env.LDAP_ID_ATTRIBUTE);
  const loginAttribute =
    trimOrEmpty(env.LDAP_LOGIN_ATTRIBUTE) || "uid";
  const displayNameAttribute =
    trimOrEmpty(env.LDAP_DISPLAY_NAME_ATTRIBUTE) || "cn";

  if (!url || !bindDn || bindPassword === "" || !baseDn || !userFilter || !idAttribute) {
    return null;
  }
  if (!userFilter.includes("{{username}}")) {
    return null;
  }
  if (!url.startsWith("ldap://") && !url.startsWith("ldaps://")) {
    return null;
  }

  const createMapping = parseCreateMapping(env.LDAP_CREATE_MAPPING_JSON);
  if (createMapping === null) {
    return null;
  }

  const rejectRaw = trimOrEmpty(env.LDAP_TLS_REJECT_UNAUTHORIZED).toLowerCase();
  // Default true. Lab-only exception requires Infra-documented LDAP_TLS_REJECT_UNAUTHORIZED=false.
  const tlsRejectUnauthorized = rejectRaw !== "false";

  return {
    url,
    bindDn,
    bindPassword,
    baseDn,
    userFilter,
    idAttribute,
    loginAttribute,
    displayNameAttribute,
    disabledAttr: emptyToNull(env.LDAP_ACCOUNT_DISABLED_ATTR),
    disabledValues: splitCsv(env.LDAP_ACCOUNT_DISABLED_VALUES),
    lockedAttr: emptyToNull(env.LDAP_ACCOUNT_LOCKED_ATTR),
    lockedValues: splitCsv(env.LDAP_ACCOUNT_LOCKED_VALUES),
    expiredAttr: emptyToNull(env.LDAP_ACCOUNT_EXPIRED_ATTR),
    expiredValues: splitCsv(env.LDAP_ACCOUNT_EXPIRED_VALUES),
    tlsCa: emptyToNull(env.LDAP_TLS_CA),
    tlsRejectUnauthorized,
    connectTimeoutMs: parsePositiveInt(env.LDAP_CONNECT_TIMEOUT_MS, 10_000),
    createMapping,
  };
}

function parseCreateMapping(
  raw: string | undefined,
): Map<string, CoarseRole> | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") {
    return new Map();
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const map = new Map<string, CoarseRole>();
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "string") return null;
      if (!(COARSE_ROLES as readonly string[]).includes(value)) return null;
      const k = key.trim();
      if (!k) return null;
      map.set(k, value as CoarseRole);
    }
    return map;
  } catch {
    return null;
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function trimOrEmpty(raw: string | undefined): string {
  return (raw ?? "").trim();
}

function emptyToNull(raw: string | undefined): string | null {
  const t = trimOrEmpty(raw);
  return t === "" ? null : t;
}

function splitCsv(raw: string | undefined): readonly string[] {
  const t = trimOrEmpty(raw);
  if (t === "") return [];
  return t.split(",").map((s) => s.trim()).filter(Boolean);
}
