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

/** Org-unit master-data errors (Story 3.5 / FR-9). Clients match codes, not Persian substrings. */
export type OrgUnitErrorCode =
  | "ORG_UNIT_NOT_FOUND"
  | "INVALID_PARENT_TYPE"
  | "CHILD_OUTSIDE_PARENT_VALIDITY"
  | "IMPOSSIBLE_REPARENT"
  | "DEACTIVATION_BLOCKED_DEPENDENCIES"
  | "DUPLICATE_ORG_CODE"
  | "INVALID_ORG_INTERVAL"
  | "VALIDATION"
  | "SENTINEL_VALUE"
  | "PERMISSION_DENIED"
  | "BLOCKED_ORG_OPERATION";

export class OrgUnitError extends Error {
  readonly code: OrgUnitErrorCode;
  readonly messageFa: string;

  constructor(
    code: OrgUnitErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "OrgUnitError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export const ORGANIZATION_READ_PERMISSION = "organization.read";
export const ORGANIZATION_WRITE_PERMISSION = "organization.write";
export const ORGANIZATION_DATA_CATEGORY = "organization.unit";

export const MSG_ORG_UNIT_NOT_FOUND_FA = "واحد سازمانی یافت نشد.";

export const MSG_INVALID_PARENT_TYPE_FA =
  "نوع والد با نوع واحد سازگار نیست. سلسله‌مراتب باید حقوقی ← کسب‌وکار ← دپارتمان ← تیم باشد.";

export const MSG_CHILD_OUTSIDE_PARENT_VALIDITY_FA =
  "بازه اعتبار واحد فرزند باید داخل بازه اعتبار والد باشد.";

export const MSG_IMPOSSIBLE_REPARENT_FA =
  "جابه‌جایی والد در این بازه زمانی ممکن نیست.";

export const MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA =
  "غیرفعال‌سازی به‌خاطر وابستگی‌های فعال مجاز نیست تا سیاست disposition تعیین شود.";

export const MSG_DUPLICATE_ORG_CODE_FA =
  "کد واحد سازمانی تکراری است. کد دیگری انتخاب کنید.";

export const MSG_INVALID_ORG_INTERVAL_FA =
  "بازه اعتبار واحد سازمانی نامعتبر است. تاریخ پایان باید بعد از تاریخ شروع باشد.";

export const MSG_ORG_DEACTIVATE_END_REQUIRED_FA =
  "برای غیرفعال‌سازی باید تاریخ پایان اعتبار مشخص شود.";

export const MSG_INVALID_ORG_UNIT_TYPE_FA =
  "نوع واحد سازمانی نامعتبر است. فقط حقوقی، کسب‌وکار، دپارتمان یا تیم مجاز است.";

export const MSG_CORRUPT_ORG_UNIT_TYPE_FA =
  "نوع واحد سازمانی در داده نامعتبر است. رکورد را بررسی کنید.";

export const MSG_INACTIVE_PARENT_FA =
  "نمی‌توان زیر واحد والد غیرفعال، واحد جدید ایجاد یا فعال کرد.";

export const MSG_ORG_NAME_REQUIRED_FA = "نام فارسی واحد سازمانی الزامی است.";

export const MSG_ORG_CODE_REQUIRED_FA = "کد واحد سازمانی الزامی است.";

export const MSG_BLOCKED_ORG_OPERATION_FA =
  "این عملیات سازمانی تا تعیین سیاست زمانی/ظرفیت مجاز نیست.";

export const MSG_ORG_PERMISSION_REQUIRED_FA = "دسترسی ندارید.";

/** Job-reference master-data errors (Story 3.6 / FR-10). Clients match codes, not Persian substrings. */
export type JobRefErrorCode =
  | "JOB_REF_NOT_FOUND"
  | "GRADE_NOT_IN_LADDER"
  | "DUPLICATE_JOB_REF_CODE"
  | "DUPLICATE_JOB_REF_RANK"
  | "DEACTIVATION_BLOCKED_DEPENDENCIES"
  | "INVALID_HALF_GRADE_RANK"
  | "LADDER_HAS_ACTIVE_GRADES"
  | "BLOCKED_JOB_REF_OPERATION"
  | "INVALID_JOB_REF_INTERVAL"
  | "VALIDATION"
  | "SENTINEL_VALUE"
  | "PERMISSION_DENIED";

export class JobRefError extends Error {
  readonly code: JobRefErrorCode;
  readonly messageFa: string;

  constructor(
    code: JobRefErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "JobRefError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export const JOB_REFERENCE_READ_PERMISSION = "job_reference.read";
export const JOB_REFERENCE_WRITE_PERMISSION = "job_reference.write";
export const JOB_REFERENCE_DATA_CATEGORY = "organization.job_reference";

export const MSG_JOB_REF_NOT_FOUND_FA = "مرجع شغلی یافت نشد.";

export const MSG_GRADE_NOT_IN_LADDER_FA =
  "گرید به لدر انتخاب‌شده تعلق ندارد.";

export const MSG_DUPLICATE_JOB_REF_CODE_FA =
  "کد مرجع شغلی تکراری است. کد دیگری انتخاب کنید.";

export const MSG_DUPLICATE_JOB_REF_RANK_FA =
  "رتبه گرید در این لدر تکراری است. رتبه دیگری انتخاب کنید.";

export const MSG_INVALID_HALF_GRADE_RANK_FA =
  "رتبه گرید نامعتبر است. فقط اعداد مثبت با گام نیم‌واحد تا ۹۹۹٫۹ (مثلاً ۱۲ یا ۱۲٫۵) مجاز است.";

export const MSG_LADDER_HAS_ACTIVE_GRADES_FA =
  "غیرفعال‌سازی لدر در حالی که گرید فعال دارد مجاز نیست.";

export const MSG_BLOCKED_JOB_REF_OPERATION_FA =
  "این عملیات مرجع شغلی تا تعیین سیاست زمانی مجاز نیست.";

export const MSG_INVALID_JOB_REF_INTERVAL_FA =
  "بازه اعتبار مرجع شغلی نامعتبر است. تاریخ پایان باید بعد از تاریخ شروع باشد.";

export const MSG_JOB_REF_DEACTIVATE_END_REQUIRED_FA =
  "برای غیرفعال‌سازی باید تاریخ پایان اعتبار مشخص شود.";

export const MSG_JOB_REF_NAME_REQUIRED_FA = "نام فارسی مرجع شغلی الزامی است.";

export const MSG_JOB_REF_CODE_REQUIRED_FA = "کد مرجع شغلی الزامی است.";

export const MSG_JOB_REF_LADDER_REQUIRED_FA = "انتخاب لدر برای گرید الزامی است.";

export const MSG_JOB_REF_RANK_REQUIRED_FA = "رتبه گرید الزامی است.";

export const MSG_INACTIVE_LADDER_FA =
  "نمی‌توان زیر لدر غیرفعال، گرید جدید ایجاد یا فعال کرد.";

export const MSG_JOB_REF_PERMISSION_REQUIRED_FA = "دسترسی ندارید.";

/** Primary Assignment projection errors (Story 3.7 / FR-11). Clients match codes. */
export type PrimaryAssignmentErrorCode =
  | "OVERLAPPING_PRIMARY_ASSIGNMENT"
  | "PRIMARY_ASSIGNMENT_REQUIRED"
  | "PRIMARY_COVERAGE_GAP"
  | "PRIMARY_OUTSIDE_EMPLOYMENT"
  | "TEAM_UNIT_REQUIRED"
  | "GRADE_NOT_IN_LADDER"
  | "PRIMARY_ASSIGNMENT_NOT_FOUND"
  | "PRIMARY_ALREADY_CLOSED"
  | "INVALID_PRIMARY_INTERVAL"
  | "EMPLOYMENT_NOT_FOUND"
  | "REF_NOT_FOUND"
  | "VALIDATION"
  | "SENTINEL_VALUE";

export class PrimaryAssignmentError extends Error {
  readonly code: PrimaryAssignmentErrorCode;
  readonly messageFa: string;

  constructor(
    code: PrimaryAssignmentErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "PrimaryAssignmentError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export const MSG_OVERLAPPING_PRIMARY_ASSIGNMENT_FA =
  "بازه تخصیص اصلی با تخصیص موجود هم‌پوشانی دارد.";

export const MSG_PRIMARY_ASSIGNMENT_REQUIRED_FA =
  "برای همکاری فعال باید دقیقاً یک تخصیص اصلی فعال وجود داشته باشد.";

export const MSG_PRIMARY_COVERAGE_GAP_FA =
  "بازه همکاری فعال باید بدون شکاف توسط تخصیص‌های اصلی پوشش داده شود.";

export const MSG_PRIMARY_OUTSIDE_EMPLOYMENT_FA =
  "بازه تخصیص اصلی باید داخل بازه همکاری باشد.";

export const MSG_TEAM_UNIT_REQUIRED_FA =
  "تخصیص اصلی فقط به واحد از نوع تیم مجاز است.";

export const MSG_PRIMARY_ASSIGNMENT_NOT_FOUND_FA = "تخصیص اصلی یافت نشد.";

export const MSG_PRIMARY_ALREADY_CLOSED_FA =
  "این تخصیص اصلی قبلاً پایان یافته است.";

export const MSG_INVALID_PRIMARY_INTERVAL_FA =
  "بازه تخصیص اصلی نامعتبر است. تاریخ پایان باید بعد از تاریخ شروع باشد.";

export const MSG_PRIMARY_REF_NOT_FOUND_FA =
  "مرجع مرتبط با تخصیص اصلی یافت نشد.";
