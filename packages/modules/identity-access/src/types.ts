/** MVP coarse role machine codes — frozen for Stories 1.4 / 1.5. */
export const COARSE_ROLES = [
  "hr_operator",
  "hr_admin",
  "manager",
  "audit_reviewer",
  "system_admin",
] as const;

export type CoarseRole = (typeof COARSE_ROLES)[number];

export const COARSE_ROLE_LABELS_FA: Record<CoarseRole, string> = {
  hr_operator: "کارشناس منابع انسانی",
  hr_admin: "ادمین منابع انسانی",
  manager: "مدیر",
  audit_reviewer: "بازبین ممیزی",
  system_admin: "ادمین سیستم",
};

export type AccountStatus = "active" | "inactive";

export type SessionContext = {
  accountId: string;
  username: string;
  displayName: string;
  /**
   * Coarse role is navigation context only — not HR content entitlement.
   * Governed paths must revalidate this from DB (not JWT alone).
   */
  coarseRole: CoarseRole;
  humanIdentityId: string;
  /**
   * Coarse Organizational Scope hooks for AD-5 / audit-envelope.
   * Hydrated from AccountOrganizationalScope bindings (Story 2.3).
   * Never invent LDAP group→scope sync.
   */
  organizationalScopeIds: string[];
  /**
   * Stable scope codes matching policy tokens (Story 2.6).
   * Seed aligns `OrganizationalScope.code` with `org:selfcheck` etc.
   */
  organizationalScopeCodes: string[];
  /** Access role binding ids — part of mid-session authz fingerprint. */
  accessRoleIds: string[];
  /**
   * Fingerprint of role/scope/coarse bindings at session load.
   * Compared to JWT login-time snapshot for mid-session AUTHZ_CHANGED (FR-47).
   */
  authzBindingFingerprint: string;
  /**
   * Active break-glass summary for banner hydration (Story 2.5).
   * When active, `expiresAt` is always a finite future ISO timestamp.
   */
  breakGlass: {
    active: boolean;
    expiresAt: string | null;
    incidentId: string | null;
    grantId: string | null;
  };
};

/**
 * Coarse authz context published to the audit-envelope (AD-5).
 * Fine-grained category checks stay in `@divan/audit-envelope`.
 */
export type CoarseAuthzContext = {
  accountId: string;
  coarseRole: CoarseRole;
  organizationalScopeIds: string[];
  organizationalScopeCodes: string[];
};

export type AuthAttemptOutcome =
  | "success"
  | "failure_unknown"
  | "failure_wrong_password"
  | "failure_inactive"
  | "failure_provider_unavailable"
  | "failure_directory_blocked"
  | "failure_unmapped"
  | "failure_link_conflict";

export type AuthenticationErrorCode =
  | "INVALID_CREDENTIALS"
  | "INACTIVE_ACCOUNT"
  | "PROVIDER_UNAVAILABLE";

/**
 * Typed fail-closed auth error. Persian copy lives at API/UI boundary via messageFa.
 */
export class AuthenticationError extends Error {
  readonly code: AuthenticationErrorCode;
  readonly messageFa: string;
  readonly correlationId: string;

  constructor(
    code: AuthenticationErrorCode,
    messageFa: string,
    correlationId: string,
  ) {
    super(code);
    this.name = "AuthenticationError";
    this.code = code;
    this.messageFa = messageFa;
    this.correlationId = correlationId;
  }
}

/**
 * Mid-session binding change (Story 2.6 AC #4).
 * Mapped to «دسترسی شما تغییر کرد.» — not the generic access-denied copy.
 */
export class AuthzChangedError extends Error {
  readonly code = "AUTHZ_CHANGED" as const;
  readonly messageFa: string;

  constructor(messageFa = "دسترسی شما تغییر کرد.") {
    super("AUTHZ_CHANGED");
    this.name = "AuthzChangedError";
    this.messageFa = messageFa;
  }
}

export type IdentityProvider = "seeded" | "ldap";

export type SessionTimeoutConfig = {
  /** Idle timeout hook — seconds; env AUTH_SESSION_IDLE_TIMEOUT_SECONDS */
  idleTimeoutSeconds: number;
  /** Absolute timeout hook — seconds; env AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS */
  absoluteTimeoutSeconds: number;
};

/** Sensible local/dev defaults only — not production AR-IDENTITY numbers. */
export const DEV_DEFAULT_IDLE_TIMEOUT_SECONDS = 8 * 60 * 60; // 8h
export const DEV_DEFAULT_ABSOLUTE_TIMEOUT_SECONDS = 24 * 60 * 60; // 24h

/**
 * Stable fingerprint for mid-session authz change detection.
 * Sort ids so order-of-load does not false-positive.
 */
export function computeAuthzBindingFingerprint(input: {
  coarseRole: string;
  organizationalScopeIds: readonly string[];
  /** Scope codes — code rename without id change must still flag mid-session. */
  organizationalScopeCodes?: readonly string[];
  accessRoleIds: readonly string[];
}): string {
  const scopes = [...input.organizationalScopeIds].sort().join(",");
  const codes = [...(input.organizationalScopeCodes ?? [])].sort().join(",");
  const roles = [...input.accessRoleIds].sort().join(",");
  return `${input.coarseRole}|s:${scopes}|c:${codes}|r:${roles}`;
}
