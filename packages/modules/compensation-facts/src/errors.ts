/**
 * Compensation / contractual facts domain errors (Story 3.4 / FR-8).
 * Persian copy at API boundary — clients match stable `code`, not substrings.
 */

export type CompensationErrorCode =
  | "OVERLAPPING_COMPENSATION"
  | "INVALID_COMPENSATION_INTERVAL"
  | "COMPENSATION_NOT_FOUND"
  | "CONCURRENT_COMPENSATION_FORBIDDEN"
  | "PERSON_NOT_FOUND"
  | "EMPLOYMENT_NOT_FOUND"
  | "FIELD_NOT_ENABLED"
  | "VALIDATION"
  | "SENTINEL_VALUE"
  | "INVALID_FACT_KIND"
  | "FREE_TEXT_PURPOSE_REQUIRED";

export class CompensationError extends Error {
  readonly code: CompensationErrorCode;
  readonly messageFa: string;

  constructor(
    code: CompensationErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "CompensationError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export const MSG_OVERLAPPING_COMPENSATION_FA =
  "بازه جبران‌خدمت / قرارداد با بازه موجود هم‌پوشانی دارد.";

export const MSG_INVALID_COMPENSATION_INTERVAL_FA =
  "بازه جبران‌خدمت / قرارداد نامعتبر است. تاریخ پایان باید بعد از تاریخ شروع باشد.";

export const MSG_COMPENSATION_NOT_FOUND_FA =
  "سابقه جبران‌خدمت / قرارداد یافت نشد.";

/** Fail-closed until AR-DATA defines concurrent multi-active exceptions. */
export const MSG_CONCURRENT_COMPENSATION_FORBIDDEN_FA =
  "هم‌زمانی بیش از یک بازه فعال برای همین نوع حقیقت مجاز نیست.";

export const MSG_PERSON_NOT_FOUND_FA = "پرسنل یافت نشد.";

export const MSG_EMPLOYMENT_NOT_FOUND_FA = "سابقه همکاری یافت نشد.";

export const MSG_COMPENSATION_ALREADY_CLOSED_FA =
  "این سابقه جبران‌خدمت / قرارداد قبلاً پایان یافته است.";

export const MSG_FIELD_NOT_ENABLED_FA =
  "این فیلد در فرهنگ‌داده فعال نیست و قابل ثبت یا نمایش نیست.";

export const MSG_SENTINEL_OPTIONAL_FA =
  "مقدار اختیاری نامعتبر است. فیلد خالی بگذارید؛ از ۰، N/A یا مشابه استفاده نکنید.";

export const MSG_INVALID_FACT_KIND_FA =
  "نوع حقیقت جبران‌خدمت / قرارداد نامعتبر است.";

export const MSG_FREE_TEXT_PURPOSE_REQUIRED_FA =
  "متن آزاد بدون purpose و کنترل دسترسی مجاز نیست.";

export const COMPENSATION_READ_PERMISSION = "compensation.read";
