/**
 * Person identity + Employment + Data Dictionary domain errors (Stories 3.1–3.3).
 * Persian copy at API boundary — English `message` for logs only.
 */

export type PersonIdentityErrorCode =
  | "DUPLICATE_PERSONNEL_CODE"
  | "DUPLICATE_NATIONAL_ID"
  | "PERSON_NOT_FOUND"
  | "BLOCKED_IDENTITY_OPERATION"
  | "PERMISSION_DENIED"
  | "VALIDATION"
  | "SENTINEL_VALUE"
  | "FIELD_NOT_ENABLED"
  | "MOBILE_PHONE_FORMAT";

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

export type DataDictionaryErrorCode =
  | "ELEMENT_NOT_FOUND"
  | "ENABLE_REJECTED"
  | "REJECT_DISPOSITION"
  | "METADATA_INCOMPLETE"
  | "FREE_TEXT_PURPOSE_REQUIRED"
  | "DERIVED_SENSITIVITY_DOWNGRADE";

export class DataDictionaryError extends Error {
  readonly code: DataDictionaryErrorCode;
  readonly messageFa: string;

  constructor(
    code: DataDictionaryErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "DataDictionaryError";
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

export const MSG_FIELD_NOT_ENABLED_FA =
  "این فیلد در فرهنگ‌داده فعال نیست و قابل ثبت یا نمایش نیست.";

export const MSG_MOBILE_PHONE_FORMAT_FA =
  "شماره موبایل نامعتبر است. فرمت مجاز: ۰۹XXXXXXXXX.";

export const MSG_DATA_ELEMENT_NOT_FOUND_FA = "عنصر داده یافت نشد.";

export const MSG_DATA_ELEMENT_ENABLE_REJECT_FA =
  "عنصر با وضعیت reject قابل فعال‌سازی نیست.";

export const MSG_DATA_ELEMENT_ENABLE_LATER_FA =
  "عنصر later تا تغییر disposition به approve قابل فعال‌سازی نیست.";

export const MSG_DATA_ELEMENT_ENABLE_INCOMPLETE_FA =
  "فعال‌سازی بدون تکمیل فراداده الزامی (purpose، owner، format، …) مجاز نیست.";

export const MSG_FREE_TEXT_PURPOSE_REQUIRED_FA =
  "متن آزاد بدون purpose و کنترل دسترسی مجاز نیست.";

export const MSG_DERIVED_SENSITIVITY_DOWNGRADE_FA =
  "کاهش حساسیت عنصر مشتق بدون ثبت ارزیابی مجاز نیست.";

export const PERSON_READ_PERMISSION = "person.read";
export const PERSON_WRITE_PERMISSION = "person.write";
export const PERSON_DATA_CATEGORY = "identity.person";
export const NATIONAL_ID_DATA_CATEGORY = "identity.national_id";
