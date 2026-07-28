/**
 * Audit trust fail-safe domain (Story 7.4 / FR-51 / NFR-9).
 * Preferred home: audit-envelope (mirrors 7.1–7.3).
 * Persistence in audit-trust-repo.ts; web stays thin.
 *
 * Hash-chain production program remains Architecture Deferred — MVP = trigger +
 * verification runs + suspend gate. Do not claim NFR-10 / LG-2 complete.
 */

/** @provisional-pending-AR-ACCESS-freeze — view trust state / incidents / runs */
export const AUDIT_TRUST_READ_PERMISSION = "audit.trust.read";

/** @provisional-pending-AR-ACCESS-freeze — assign / ack / close / clear suspend */
export const AUDIT_TRUST_REVIEW_PERMISSION = "audit.trust.review";

/**
 * Ordinary trust category — NOT person `health`; not ops.platform / data.lifecycle / audit.evidence.
 * @provisional-pending-AR-ACCESS-freeze / @provisional-pending-AR-AUDIT-freeze
 */
export const AUDIT_TRUST_DATA_CATEGORY = "audit.trust";

/** Singleton env key for writer_state row. */
export const AUDIT_TRUST_DEFAULT_ENV_KEY = "default";

export type AuditTrustWriterStatus = "ok" | "degraded" | "suspended";

export type AuditTrustIncidentKind =
  | "append_fail"
  | "clock_anomaly"
  | "integrity_fail"
  | "capture_gap"
  | "interrupted";

export type AuditTrustIncidentStatus =
  | "open"
  | "assigned"
  | "acknowledged"
  | "closed";

export type IntegrityVerificationOutcome = "pass" | "fail";

export type AuditTrustState = {
  status: AuditTrustWriterStatus;
  reason?: string | null;
  suspendedAt?: string | null;
  suspendedBy?: string | null;
  clearRequiresReview: boolean;
  correlationId?: string | null;
  openIncidentCount?: number;
  lastVerificationOutcome?: IntegrityVerificationOutcome | null;
  lastVerificationAt?: string | null;
  /**
   * Alert-only TTL hint when suspended + suspendTtlMs configured.
   * Never auto-clears writers — review/clear remains required when policy says so.
   * @provisional-pending-AR-AUDIT-freeze
   */
  suspendExpiresAt?: string | null;
  /** True when suspendedAt + TTL has elapsed (still requires explicit clear). */
  suspendTtlElapsed?: boolean;
};

export type AuditTrustIncident = {
  id: string;
  kind: AuditTrustIncidentKind;
  status: AuditTrustIncidentStatus;
  assignedTo?: string | null;
  detectedAt: string;
  closedAt?: string | null;
  closedBy?: string | null;
  /** Minimized detail — no HR values / raw infra dumps */
  detail: Record<string, string | number | boolean | null>;
  correlationId: string;
  subjectAccountId?: string | null;
};

export type IntegrityVerificationRun = {
  id: string;
  startedAt: string;
  completedAt?: string | null;
  outcome: IntegrityVerificationOutcome;
  windowLabel: string;
  findings: Record<string, string | number | boolean | null>;
  actorAccountId: string;
  correlationId: string;
};

export type ClockAnomalyObservation = {
  appNowIso: string;
  dbNowIso: string;
  deltaMs: number;
  maxSkewMs: number;
  nonMonotonic?: boolean;
  correlationId: string;
};

/** FR-51 baseline inventory row — coverage assertion, not a parallel store. */
export type BaselineCoverageRow = {
  family:
    | "highly_sensitive"
    | "reveal_unmask"
    | "bulk_retrieval"
    | "historical_access"
    | "audit_access"
    | "privileged_reads"
    | "entitlement_changes"
    | "break_glass";
  covered: boolean;
  hookLabel: string;
  assertsActor: boolean;
  assertsPurpose: boolean;
  assertsScope: boolean;
  assertsVolume: boolean;
  assertsOutcome: boolean;
  omitsUnnecessaryValues: boolean;
  /** Successful and denied paths covered where the family has a deny outcome. */
  assertsDeniedWhereApplicable: boolean;
};

export type AuditTrustErrorCode =
  | "AUDIT_TRUST_SUSPENDED"
  | "AUDIT_CLOCK_ANOMALY"
  | "AUDIT_INTEGRITY_FAILED"
  | "AUDIT_TRUST_DENIED"
  | "AUDIT_TRUST_SELF_REVIEW_BLOCKED"
  | "AUDIT_TRUST_METADATA_INCOMPLETE"
  | "AUDIT_TRUST_CONFIG_MISSING"
  | "AUDIT_TRUST_INCIDENT_NOT_FOUND";

export class AuditTrustError extends Error {
  readonly code: AuditTrustErrorCode;
  readonly messageFa: string;
  readonly details?: Record<string, string>;

