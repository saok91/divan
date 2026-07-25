/**
 * Domain errors for governed export artifacts (Story 6.5 / FR-41 / FR-52).
 * Always expose messageFa to operators; never leak raw infra messages upward.
 */

export type ExportErrorCode =
  | "EXPORT_DENIED"
  | "REAUTH_FAILED"
  | "ARTIFACT_EXPIRED"
  | "ARTIFACT_REVOKED"
  | "ARTIFACT_DISPOSED"
  | "ARTIFACT_NOT_FOUND"
  | "CUSTODY_ACK_REQUIRED"
  | "SENSITIVE_EXPORT_DENIED"
  | "SNAPSHOT_MISMATCH"
  | "FORMAT_UNSUPPORTED"
  | "CONTENT_MISSING";

export class ExportError extends Error {
  readonly code: ExportErrorCode;
  readonly messageFa: string;
  readonly details?: Record<string, string>;

  constructor(
    code: ExportErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "ExportError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}

export const MSG_EXPORT_DENIED_FA = "مجوز خروجی برای این محدوده را ندارید.";
export const MSG_REAUTH_FAILED_FA =
  "مجوز خروجی منقضی یا تغییر کرده است. دوباره وارد شوید یا دسترسی را بررسی کنید.";
export const MSG_ARTIFACT_EXPIRED_FA = "این خروجی منقضی شده و قابل دریافت نیست.";
export const MSG_ARTIFACT_REVOKED_FA = "این خروجی لغو شده و قابل دریافت نیست.";
export const MSG_ARTIFACT_DISPOSED_FA = "این خروجی امحا شده و قابل دریافت نیست.";
export const MSG_ARTIFACT_NOT_FOUND_FA = "خروجی یافت نشد.";
export const MSG_CUSTODY_ACK_REQUIRED_FA =
  "برای دریافت این خروجی باید پذیرش نگهداری را تأیید کنید.";
export const MSG_SENSITIVE_EXPORT_DENIED_FA =
  "خروجی فیلد حساس بدون مجوز جداگانهٔ خروجی مجاز نیست.";
export const MSG_SNAPSHOT_MISMATCH_FA =
  "فیلتر یا محدودهٔ خروجی با نتیجهٔ بازبینی‌شده هم‌خوان نیست.";
export const MSG_FORMAT_UNSUPPORTED_FA = "قالب خروجی پشتیبانی نمی‌شود.";
export const MSG_CONTENT_MISSING_FA = "محتوای خروجی آماده نیست.";
