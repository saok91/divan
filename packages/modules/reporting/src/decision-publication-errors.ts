/**
 * Domain errors for formal decision publications (Story 7.6 / FR-54).
 * Always expose messageFa to operators; never leak raw infra messages upward.
 */

export type DecisionPublicationErrorCode =
  | "PUBLICATION_DENIED"
  | "PUBLICATION_NOT_FOUND"
  | "PUBLICATION_STALE_BLOCKED"
  | "PUBLICATION_SNAPSHOT_MISMATCH"
  | "PUBLICATION_IMMUTABLE_REWRITE"
  | "PUBLICATION_REPRODUCIBILITY_FORBIDDEN"
  | "PUBLICATION_PACKAGE_NOT_ALLOWED"
  | "PUBLICATION_ALREADY_NON_REPRODUCIBLE"
  | "PUBLICATION_METADATA_INCOMPLETE";

export class DecisionPublicationError extends Error {
  readonly code: DecisionPublicationErrorCode;
  readonly messageFa: string;
  readonly details?: Record<string, string>;

  constructor(
    code: DecisionPublicationErrorCode,
    messageFa: string,
    details?: Record<string, string>,
  ) {
    super(code);
    this.name = "DecisionPublicationError";
    this.code = code;
    this.messageFa = messageFa;
    this.details = details;
  }
}

export const MSG_PUBLICATION_DENIED_FA =
  "مجوز انتشار گزارش تصمیم برای این محدوده را ندارید.";
export const MSG_PUBLICATION_NOT_FOUND_FA = "انتشار گزارش تصمیم یافت نشد.";
export const MSG_PUBLICATION_STALE_BLOCKED_FA =
  "تا به‌روز شدن داده، انتشار گزارش تصمیم مجاز نیست.";
export const MSG_PUBLICATION_SNAPSHOT_MISMATCH_FA =
  "هش اسنپ‌شات با نتیجهٔ بازبینی‌شده هم‌خوان نیست.";
export const MSG_PUBLICATION_IMMUTABLE_REWRITE_FA =
  "محتوای تصمیم منتشرشده قابل بازنویسی نیست؛ از اعلان جایگزینی استفاده کنید.";
export const MSG_PUBLICATION_REPRODUCIBILITY_FORBIDDEN_FA =
  "این انتشار پس از امحا قابل‌بازتولید ادعا نمی‌شود.";
export const MSG_PUBLICATION_PACKAGE_NOT_ALLOWED_FA =
  "نگهداری بستهٔ بازتولید برای این گزارش در سیاست موقت مجاز نیست.";
export const MSG_PUBLICATION_PACKAGE_RETAINED_FORCE_FA =
  "بستهٔ بازتولید نگهداری‌شده است؛ بدون force نمی‌توان غیرقابل‌بازتولید علامت زد.";
export const MSG_PUBLICATION_ALREADY_NON_REPRODUCIBLE_FA =
  "این انتشار قبلاً غیرقابل‌بازتولید پس از امحا علامت‌گذاری شده است.";
export const MSG_PUBLICATION_METADATA_INCOMPLETE_FA =
  "نسخهٔ گزارش/متریک موقت برای انتشار تنظیم نشده است.";
export const MSG_PUBLICATION_NOT_CURRENTLY_REPRODUCIBLE_FA =
  "این انتشار در حال حاضر قابل‌بازتولید نیست.";
