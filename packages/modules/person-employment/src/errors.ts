/**
 * Person identity + Employment domain errors (Stories 3.1–3.2 / FR-5–FR-6).
 * Persian copy at API boundary — English `message` for logs only.
 */

export type PersonIdentityErrorCode =
  | "DUPLICATE_PERSONNEL_CODE"
  | "DUPLICATE_NATIONAL_ID"
  | "PERSON_NOT_FOUND"
  | "BLOCKED_IDENTITY_OPERATION"
  | "PERMISSION_DENIED"
  | "VALIDATION"
  | "SENTINEL_VALUE";

export class PersonIdentityError extends Error {
  readonly code: PersonIdentityErrorCode;
  readonly messageFa: string;

  constructor(
    code: PersonIdentityErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "PersonIdentityError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export type EmploymentErrorCode =
  | "OVERLAPPING_EMPLOYMENT"
  | "INVALID_EMPLOYMENT_INTERVAL"
  | "EMPLOYMENT_NOT_FOUND"
  | "CONCURRENT_EMPLOYMENT_FORBIDDEN"
  | "PERSON_NOT_FOUND"
  | "VALIDATION"
  | "SENTINEL_VALUE";

export class EmploymentError extends Error {
  readonly code: EmploymentErrorCode;
  readonly messageFa: string;

  constructor(
    code: EmploymentErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "EmploymentError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export const MSG_DUPLICATE_PERSONNEL_CODE_FA =
  "کد پرسنلی تکراری است. کد دیگری انتخاب کنید.";

export const MSG_DUPLICATE_NATIONAL_ID_FA =
  "کد ملی تکراری است. مقدار دیگری وارد کنید یا خالی بگذارید.";

export const MSG_PERSON_NOT_FOUND_FA = "پرسنل یافت نشد.";

/** Fail-closed until AR-DATA / AR-MIGRATION policy exists. */
export const MSG_BLOCKED_IDENTITY_OPERATION_FA =
  "این عملیات تا تعیین سیاست داده/مهاجرت مجاز نیست.";

export const MSG_SENTINEL_OPTIONAL_FA =
  "مقدار اختیاری نامعتبر است. فیلد خالی بگذارید؛ از ۰، N/A یا مشابه استفاده نکنید.";

export const MSG_REQUIRED_FIELD_FA = "مقدار الزامی است.";

export const MSG_OVERLAPPING_EMPLOYMENT_FA =
  "بازه همکاری با بازه موجود هم‌پوشانی دارد.";

export const MSG_INVALID_EMPLOYMENT_INTERVAL_FA =
  "بازه همکاری نامعتبر است. تاریخ پایان باید بعد از تاریخ شروع باشد.";

export const MSG_EMPLOYMENT_NOT_FOUND_FA = "سابقه همکاری یافت نشد.";

/** Fail-closed until AR-DATA defines concurrent multi-active Employment exceptions. */
export const MSG_CONCURRENT_EMPLOYMENT_FORBIDDEN_FA =
  "هم‌زمانی بیش از یک همکاری فعال برای یک فرد مجاز نیست.";

export const MSG_EMPLOYMENT_ALREADY_CLOSED_FA =
  "این سابقه همکاری قبلاً پایان یافته است.";

export const PERSON_READ_PERMISSION = "person.read";
export const PERSON_WRITE_PERMISSION = "person.write";
export const PERSON_DATA_CATEGORY = "identity.person";
export const NATIONAL_ID_DATA_CATEGORY = "identity.national_id";
