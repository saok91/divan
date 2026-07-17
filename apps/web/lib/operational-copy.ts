/**
 * Epic-1 operational Persian copy catalog (EXPERIENCE State Patterns / Voice).
 * Fact + next step; no emoji; no ceremonial success. Persian-only UI.
 */

export const operationalCopy = {
  /** UX-DR18 deep-link deny — exact string. */
  accessDeniedTitle: "دسترسی ندارید.",
  accessDeniedBody:
    "به این مسیر دسترسی ندارید. می‌توانید به صفحهٔ شروع نقش خود بازگردید.",
  accessDeniedReturn: "بازگشت به صفحهٔ شروع",

  /** LDAP / identity-provider outage — wired by Story 1.8 login UI. */
  ldapUnavailable: "اتصال به سامانه هویت برقرار نیست.",

  /** Empty search (palette / personnel stub). */
  emptySearch: "نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.",

  /**
   * Suppressed small-cohort / differencing (Story 2.7 / UX-DR15).
   * Never render as 0 — cards and cells use this exact string.
   */
  suppressedCohort: "داده قابل نمایش نیست",

  /** Viewport gate (genuine small window). */
  viewportGateBody:
    "برای استفاده از دیوان، حداقل وضوح صفحهٔ نمایش {size} لازم است. لطفاً پنجره را بزرگ‌تر کنید یا از نمایشگر دسکتاپ استفاده کنید.",

  /** Scope revoked — EXPERIENCE exact (Story 2.6 mid-session modal). */
  scopeRevoked: "دسترسی شما تغییر کرد.",
  /** Demo draft stand-in (Epic 4 Draft forms do not exist yet). */
  authzChangedSaveDraft: "ذخیره پیش‌نویس",
  authzChangedDiscard: "دور انداختن",
  authzChangedAcknowledge: "متوجه شدم",
  authzChangedDraftHint:
    "پیش‌نویس ذخیره‌نشده دارید. قبل از ادامه ذخیره یا دور بیندازید. نهایی‌سازی مسدود است.",
  authzChangedFinalizeBlocked: "نهایی‌سازی تا تأیید تغییر دسترسی ممکن نیست.",

  /** Unsaved form — catalog until Epic 4 surfaces exist. */
  unsavedForm:
    "تغییرات ذخیره نشده‌اند. قبل از ترک صفحه آن‌ها را ذخیره یا لغو کنید.",

  loginPrompt: "برای ادامه وارد حساب کاربری شوید.",
  inactiveAccount: "این حساب غیرفعال است.",
  invalidCredentials: "نام کاربری یا رمز عبور نادرست است.",

  /** Access admin empty entitlements (Story 2.3 AC #4 — exact). */
  emptyEntitlements: "تخصیص دسترسی‌ای ثبت نشده.",

  /** Entitlement lifecycle (Story 2.4). */
  emptyGrants: "درخواست دسترسی‌ای ثبت نشده.",
  grantListLoading: "در حال بارگذاری درخواست‌های دسترسی…",
  grantListError: "بارگذاری درخواست‌های دسترسی ممکن نشد.",
  grantActionFailed: "عملیات دسترسی انجام نشد.",
  grantRequested: "درخواست دسترسی ثبت شد و در انتظار تأیید است.",
  grantApproved: "درخواست دسترسی تأیید شد.",
  grantActivated: "دسترسی فعال شد.",
  grantRevoked: "دسترسی لغو شد.",
  grantWaived: "درخواست دسترسی رد شد.",
  grantRecertified: "بازتأیید دسترسی ثبت شد.",
  grantOverdueHint:
    "برخی دسترسی‌ها معلق یا نیازمند بازتأیید هستند و تا اقدام مستقل فعال نمی‌مانند.",
  grantSubjectRequired: "حساب موضوع را انتخاب کنید.",
  /** Mid-session revocation — EXPERIENCE exact. */
  // scopeRevoked already defined above

  breakGlassActive: "دسترسی اضطراری فعال است.",
  breakGlassExpired: "دسترسی اضطراری پایان یافت.",
  breakGlassDismiss: "بستن",
  breakGlassIncidentHint: "(حادثه: {incident})",
  breakGlassActiveHint:
    "دسترسی اضطراری از سرور hydrate شده؛ برای درخواست یا بازبینی به مدیریت دسترسی بروید.",
  breakGlassAdminLink: "مدیریت دسترسی اضطراری",
  breakGlassRequestTitle: "درخواست دسترسی اضطراری",
  breakGlassRequestHint:
    "حادثه، هدف، موضوع و تاریخ انقضا الزامی است. خروجی و مدیریت مجوز به‌صورت پیش‌فرض انکار می‌شود.",
  breakGlassIncidentLabel: "شناسهٔ حادثه",
  breakGlassPurposeLabel: "هدف دسترسی",
  breakGlassExpiresLabel: "تاریخ و ساعت انقضا",
  breakGlassExpiresHelper: "انقضای دسترسی اضطراری (جلالی)",
  breakGlassExpiryInvalid: "تاریخ انقضا باید در آینده باشد.",
  breakGlassRequested: "درخواست دسترسی اضطراری ثبت شد.",
  breakGlassReviewQueue: "صف بازبینی پس از استفاده",
  breakGlassReviewEmpty: "بازبینی معلقی ثبت نشده.",
  breakGlassReviewComplete: "بازبینی پس از استفاده ثبت شد.",
  breakGlassReviewAction: "ثبت بازبینی",
  breakGlassDenyExport: "خروجی تحت دسترسی اضطراری مجاز نیست.",
  breakGlassDenyAdmin: "مدیریت دسترسی تحت ارتفاع اضطراری مجاز نیست.",

  grantExpiresLabel: "انقضا (اختیاری)",
  grantExpiresHelper: "تاریخ و ساعت انقضای دسترسی (جلالی)",
  grantRecertifyLabel: "مهلت بازتأیید (اختیاری)",
  grantRecertifyHelper: "مهلت بازتأیید دسترسی (جلالی)",

  staleGoldCtaHint:
    "تا به‌روز شدن داده، نهایی‌سازی و خروجی غیرفعال است.",

  /** Person identity (Story 3.1). */
  personListLoading: "در حال بارگذاری فهرست پرسنل…",
  personListError: "بارگذاری فهرست پرسنل ممکن نشد.",
  personListEmpty: "پرسنلی ثبت نشده. می‌توانید یک نفر ایجاد کنید.",
  personActionFailed: "عملیات پرسنل انجام نشد.",
  personPersonnelCodeRequired: "کد پرسنلی الزامی است.",
  personGivenNameRequired: "نام الزامی است.",
  personFamilyNameRequired: "نام خانوادگی الزامی است.",
  personMobileRequired: "شماره موبایل الزامی است.",
  personDuplicateCode: "کد پرسنلی تکراری است. کد دیگری انتخاب کنید.",
  personDuplicateNationalId:
    "کد ملی تکراری است. مقدار دیگری وارد کنید یا خالی بگذارید.",
  personBlockedIdentityOp:
    "این عملیات تا تعیین سیاست داده/مهاجرت مجاز نیست.",
  personFieldsLoading: "در حال بارگذاری فیلدهای مجاز…",
  personFieldsError: "بارگذاری فیلدهای فرهنگ‌داده ممکن نشد.",
  personCreateFieldsDisabled:
    "ایجاد پرسنل ممکن نیست؛ فیلدهای الزامی در فرهنگ‌داده فعال نیستند.",
  personDictionaryHeading: "فرهنگ‌داده (خلاصه)",
  personDictionaryHint:
    "فقط عناصر approve با فراداده کامل فعال می‌شوند؛ حضور در اکسل کافی نیست.",
  personDictionaryLoading: "در حال بارگذاری رجیستری…",
  personDictionaryError: "بارگذاری رجیستری فرهنگ‌داده ممکن نشد.",
} as const;

/**
 * Stale/recalc banner — Voice pattern: fact + time + next step.
 * `pendingUntilLabel` should already use Persian digits (e.g. ۰۹:۱۴).
 */
export function staleRecalcMessage(pendingUntilLabel: string): string {
  return `داده به‌روز نیست — تا ${pendingUntilLabel} محاسبه نشده.`;
}

/** Short route landmark announce (EXPERIENCE landmarks). */
export function routeAnnounce(surfaceLabel: string): string {
  return surfaceLabel;
}
