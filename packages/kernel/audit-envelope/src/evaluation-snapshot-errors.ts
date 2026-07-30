/**
 * Authoritative evaluation snapshot errors (Story 7.8 / FR-56).
 * Map at API via messageFa — never forward raw error.message to UI.
 *
 * Domain bridges keep existing codes where UX already maps them:
 * FINALIZE_STALE_SNAPSHOT, SNAPSHOT_MISMATCH, PUBLICATION_SNAPSHOT_MISMATCH,
 * CONCURRENT_BATCH, REVALIDATION_FAILED.
 */

export type EvaluationSnapshotErrorCode =
  | "EVAL_SNAPSHOT_DENIED"
  | "EVAL_SNAPSHOT_NOT_FOUND"
  | "EVAL_SNAPSHOT_MISMATCH"
  | "EVAL_SNAPSHOT_STALE"
  | "EVAL_SNAPSHOT_VERSION_MIX"
  | "EVAL_SNAPSHOT_REF_CHANGED"
  | "EVAL_SNAPSHOT_PERMISSION_CHANGED"
  | "EVAL_SNAPSHOT_EXPIRED";

export class EvaluationSnapshotError extends Error {
  readonly code: EvaluationSnapshotErrorCode;
  readonly messageFa: string;
  readonly details?: Record<string, string>;

  constructor(
    code: EvaluationSnapshotErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "EvaluationSnapshotError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}

export const MSG_EVAL_SNAPSHOT_DENIED_FA = "دسترسی ندارید.";
export const MSG_EVAL_SNAPSHOT_NOT_FOUND_FA =
  "اسنپ‌شات ارزیابی معتبر یافت نشد.";
export const MSG_EVAL_SNAPSHOT_MISMATCH_FA =
  "اسنپ‌شات ارزیابی با نسخهٔ بازبینی‌شده هم‌خوان نیست.";
export const MSG_EVAL_SNAPSHOT_STALE_FA =
  "اسنپ‌شات ارزیابی کهنه شده است؛ عملیات را از ابتدا تکرار کنید.";
export const MSG_EVAL_SNAPSHOT_VERSION_MIX_FA =
  "نسخه‌های ارزیابی مخلوط شده‌اند؛ فیلتر یا مرتب‌سازی را از صفحهٔ اول از سر بگیرید.";
export const MSG_EVAL_SNAPSHOT_REF_CHANGED_FA =
  "مراجع سازمانی یا نقش‌ها در حین عملیات تغییر کرده‌اند؛ عملیات مسدود شد.";
export const MSG_EVAL_SNAPSHOT_PERMISSION_CHANGED_FA =
  "اثرانگشت مجوز در حین عملیات تغییر کرده است؛ عملیات مسدود شد.";
export const MSG_EVAL_SNAPSHOT_EXPIRED_FA =
  "اسنپ‌شات ارزیابی منقضی شده است؛ از صفحهٔ اول دوباره شروع کنید.";
