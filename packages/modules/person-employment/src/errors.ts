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

/** Secondary Assignment projection errors (Story 3.8 / FR-12). Clients match codes. */
export type SecondaryAssignmentErrorCode =
  | "OVERLAPPING_EQUIVALENT_SECONDARY"
  | "SECONDARY_OUTSIDE_EMPLOYMENT"
  | "SECONDARY_REASON_REQUIRED"
  | "SECONDARY_REASON_OUT_OF_INVENTORY"
  | "SECONDARY_PERSON_MISMATCH"
  | "SECONDARY_ASSIGNMENT_NOT_FOUND"
  | "SECONDARY_ALREADY_CLOSED"
  | "INVALID_SECONDARY_INTERVAL"
  | "SECONDARY_REF_NOT_FOUND"
  | "GRADE_NOT_IN_LADDER"
  | "EMPLOYMENT_NOT_FOUND"
  | "VALIDATION"
  | "SENTINEL_VALUE";

export class SecondaryAssignmentError extends Error {
  readonly code: SecondaryAssignmentErrorCode;
  readonly messageFa: string;

  constructor(
    code: SecondaryAssignmentErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "SecondaryAssignmentError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export const MSG_OVERLAPPING_EQUIVALENT_SECONDARY_FA =
  "تخصیص ثانویه معادل با بازه هم‌پوشان وجود دارد.";

export const MSG_SECONDARY_OUTSIDE_EMPLOYMENT_FA =
  "بازه تخصیص ثانویه باید داخل بازه همکاری باشد.";

export const MSG_SECONDARY_REASON_REQUIRED_FA =
  "دلیل/نوع تخصیص ثانویه الزامی است.";

export const MSG_SECONDARY_REASON_OUT_OF_INVENTORY_FA =
  "دلیل/نوع تخصیص ثانویه خارج از فهرست تأییدشده است.";

export const MSG_SECONDARY_PERSON_MISMATCH_FA =
  "شناسه فرد با همکاری انتخاب‌شده هم‌خوان نیست.";

export const MSG_SECONDARY_ASSIGNMENT_NOT_FOUND_FA =
  "تخصیص ثانویه یافت نشد.";

export const MSG_SECONDARY_ALREADY_CLOSED_FA =
  "این تخصیص ثانویه قبلاً پایان یافته است.";

export const MSG_INVALID_SECONDARY_INTERVAL_FA =
  "بازه تخصیص ثانویه نامعتبر است. تاریخ پایان باید بعد از تاریخ شروع باشد.";

export const MSG_SECONDARY_REF_NOT_FOUND_FA =
  "مرجع مرتبط با تخصیص ثانویه یافت نشد.";

/** Derived management relationship errors (Story 3.9 / FR-13). Clients match codes. */
export type ManagementRelationshipErrorCode =
  | "AMBIGUOUS_TEAM_MANAGER"
  | "AMBIGUOUS_MANAGEMENT_SCOPE"
  | "MANAGEMENT_ROLE_REGISTRY_INVALID"
  | "SENIOR_MANAGER_POLICY_UNDEFINED"
  | "ORG_UNIT_NOT_FOUND"
  | "VALIDATION";

export class ManagementRelationshipError extends Error {
  readonly code: ManagementRelationshipErrorCode;
  readonly messageFa: string;

  constructor(
    code: ManagementRelationshipErrorCode,
    messageFa: string,
    message?: string,
  ) {
    super(message ?? messageFa);
    this.name = "ManagementRelationshipError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export const MSG_AMBIGUOUS_TEAM_MANAGER_FA =
  "بیش از یک مدیر میانی فعال برای این تیم وجود دارد. دسترسی تا رفع ابهام مجاز نیست.";

export const MSG_AMBIGUOUS_MANAGEMENT_SCOPE_FA =
  "دامنه مدیریتی مبهم است. دسترسی تا رفع ابهام مجاز نیست.";

export const MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA =
  "فهرست نقش‌های مدیریتی نامعتبر است.";

export const MSG_SENIOR_MANAGER_POLICY_UNDEFINED_FA =
  "سیاست دامنه مدیر ارشد هنوز تعریف نشده است.";

/** Personnel Event Draft / finalize / lifecycle errors (Stories 4.2–4.3). Clients match codes. */
export type PersonnelEventErrorCode =
  | "DRAFT_NOT_FOUND"
  | "DRAFT_NOT_EDITABLE"
  | "DRAFT_ALREADY_FINALIZED"
  | "DRAFT_DELETED"
  | "DRAFT_VERSION_CONFLICT"
  | "FINALIZE_BLOCKED"
  | "FINALIZE_WARNING_ACK_REQUIRED"
  | "FINALIZE_OVERRIDE_REQUIRED"
  | "FINALIZE_STALE_SNAPSHOT"
  | "FINALIZE_PENDING_REVIEW"
  | "FINALIZE_IDEMPOTENCY_CONFLICT"
  | "INVALID_EFFECTIVE_DATE"
  | "PERSON_NOT_FOUND"
  | "EMPLOYMENT_NOT_FOUND"
  | "EVENT_NOT_FOUND"
  | "VALIDATION"
  | "SENSITIVE_PAYLOAD"
  | "PERMISSION_DENIED"
  | "HEADCOUNT_CHECK_BLOCKED"
  | "BASELINE_BOUNDARY_BLOCKED"
  | "RISK_TIER_PENDING_REVIEW"
  | "REASON_REQUIRED"
  | "CANCEL_WRONG_STATE"
  | "CANCEL_AFTER_EFFECT"
  | "REVERSE_WRONG_STATE"
  | "CORRECTION_WRONG_STATE"
  | "CORRECTION_SELF_REF"
  | "CORRECTION_CYCLE"
  | "BROKEN_CORRECTION_REF";

/** Serializable conflict row carried on reject throws (Story 11.2). */
export type PersonnelEventConflictPayload = {
  code: string;
  severity: "blocking" | "warning";
  messageFa: string;
  requiresAck?: boolean;
  requiresOverride?: boolean;
};

export class PersonnelEventError extends Error {
  readonly code: PersonnelEventErrorCode;
  readonly messageFa: string;
  /** Present when finalize/evaluate reject should surface ConflictList rows. */
  readonly conflicts?: readonly PersonnelEventConflictPayload[];

  constructor(
    code: PersonnelEventErrorCode,
    messageFa: string,
    message?: string,
    conflicts?: readonly PersonnelEventConflictPayload[],
  ) {
    super(message ?? messageFa);
    this.name = "PersonnelEventError";
    this.code = code;
    this.messageFa = messageFa;
    this.conflicts = conflicts;
  }
}

export const PERSONNEL_EVENT_DRAFT_PERMISSION = "personnel_event.draft";
export const PERSONNEL_EVENT_FINALIZE_PERMISSION = "personnel_event.finalize";
export const PERSONNEL_EVENT_CANCEL_PERMISSION = "personnel_event.cancel";
export const PERSONNEL_EVENT_REVERSE_PERMISSION = "personnel_event.reverse";
export const PERSONNEL_EVENT_CORRECT_PERMISSION = "personnel_event.correct";
export const PERSONNEL_EVENT_DATA_CATEGORY = "identity.person";

/** Fine permission for CompensationChanged / ContractChanged finalize (Story 4.8 / FR-24). */
export const COMPENSATION_WRITE_PERMISSION = "compensation.write";

export const MSG_DRAFT_NOT_FOUND_FA = "پیش‌نویس رویداد یافت نشد.";

export const MSG_DRAFT_NOT_EDITABLE_FA =
  "این پیش‌نویس قابل ویرایش یا حذف نیست.";

export const MSG_DRAFT_ALREADY_FINALIZED_FA =
  "این پیش‌نویس قبلاً نهایی شده است.";

export const MSG_DRAFT_DELETED_FA = "این پیش‌نویس حذف شده است.";

export const MSG_DRAFT_VERSION_CONFLICT_FA =
  "پیش‌نویس توسط کاربر دیگری تغییر کرده است. صفحه را تازه کنید.";

export const MSG_FINALIZE_BLOCKED_FA =
  "نهایی‌سازی به‌خاطر تعارض مسدود شد. جزئیات را در فهرست تعارض‌ها ببینید.";

export const MSG_FINALIZE_WARNING_ACK_REQUIRED_FA =
  "برای ادامه باید هشدارها را صریحاً تأیید کنید.";

export const MSG_FINALIZE_OVERRIDE_REQUIRED_FA =
  "برای این عملیات Override با دلیل الزامی است.";

export const MSG_FINALIZE_STALE_SNAPSHOT_FA =
  "مرجع‌های ارزیابی کهنه شده‌اند. دوباره بررسی کنید و نهایی‌سازی را تکرار کنید.";

export const MSG_FINALIZE_PENDING_REVIEW_FA =
  "این رویداد تا پیش‌تأیید سطح ریسک، غیررسمی می‌ماند و رویداد معتبر ثبت نشد.";

export const MSG_FINALIZE_IDEMPOTENCY_CONFLICT_FA =
  "کلید یکتایی نهایی‌سازی با پیش‌نویس دیگری تداخل دارد.";

export const MSG_INVALID_DRAFT_EFFECTIVE_DATE_FA =
  "تاریخ مؤثر نامعتبر است. فقط تاریخ روز (YYYY-MM-DD) مجاز است.";

export const MSG_PERSONNEL_EVENT_PERMISSION_REQUIRED_FA = "دسترسی ندارید.";

export const MSG_COMPENSATION_WRITE_REQUIRED_FA =
  "برای نهایی‌سازی تغییر جبران‌خدمت یا قرارداد به مجوز compensation.write نیاز است.";

export const MSG_SENSITIVE_DRAFT_PAYLOAD_FA =
  "پیش‌نویس نباید حاوی دادهٔ حساس (مبلغ، کد ملی، …) باشد.";

export const MSG_HEADCOUNT_CHECK_BLOCKED_FA =
  "بررسی ظرفیت نیروی انسانی برای این نوع رویداد هنوز آماده نیست؛ نهایی‌سازی مسدود است.";

export const MSG_HEADCOUNT_NO_CAPACITY_FA =
  "ظرفیت نیروی انسانی سازگار برای این انتصاب وجود ندارد؛ بدون Override نهایی‌سازی مجاز نیست.";

export const MSG_HEADCOUNT_PORT_UNAVAILABLE_FA =
  "سامانه ظرفیت نیروی انسانی در دسترس نیست؛ نهایی‌سازی مسدود است.";

const CAPACITY_CONFLICT_CODES = new Set([
  "HEADCOUNT_UNAPPROVED",
  "HEADCOUNT_CHECK_BLOCKED",
  "HEADCOUNT_CAPACITY_MISSING",
  "HEADCOUNT_PORT_UNAVAILABLE",
]);

/**
 * Gate-honest Persian envelope for finalize reject (Story 11.2).
 * Conflict row `messageFa` remains SoT for detail; this summarizes the gate family.
 */
export function finalizeRejectEnvelopeMessageFa(input: {
  code: string;
  messageFa: string;
  conflicts?: readonly PersonnelEventConflictPayload[];
}): string {
  const conflicts = input.conflicts ?? [];
  const conflictCodes = new Set(conflicts.map((c) => c.code));

  if (
    input.code === "FINALIZE_STALE_SNAPSHOT" ||
    conflictCodes.has("FINALIZE_STALE_SNAPSHOT")
  ) {
    return MSG_FINALIZE_STALE_SNAPSHOT_FA;
  }

  if (input.code === "FINALIZE_OVERRIDE_REQUIRED") {
    return input.messageFa?.trim() || MSG_FINALIZE_OVERRIDE_REQUIRED_FA;
  }

  const capacityConflict = conflicts.find((c) =>
    CAPACITY_CONFLICT_CODES.has(c.code),
  );
  if (capacityConflict) {
    // Prefer capacity detail over generic FINALIZE_BLOCKED — but never
    // mis-label when a non-capacity blocking row is the real gate.
    if (
      input.code === "FINALIZE_BLOCKED" ||
      input.messageFa === MSG_FINALIZE_BLOCKED_FA
    ) {
      const hasNonCapacityBlocking = conflicts.some(
        (c) =>
          c.severity === "blocking" &&
          !CAPACITY_CONFLICT_CODES.has(c.code),
      );
      if (!hasNonCapacityBlocking) {
        return capacityConflict.messageFa || MSG_HEADCOUNT_NO_CAPACITY_FA;
      }
    }
  }

  return input.messageFa;
}

export const MSG_MISSING_PERSONNEL_CODE_FA =
  "فرد باید کد پرسنلی پایدار داشته باشد.";

export const MSG_ANONYMIZED_RETURN_BLOCKED_FA =
  "بازگشت خودکار برای هویت ناشناس‌سازی‌شده مسدود است؛ تا تعریف توکن AR-DATA یا تطبیق دستی ممیزی‌شده مجاز نیست.";

export const MSG_BASELINE_BOUNDARY_BLOCKED_FA =
  "تاریخ مؤثر قبل از مرز Baseline است و بدون Override مجاز نیست.";

/** Misconfigured Baseline boundary env / override — fail-closed (Story 4.10). */
export const MSG_BASELINE_BOUNDARY_INVALID_FA =
  "مرز Baseline نامعتبر است؛ تا اصلاح پیکربندی، خواندن و نهایی‌سازی مسدود است.";

/** Read-side as-of validation (Story 4.10) — distinct from write Override copy. */
export const MSG_ASOF_INVALID_FA =
  "تاریخ مبنا باید فقط تاریخ (YYYY-MM-DD) باشد؛ برچسب زمانی پذیرفته نمی‌شود.";

/** Read-side Baseline disclosure when asOf is before configured boundary. */
export const MSG_BASELINE_DISCLOSURE_LIMITED_FA =
  "تاریخ مبنا پیش از مرز Baseline است؛ شروع تاریخچهٔ قابل‌بازسازی قابل‌اتکا محدود است و ممکن است کامل نباشد.";

/** Read-side honesty when Baseline boundary is not configured. */
export const MSG_BASELINE_DISCLOSURE_UNCONFIGURED_FA =
  "مرز Baseline پیکربندی نشده است؛ حد شروع تاریخچهٔ قابل‌بازسازی قابل‌اتکا مشخص نیست.";

/** Read-side when asOf is on/after configured Baseline boundary. */
export const MSG_BASELINE_DISCLOSURE_WITHIN_FA =
  "تاریخ مبنا در محدودهٔ شروع تاریخچهٔ قابل‌بازسازی قابل‌اتکا پس از مرز Baseline است.";

export const MSG_IRRECONCILABLE_ORDERING_FA =
  "ترتیب رویدادهای هم‌روز قابل سازگاری نیست؛ نهایی‌سازی تا رفع تعارض مسدود است.";

export const MSG_RISK_TIER_PENDING_REVIEW_FA =
  "این نوع رویداد نیازمند پیش‌تأیید سطح ریسک است و هنوز به‌صورت معتبر ثبت نمی‌شود.";

export const MSG_EVENT_NOT_FOUND_FA = "رویداد پرسنلی یافت نشد.";

export const MSG_CANCEL_REASON_REQUIRED_FA =
  "برای لغو رویداد، ثبت دلیل الزامی است.";

export const MSG_REVERSE_REASON_REQUIRED_FA =
  "برای بازگشت رویداد، ثبت دلیل الزامی است.";

export const MSG_CORRECTION_REASON_REQUIRED_FA =
  "برای اصلاح رویداد، ثبت دلیل الزامی است.";

export const MSG_CANCEL_WRONG_STATE_FA =
  "فقط رویداد زمان‌بندی‌شده (پیش از اثر) قابل لغو است.";

export const MSG_CANCEL_AFTER_EFFECT_FA =
  "اثر این رویداد اعمال شده است؛ لغو مجاز نیست. از بازگشت یا اصلاح استفاده کنید.";

export const MSG_REVERSE_WRONG_STATE_FA =
  "فقط رویداد مؤثر (پس از اثر و بدون خنثی‌سازی قبلی) قابل بازگشت است.";

export const MSG_CORRECTION_WRONG_STATE_FA =
  "هدف اصلاح باید یک رویداد معتبر باشد؛ وضعیت فعلی برای اصلاح مجاز نیست.";

export const MSG_FINALIZE_LIFECYCLE_CHAIN_FORBIDDEN_FA =
  "لغو و بازگشت فقط از مسیر چرخهٔ رویداد مجاز است؛ در نهایی‌سازی پیش‌نویس قرار ندهید.";

export const MSG_CORRECTION_SELF_REF_FA =
  "رویداد نمی‌تواند خودش را اصلاح کند؛ ارجاع خودارجاع مسدود است.";

export const MSG_CORRECTION_CYCLE_FA =
  "زنجیره اصلاح چرخه‌ای است؛ ثبت مسدود شد.";

export const MSG_BROKEN_CORRECTION_REF_FA =
  "ارجاع اصلاح/لغو/بازگشت نامعتبر یا یافت‌نشده است؛ عملیات مسدود است.";