  constructor(
    code: AuditTrustErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "AuditTrustError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}

/** Distinct from ordinary access-denied — required-audit / trust fail-safe. */
export const MSG_AUDIT_TRUST_SUSPENDED_FA =
  "ثبت ممیزی متوقف شده است؛ عملیات حساس فعلاً ممکن نیست. با امنیت تماس بگیرید.";

export const MSG_AUDIT_CLOCK_ANOMALY_FA =
  "ناهنجاری ساعت سامانه شناسایی شد؛ عملیات حساس مسدود شد تا بررسی اعتماد انجام شود.";

export const MSG_AUDIT_INTEGRITY_FAILED_FA =
  "راستی‌آزمایی تمامیت ممیزی ناموفق بود؛ عملیات حساس مسدود شد.";

export const MSG_AUDIT_TRUST_DENIED_FA = "دسترسی ندارید.";

export const MSG_AUDIT_TRUST_SELF_REVIEW_BLOCKED_FA =
  "بازبینی خودی برای این رخداد اعتماد مجاز نیست.";

export const MSG_AUDIT_TRUST_METADATA_INCOMPLETE_FA =
  "پیکربندی اعتماد ممیزی ناقص است؛ اقدام ممکن نیست.";

export const MSG_AUDIT_TRUST_CONFIG_MISSING_FA =
  "آستانه‌های اعتماد ممیزی پیکربندی نشده‌اند؛ سامانه به‌صورت امن مسدود است.";

export const MSG_AUDIT_TRUST_INCIDENT_NOT_FOUND_FA =
  "رخداد اعتماد یافت نشد یا قبلاً بسته شده است.";

export const MSG_AUDIT_TRUST_CLEAR_BLOCKED_FA =
  "رفع تعلیق ممکن نیست تا رخدادهای اعتماد باز بسته شوند و بازبینی انجام شود.";

/**
 * @provisional-pending-AR-AUDIT-freeze — thresholds only; not signed NTP SLA.
 */
export type AuditTrustProvisionalConfig = {
  /** Max |app Date − DB now| before clock anomaly (ms). */
  maxClockSkewMs: number;
  /**
   * Optional auto-expire hint for UI; clear still requires review when
   * clearRequiresReview is true. null = no auto-clear.
   */
  suspendTtlMs: number | null;
  /** Integrity verification lookback window (hours). */
  verificationWindowHours: number;
  /** When true, missing knobs → fail-closed (AUDIT_TRUST_CONFIG_MISSING). */
  enforceConfigured: boolean;
};

const DEFAULT_MAX_CLOCK_SKEW_MS = 120_000;
const DEFAULT_VERIFICATION_WINDOW_HOURS = 24;

function parsePositiveInt(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Load provisional trust thresholds.
 * @provisional-pending-AR-AUDIT-freeze
 *
 * DIVAN_AUDIT_TRUST_ENFORCE=1 → require explicit knobs (fail-closed if missing).
 * Otherwise use documented provisional defaults (MVP single-process AD-1).
 */
export function loadAuditTrustProvisionalConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuditTrustProvisionalConfig {
  const enforceConfigured =
    env.DIVAN_AUDIT_TRUST_ENFORCE === "1" ||
    env.DIVAN_AUDIT_TRUST_ENFORCE === "true";

  const skew = parsePositiveInt(env.DIVAN_AUDIT_TRUST_MAX_CLOCK_SKEW_MS);
  const windowHours = parsePositiveInt(
    env.DIVAN_AUDIT_TRUST_VERIFICATION_WINDOW_HOURS,
  );
  const ttlRaw = env.DIVAN_AUDIT_TRUST_SUSPEND_TTL_MS?.trim();
  let suspendTtlMs: number | null = null;
  if (ttlRaw === "0" || ttlRaw === "none") {
    suspendTtlMs = null;
  } else {
    const ttl = parsePositiveInt(ttlRaw);
    suspendTtlMs = ttl;
  }

  if (enforceConfigured) {
    if (skew == null || windowHours == null) {
      throw new AuditTrustError(
        "AUDIT_TRUST_CONFIG_MISSING",
        MSG_AUDIT_TRUST_CONFIG_MISSING_FA,
        { reason: "missing_provisional_knobs" },
      );
    }
    return {
      maxClockSkewMs: skew,
      suspendTtlMs,
      verificationWindowHours: windowHours,
      enforceConfigured: true,
    };
  }

  return {
    maxClockSkewMs: skew ?? DEFAULT_MAX_CLOCK_SKEW_MS,
    suspendTtlMs: suspendTtlMs ?? null,
    verificationWindowHours: windowHours ?? DEFAULT_VERIFICATION_WINDOW_HOURS,
    enforceConfigured: false,
  };
}

/**
 * Compare app wall clock vs DB now — anomaly when |delta| exceeds provisional max.
 * Does not invent org NTP SLA numbers.
 */
export function observeClockSkew(input: {
  appNow: Date;
  dbNow: Date;
  maxSkewMs: number;
  correlationId: string;
}): ClockAnomalyObservation & { anomalous: boolean } {
  const deltaMs = input.appNow.getTime() - input.dbNow.getTime();
  return {
    appNowIso: input.appNow.toISOString(),
    dbNowIso: input.dbNow.toISOString(),
    deltaMs,
    maxSkewMs: input.maxSkewMs,
    correlationId: input.correlationId,
    anomalous: Math.abs(deltaMs) > input.maxSkewMs,
  };
}

/**
 * Non-monotonic occurred_at jump beyond provisional tolerance.
 * `previous` must be chronologically earlier than `next` (ASC pair).
 * Invalid timestamps are treated as anomalous (fail-closed heuristic).
 */
export function isNonMonotonicOccurredAt(input: {
  previousOccurredAt: Date;
  nextOccurredAt: Date;
  toleranceMs: number;
}): boolean {
  const t0 = input.previousOccurredAt.getTime();
  const t1 = input.nextOccurredAt.getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return true;
  return t1 + input.toleranceMs < t0;
}

/**
 * Clear suspend only after open trust incidents are closed (review path).
 * Does not auto-clear on TTL — TTL is alert-only.
 */
export function assertClearWriterSuspendAllowed(state: AuditTrustState): void {
  if (state.status !== "suspended") return;
  if ((state.openIncidentCount ?? 0) > 0) {
    throw new AuditTrustError(
      "AUDIT_TRUST_METADATA_INCOMPLETE",
      MSG_AUDIT_TRUST_CLEAR_BLOCKED_FA,
      { reason: "open_incidents" },
    );
  }
}

/**
 * Toxic self-review for trust incident assign/close (reuse 7.1 spirit).
 * Reviewer must not equal subject of the incident for sensitive kinds.
 */
export function assertAuditTrustSelfReviewAllowed(input: {
  reviewerAccountId: string;
  subjectAccountId?: string | null;
  incidentKind: AuditTrustIncidentKind;
}): void {
  const reviewer = input.reviewerAccountId.trim();
  if (!reviewer) {
    throw new AuditTrustError(
      "AUDIT_TRUST_SELF_REVIEW_BLOCKED",
      MSG_AUDIT_TRUST_SELF_REVIEW_BLOCKED_FA,
      { reason: "missing_reviewer" },
    );
  }

  const subject = input.subjectAccountId?.trim();
  if (!subject) return;

  const sensitiveKinds: AuditTrustIncidentKind[] = [
    "append_fail",
    "clock_anomaly",
    "integrity_fail",
    "capture_gap",
    "interrupted",
  ];
  if (
    sensitiveKinds.includes(input.incidentKind) &&
    reviewer === subject
  ) {
    throw new AuditTrustError(
      "AUDIT_TRUST_SELF_REVIEW_BLOCKED",
      MSG_AUDIT_TRUST_SELF_REVIEW_BLOCKED_FA,
      { reason: "self_review" },
    );
  }
}

/** Eight FR-51 baseline families — inventory harness asserts coverage hooks. */
export const FR51_BASELINE_FAMILIES: readonly BaselineCoverageRow["family"][] =
  [
    "highly_sensitive",
    "reveal_unmask",
    "bulk_retrieval",
    "historical_access",
    "audit_access",
    "privileged_reads",
    "entitlement_changes",
    "break_glass",
  ] as const;

/**
 * Keys forbidden in trust / ops trust summary DTOs (reuse ops redaction spirit).
 */
export const AUDIT_TRUST_FORBIDDEN_DTO_KEYS = [
  "personId",
  "person_id",
  "personnelCode",
  "personnel_code",
  "bindPassword",
  "bind_password",
  "password",
  "nationalId",
  "national_id",
] as const;

export function auditTrustDtoContainsForbiddenKeys(value: unknown): boolean {
  const json = JSON.stringify(value);
  return AUDIT_TRUST_FORBIDDEN_DTO_KEYS.some((key) =>
    new RegExp(`"${key}"\\s*:`, "i").test(json),
  );
}

/** Codes that must map distinctly from ordinary FORBIDDEN at API boundary. */
export const AUDIT_TRUST_API_DISTINCT_CODES: ReadonlySet<string> = new Set([
  "AUDIT_APPEND_FAILED",
  "AUDIT_TRUST_SUSPENDED",
  "AUDIT_CLOCK_ANOMALY",
  "AUDIT_INTEGRITY_FAILED",
  "AUDIT_TRUST_CONFIG_MISSING",
]);

export function isAuditTrustApiDistinctCode(code: string): boolean {
  return AUDIT_TRUST_API_DISTINCT_CODES.has(code);
}
