/**
 * Operations health domain helpers (Story 7.2 / FR-45 / UJ-5).
 * Preferred home: audit-envelope (mirrors 7.1 investigation constants).
 * Probes live in identity-access / person-employment / migration / db;
 * web stays thin via governedProcedure.
 */

/** @provisional-pending-AR-ACCESS-freeze — ops health dashboard retrieve */
export const OPS_HEALTH_READ_PERMISSION = "ops.health.read";

/**
 * Ordinary ops platform category — NOT person `health` (sensitive, disabled).
 * Provisional — AR-DATA / AR-ACCESS / AR-NFR pending freeze.
 */
export const OPS_PLATFORM_DATA_CATEGORY = "ops.platform";

export type OpsHealthSectionStatus =
  | "ok"
  | "degraded"
  | "red"
  | "unavailable"
  | "not_configured"
  | "evidence_recorded";

export type OpsHealthSection = {
  status: OpsHealthSectionStatus;
  detailFa?: string;
  correlationId?: string;
  updatedAt?: string;
  /** Aggregate counts only — never person identifiers */
  pendingCount?: number;
  failedCount?: number;
  staleCount?: number;
};

/**
 * Full ops health snapshot — zero person identifiers / personnel codes / names.
 */
export type OpsHealthSnapshot = {
  identity: OpsHealthSection;
  service: OpsHealthSection;
  recalculation: OpsHealthSection;
  import: OpsHealthSection;
  backup: OpsHealthSection;
  dependencies: OpsHealthSection;
  /** Story 7.4 — audit trust summary (no HR rows) */
  auditTrust?: OpsHealthSection;
  /** Story 10.1 — governed settings / configuration degraded (FR45; HR-free) */
  configuration?: OpsHealthSection;
  /** Optional honesty banners (Epic 6 retro) */
  honestyFa?: string[];
  correlationId: string;
};

export type OpsHealthErrorCode =
  | "OPS_HEALTH_DENIED"
  | "OPS_HEALTH_PROBE_FAILED";

export class OpsHealthError extends Error {
  readonly code: OpsHealthErrorCode;
  readonly messageFa: string;
  readonly details?: Record<string, string>;

  constructor(
    code: OpsHealthErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "OpsHealthError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}

export const MSG_OPS_HEALTH_DENIED_FA = "دسترسی ندارید.";
export const MSG_OPS_HEALTH_PROBE_FAILED_FA =
  "بررسی سلامت عملیاتی ممکن نشد. دوباره تلاش کنید.";

/**
 * Migration / cutover honesty for ops surface (Epic 6 retro → 7.2).
 * Never greenwash cutover from aggregates alone.
 */
export const OPS_MIGRATION_HONESTY_FA = {
  eventsOnlyZeroTrace:
    "صفر بودن رد تولید فقط در لایهٔ رویدادهاست — اثبات تمامیت cutover نیست.",
  baselineProjectorUnavailable:
    "حوزه‌های اشتغال/انتصاب ممکن است unavailable باشند؛ از خلاصهٔ ورود عدد قطعی اختراع نکنید.",
  ad6PersonOrphans:
    "ممکن است Person یتیم بماند در حالی که رویدادهای پایه برگشته‌اند (AD-6).",
  notCutoverProof:
    "خلاصهٔ ورود و بازمحاسبه اثبات cutover تمیز نیست — فقط شمارش وضعیت است.",
  backupEvidenceHook:
    "پذیرش بازیابی متعلق به Ops/AR-NFR است؛ این فقط قلاب شواهد است.",
  ldapSeededMode:
    "حالت seeded-dev: اتصال LDAP پیکربندی نشده — سبز جعلی نمایش داده نمی‌شود.",
} as const;

/**
 * Keys forbidden in ops health DTO serialization (redaction selfcheck).
 */
export const OPS_HEALTH_FORBIDDEN_DTO_KEYS = [
  "personId",
  "person_id",
  "personnelCode",
  "personnel_code",
  "bindPassword",
  "bind_password",
  "password",
] as const;

/**
 * True when a JSON-serialized value contains forbidden HR/secret key names
 * or person-bearing recalc job key values (`recalc:<uuid>:…`).
 */
export function opsHealthDtoContainsForbiddenKeys(value: unknown): boolean {
  const json = JSON.stringify(value);
  if (
    OPS_HEALTH_FORBIDDEN_DTO_KEYS.some((key) =>
      new RegExp(`"${key}"\\s*:`, "i").test(json),
    )
  ) {
    return true;
  }
  // job_key shape embeds personId: recalc:<uuid>:gN
  return /recalc:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:/i.test(
    json,
  );
}

export type BackupEvidenceHookStatus =
  | "not_configured"
  | "evidence_recorded"
  | "unavailable";

export type BackupEvidenceHook = {
  status: BackupEvidenceHookStatus;
  lastEvidenceAt?: string;
  detailFa: string;
};

/**
 * Read backup evidence from env hook.
 * DIVAN_BACKUP_EVIDENCE_AT = ISO timestamp when last evidence was recorded.
 * Absent → not_configured (acceptable honesty). Never invents RPO/RTO.
 */
export function getBackupEvidenceHook(
  env: NodeJS.ProcessEnv = process.env,
): BackupEvidenceHook {
  const raw = env.DIVAN_BACKUP_EVIDENCE_AT?.trim();
  if (!raw) {
    return {
      status: "not_configured",
      detailFa: OPS_MIGRATION_HONESTY_FA.backupEvidenceHook,
    };
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return {
      status: "unavailable",
      detailFa: OPS_MIGRATION_HONESTY_FA.backupEvidenceHook,
    };
  }
  return {
    status: "evidence_recorded",
    lastEvidenceAt: new Date(parsed).toISOString(),
    detailFa: OPS_MIGRATION_HONESTY_FA.backupEvidenceHook,
  };
}
