/**
 * Data lifecycle / retention / legal hold domain helpers (Story 7.3 / FR-50).
 * Preferred home: audit-envelope (mirrors 7.1 investigation + 7.2 ops-health).
 * Orchestration + persistence live in person-employment; web stays thin.
 */

/** @provisional-pending-AR-ACCESS-freeze — list holds / runs / policy view */
export const DATA_LIFECYCLE_READ_PERMISSION = "data.lifecycle.read";

/** @provisional-pending-AR-ACCESS-freeze — place / release legal hold */
export const DATA_LIFECYCLE_HOLD_PERMISSION = "data.lifecycle.hold";

/** @provisional-pending-AR-ACCESS-freeze — run disposal / export dispose orchestration */
export const DATA_LIFECYCLE_DISPOSE_PERMISSION = "data.lifecycle.dispose";

/**
 * Ordinary lifecycle category — NOT person `health` (sensitive, disabled).
 * Provisional — AR-DATA / AR-ACCESS pending freeze.
 */
export const DATA_LIFECYCLE_DATA_CATEGORY = "data.lifecycle";

/**
 * Provisional lifecycle class codes for Data Element retention metadata.
 * @provisional-pending-AR-DATA-freeze — no invented durations; fail closed when incomplete.
 */
export const PROVISIONAL_LIFECYCLE_CLASS_CODES = [
  "retain",
  "anonymize_on_end",
  "delete_on_end",
  "restrict_on_end",
] as const;

export type ProvisionalLifecycleClassCode =
  (typeof PROVISIONAL_LIFECYCLE_CLASS_CODES)[number];

export type LegalHoldScopeKind =
  | "person"
  | "element_category"
  | "artifact"
  | "org_scope";

export type LegalHoldStatus = "active" | "released";

export type LegalHoldRecord = {
  id: string;
  scopeKind: LegalHoldScopeKind;
  scopeRef: string;
  reason: string;
  placedBy: string;
  placedAt: string;
  releasedBy?: string | null;
  releasedAt?: string | null;
  status: LegalHoldStatus;
  correlationId: string;
};

export type DisposalRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "partial"
  | "blocked";

export type DisposalRunRecord = {
  id: string;
  trigger: string;
  scopeKind: LegalHoldScopeKind | "mixed";
  scopeRef: string;
  actorAccountId: string;
  startedAt: string;
  completedAt?: string | null;
  status: DisposalRunStatus;
  correlationId: string;
  /** Honesty: restore catch-up must re-apply holds/disposals (NFR-6). */
  restoreCatchUpRequired: boolean;
};

export type PropagationOutcome =
  | "applied"
  | "skipped"
  | "failed"
  | "blocked_by_hold";

export type PropagationTargetResult = {
  target: string;
  targetKind: string;
  targetId?: string;
  outcome: PropagationOutcome;
  detailFa?: string;
  correlationId: string;
};

export type DataLifecycleErrorCode =
  | "LIFECYCLE_DENIED"
  | "LEGAL_HOLD_ACTIVE"
  | "DISPOSAL_BLOCKED_BY_HOLD"
  | "DISPOSAL_PROPAGATION_FAILED"
  | "LIFECYCLE_METADATA_INCOMPLETE"
  | "HOLD_NOT_FOUND"
  | "DISPOSAL_SCOPE_INCOMPLETE";

export class DataLifecycleError extends Error {
  readonly code: DataLifecycleErrorCode;
  readonly messageFa: string;
  readonly details?: Record<string, string>;

  constructor(
    code: DataLifecycleErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "DataLifecycleError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}

export const MSG_LIFECYCLE_DENIED_FA = "دسترسی ندارید.";
export const MSG_LEGAL_HOLD_ACTIVE_FA =
  "نگهداری قانونی فعال است؛ ابتدا نگهداری را آزاد کنید.";
export const MSG_DISPOSAL_BLOCKED_BY_HOLD_FA =
  "حذف به‌خاطر نگهداری قانونی مسدود شد. نگهداری را آزاد کنید یا با حقوقی تماس بگیرید.";
export const MSG_DISPOSAL_PROPAGATION_FAILED_FA =
  "انتشار حذف کامل نشد؛ نتیجهٔ هر هدف قابل تطبیق است.";
export const MSG_LIFECYCLE_METADATA_INCOMPLETE_FA =
  "کلاس چرخهٔ عمر داده ناقص یا ناشناخته است؛ اقدام پایان ممکن نیست.";
export const MSG_RESTORE_CATCHUP_REQUIRED_FA =
  "پس از بازیابی، نگهداری و حذف باید دوباره اعمال شوند — اثبات بازیابی اینجا نیست.";
export const MSG_HOLD_NOT_FOUND_FA =
  "نگهداری قانونی یافت نشد یا قبلاً آزاد شده است.";
export const MSG_DISPOSAL_SCOPE_INCOMPLETE_FA =
  "برای حذف در این محدوده، حداقل یک شناسهٔ فرد یا خروجی لازم است.";

/** Known seed blurb → provisional class (single map; do not invent durations). */
export const LEGACY_RETENTION_BLURB_TO_CLASS: Readonly<
  Record<string, ProvisionalLifecycleClassCode>
> = {
  "workforce-master-data retention (AR-DATA)": "retain",
};

/**
 * Parse retention metadata to a provisional lifecycle class.
 * Accepts exact class codes or known seed blurbs. Unknown → null (fail-closed).
 */
export function parseLifecycleClass(
  retention: string | null | undefined,
): ProvisionalLifecycleClassCode | null {
  if (typeof retention !== "string") return null;
  const trimmed = retention.trim();
  if (!trimmed) return null;
  if (
    (PROVISIONAL_LIFECYCLE_CLASS_CODES as readonly string[]).includes(trimmed)
  ) {
    return trimmed as ProvisionalLifecycleClassCode;
  }
  const mapped = LEGACY_RETENTION_BLURB_TO_CLASS[trimmed];
  return mapped ?? null;
}

export function isProvisionalLifecycleClass(
  value: string,
): value is ProvisionalLifecycleClassCode {
  return (PROVISIONAL_LIFECYCLE_CLASS_CODES as readonly string[]).includes(value);
}

/**
 * End-of-retention action for disposal. `retain` → skip (no erase).
 * Incomplete/unknown → throw LIFECYCLE_METADATA_INCOMPLETE.
 */
export function disposalActionForClass(
  retention: string | null | undefined,
): "skip" | "anonymize" | "delete" | "restrict" {
  const cls = parseLifecycleClass(retention);
  if (!cls) {
    throw new DataLifecycleError(
      "LIFECYCLE_METADATA_INCOMPLETE",
      MSG_LIFECYCLE_METADATA_INCOMPLETE_FA,
    );
  }
  switch (cls) {
    case "retain":
      return "skip";
    case "anonymize_on_end":
      return "anonymize";
    case "delete_on_end":
      return "delete";
    case "restrict_on_end":
      return "restrict";
  }
}
