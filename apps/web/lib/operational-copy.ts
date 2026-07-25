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

  /** Empty search (palette / personnel stub / governed table). */
  emptySearch: "نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.",

  /** Clear filters CTA — EXPERIENCE exact (Story 4b.4 / UX-DR7). */
  clearFilters: "پاک کردن فیلترها",

  /**
   * Suppressed small-cohort / differencing (Story 2.7 / UX-DR15).
   * Never render as 0 — cards and cells use this exact string.
   */
  suppressedCohort: "داده قابل نمایش نیست",

  /**
   * Empty scoped dashboard (Story 5.4 / UX-DR15) — not emptySearch.
   * True empty scope under actor filters; never reuse suppress copy.
   */
  emptyDashboardScope:
    "در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.",

  /**
   * Empty scoped report (Story 5.5 / FR-36) — same Persian as dashboard empty
   * scope is acceptable; never reuse emptySearch or suppressedCohort.
   */
  emptyReportScope:
    "در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.",

  /** Dashboard load / filter failures — never reuse accessDenied for infra. */
  dashboardLoadError: "بارگذاری داشبورد ممکن نشد.",
  dashboardFilterInvalid: "تاریخ یا بازهٔ فیلتر نامعتبر است.",
  dashboardPending: "در حال به‌روزرسانی داده‌های مشتق…",
  /**
   * Team filter applies to org/HC cards only — population cards stay on
   * PopulationPort ∩ InferenceBulk cohort (Story 5.4 review decision).
   */
  dashboardTeamFilterHint:
    "شناسه تیم فقط روی کارت‌های سازمان و ظرفیت اعمال می‌شود؛ افراد فعال و روند روی محدودهٔ دسترسی جمعیت است.",

  /** Report load / filter failures (Story 5.5) — never reuse accessDenied for infra. */
  reportLoadError: "بارگذاری گزارش ممکن نشد.",
  reportFilterInvalid: "تاریخ یا بازهٔ فیلتر گزارش نامعتبر است.",
  reportPending: "در حال به‌روزرسانی داده‌های مشتق…",
  reportImportBatchUnavailable:
    "گزارش نتیجه دسته‌های واردسازی پس از Epic ۶ (مهاجرت) فعال می‌شود؛ دادهٔ واردسازی هنوز در دسترس نیست.",
  reportExportStubHint:
    "خروجی حاکمیتی در داستان ۶٫۵ فعال می‌شود؛ فعلاً فقط مشاهده مجاز است.",
  reportTeamFilterHint:
    "شناسه تیم جمعیت گزارش‌های فرد/رویداد را قطع می‌کند؛ برای سازمان، اعضای تیم و ظرفیت هم اعمال می‌شود.",

  /** Controlled import wizard (Story 6.1) — never reuse accessDenied for infra. */
  importLoadError: "بارگذاری واردسازی ممکن نشد.",
  importUploadReject: "فایل پذیرفته نشد. قالب و نوع فایل را بررسی کنید.",
  importFileReadError:
    "خواندن فایل ممکن نشد. فایل را دوباره انتخاب کنید یا اگر باز است ببندید.",
  importTemplateMismatch:
    "ستون‌های فایل با قالب ثبت‌شده مطابقت ندارد. از قالب راه‌اندازی استفاده کنید.",
  importFormulaReject:
    "فایل دارای فرمول، ماکرو یا پیوند خارجی است و رد شد. فقط مقادیر ثابت بفرستید.",
  importValidationSummary: "خلاصه اعتبارسنجی",
  importStepIdentify: "شناسایی",
  importStepValidate: "اعتبارسنجی",
  importStepPreview: "پیش‌نمایش",
  importStepConfirm: "تأیید پیش‌نویس",
  importSelectTemplate: "قالب واردسازی",
  importSelectFile: "فایل CSV یا XLSX",
  importUploadAction: "بارگذاری و اعتبارسنجی",
  importCancelPreview: "لغو پیش‌نمایش",
  importClosePreview: "بستن",
  importConfirmDismiss: "انصراف",
  importReopenPreview: "باز کردن پیش‌نمایش",
  importConfirmDraft: "تأیید پیش‌نویس (بدون اجرا)",
  importConfirmHint:
    "تأیید فقط پیش‌نویس را برای اجرای بعدی نگه می‌دارد؛ قطعی‌سازی تولید در داستان ۶٫۲ است.",
  importBulkDayHint:
    "ورود گروهی روزمره در تب‌های بخش‌هاست؛ این صفحه ویزارد پیشرفتهٔ مهاجرت است.",
  importPreviewTitle: "پیش‌نمایش واردسازی",
  importNoTemplates: "قالب واردسازی ثبت نشده.",
  importErrorsLabel: "خطا",
  importWarningsLabel: "هشدار",
  importRowsLabel: "ردیف",
  importDraftConfirmed: "پیش‌نویس منجمد شد؛ مرحله بعد تأیید جداگانه است.",
  importPopulationHint: "شفافیت محدوده جمعیت",
  importStepApprove: "تأیید دسته",
  importStepExecute: "اجرا",
  importStepResult: "نتیجه",
  importApproveAction: "تأیید برای اجرا",
  importApproveHint:
    "تأیید محتوا را منجمد می‌کند؛ اجرا باید توسط نقش جداگانه انجام شود.",
  importExecuteAction: "اجرای دسته",
  importExecuteConfirmTitle: "تأیید اجرای دسته واردسازی",
  importExecuteConsequence:
    "اجرا دسته را از انبار موقت به تولید قطعی می‌کند. در صورت ناموفق بودن، وضعیت تولید تغییر نمی‌کند.",
  importExecuteSuccess: "اجرا موفق بود. شناسه‌های ایجادشده در شواهد دسته ثبت شد.",
  importExecuteFailed: "ناموفق",
  importConcurrentBatch: "دسته دیگری در حال اجراست",
  importSodBlocked: "تفکیک وظایف رعایت نشده است.",
  importContentsReadOnly: "محتوای تأییدشده فقط خواندنی است و قابل ویرایش نیست.",
  importEvidenceLabel: "شواهد دسته",
  importCorrelationLabel: "شناسه همبستگی",
  importRollbackStaging: "بازگشت انبار موقت",

  /**
   * FR-39 Baseline / reconstructable-history boundary (Story 6.3).
   * provenance.source=migration is audit metadata — not cutover control.
   */
  eventOriginBaselineFa: "خط مبنا",
  eventOriginImportedFa: "رویداد وارداتی",
  eventOriginNativeFa: "رویداد بومی",
  eventTypeBaselineRecordedFa: "خط مبنا (Baseline)",
  /**
   * Timeline header when Person has BaselineRecorded and it is chronologically
   * first (where applicable).
   */
  timelineBoundaryStartsAtBaselineFa:
    "شروع تاریخچهٔ قابل‌بازسازی قابل‌اتکا برای این فرد از رویداد خط مبنا در تاریخ مؤثر زیر است.",
  /**
   * Honest qualifier when any non-Baseline events exist before Baseline Effective Date
   * (native or imported — do not claim “بومی” alone).
   */
  timelineBoundaryWithEarlierNativeFa:
    "خط مبنا ثبت شده است و مرز تاریخچهٔ قابل‌بازسازی قابل‌اتکا را مشخص می‌کند؛ رویدادهای پیش از تاریخ مؤثر خط مبنا ممکن است خارج از این مرز باشند.",
  /**
   * Timeline page may omit older events — never claim Baseline is chronologically first.
   */
  timelineBoundaryHistoryIncompleteFa:
    "خط مبنا در این فهرست دیده می‌شود؛ به‌دلیل بارگذاری ناقص گاه‌شمار، قطعی نیست که رویداد قدیمی‌تری پیش از خط مبنا وجود نداشته باشد.",
  importFr39BaselineEstablishedFa:
    "خط مبنا (Baseline) برای ردیف‌های موفق برقرار شد.",
  importFr39BoundaryHonestyFa:
    "شروع تاریخچهٔ قابل‌بازسازی قابل‌اتکا از رویداد خط مبنای تأییدشده است (در صورت وجود فرد از قبل، رویدادهای پیشین ممکن است قبل از این مرز باشند).",
  importFr39ProvenanceMetadataOnlyFa:
    "منبع migration فقط فرادادهٔ ممیزی است و جایگزین کنترل‌های تأیید/اجرا/انبار موقت/تفکیک وظایف نیست.",

  /**
   * FR-40 / LG-1 reconciliation workspace (Story 6.4).
   * Unsigned/incomplete must never read as production-ready.
   */
  reconWorkspaceTitle: "فضای کار تطبیق مهاجرت",
  reconWorkspaceHint:
    "تطبیق با کنترل‌های تأییدشدهٔ مالک؛ قطعه‌سازی تولید بدون امضا و رفع مغایرت بحرانی مسدود است.",
  reconCreateRun: "ایجاد اجرای تطبیق",
  reconCompare: "محاسبه مشاهدات و مقایسه",
  reconAttestControls: "ثبت کنترل‌های تأییدشده",
  reconDomainColumn: "دامنه",
  reconControlColumn: "کنترل تأییدشده",
  reconObservedColumn: "مشاهده",
  reconStatusColumn: "وضعیت",
  reconDiscrepanciesTitle: "مغایرت‌ها",
  reconDispositionAction: "ثبت معافیت FR-۵۵",
  reconOwnerRequired: "مالک مغایرت الزامی است.",
  reconOwnerPlaceholder: "شناسه حساب مالک",
  reconRationalePlaceholder: "توجیه معافیت",
  reconIndependentApproverPlaceholder: "شناسه تأییدکننده مستقل",
  reconWaiverScopePlaceholder: "دامنه معافیت",
  reconWaiverRiskPlaceholder: "ریسک باقیمانده",
  reconWaiverControlPlaceholder: "کنترل جبرانی",
  reconWaiverExpiryPlaceholder: "تاریخ انقضا",
  reconWaiverFieldsRequired:
    "معافیت FR-۵۵ نیازمند مالک، توجیه، تأییدکننده مستقل، دامنه، ریسک، کنترل جبرانی و تاریخ انقضا است.",
  reconControlsJsonRequired:
    "برای ثبت کنترل‌ها باید JSON صریح همهٔ دامنه‌ها را وارد کنید؛ مقدار مشاهده جایگزین نمی‌شود.",
  reconControlJsonHint:
    "JSON کنترل‌های تأییدشدهٔ مالک برای همهٔ دامنه‌ها (بدون کپی خودکار از مشاهده)",
  reconSignMigrationLead: "امضای Migration Lead",
  reconSignHrDataOwner: "امضای HR Data Owner",
  reconSignaturesTitle: "امضاها",
  reconProductionBlocked: "قطعه‌سازی تولید مسدود است.",
  reconProductionReady: "گیت تولید برای این اجرا برقرار است.",
  reconNotProductionReady:
    "تطبیق امضا نشده یا ناقص است — آمادهٔ تولید نیست.",
  reconStatusDraft: "پیش‌نویس",
  reconStatusInProgress: "در حال انجام",
  reconStatusSigned: "امضاشده",
  reconStatusMatch: "مطابق",
  reconStatusMismatch: "مغایرت",
  reconStatusMissingControl: "کنترل موجود نیست",
  reconStatusUnavailable: "مشاهده در دسترس نیست",
  reconStatusOpen: "باز",
  reconStatusClosed: "بسته",
  reconTrialExecuteOnly: "اجرای آزمایشی (بدون ادعای آمادگی تولید)",
  reconTrialExecuteStatus:
    "اجرای آزمایشی انجام شد؛ آمادگی تولید ادعا نشده است.",
  reconProductionExecute: "اجرای تولید (پس از گیت تطبیق)",
  reconProductionExecuteConfirmTitle: "تأیید اجرای تولید پس از تطبیق امضاشده",
  reconProductionExecuteConsequence:
    "اجرای تولید فقط با اجرای تطبیق امضاشده و بدون مغایرت بحرانی باز مجاز است. توکن دلخواه پذیرفته نمی‌شود.",
  reconNoRunYet: "هنوز اجرای تطبیقی برای این دسته ایجاد نشده است.",
  reconLoadError: "بارگذاری فضای تطبیق ناموفق بود. دوباره تلاش کنید.",

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

  /**
   * Unsaved form / leave-guard (UX-DR25).
   * Title fact; body keeps fact + next step (shortened for EXPERIENCE dialog).
   */
  leaveGuardTitle: "تغییرات ذخیره نشده‌اند.",
  leaveGuardStay: "ماندن",
  unsavedForm:
    "تغییرات ذخیره نشده‌اند. قبل از ترک صفحه ذخیره کنید یا دور بیندازید.",

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
  personDictionaryEmpty: "عنصری در رجیستری فرهنگ‌داده نیست.",
  personDictionaryEnabled: "فعال",
  personDictionaryDisabled: "غیرفعال",

  /** Organization hierarchy (Story 3.5). */
  orgListLoading: "در حال بارگذاری ساختار سازمان…",
  orgListError: "بارگذاری ساختار سازمان ممکن نشد.",
  orgListEmpty: "واحد سازمانی ثبت نشده. می‌توانید یک واحد ایجاد کنید.",
  orgActionFailed: "عملیات ساختار سازمان انجام نشد.",
  orgCodeRequired: "کد واحد سازمانی الزامی است.",
  orgNameRequired: "نام فارسی واحد سازمانی الزامی است.",
  orgStartRequired: "تاریخ شروع اعتبار الزامی است.",
  orgParentRequired: "انتخاب والد برای این نوع واحد الزامی است.",
  orgDeactivateEndRequired:
    "برای غیرفعال‌سازی باید تاریخ پایان اعتبار مشخص شود.",

  /** Job reference master-data (Story 3.6 / 4b.6). */
  jobRefListError: "بارگذاری مراجع شغلی ممکن نشد.",
  jobRefRolesEmpty: "نقش سازمانی ثبت نشده. می‌توانید یک نقش ایجاد کنید.",
  jobRefJobTitlesEmpty: "عنوان شغلی ثبت نشده. می‌توانید یک عنوان ایجاد کنید.",
  jobRefSenioritiesEmpty: "ارشدیت ثبت نشده. می‌توانید یک ارشدیت ایجاد کنید.",
  jobRefLaddersEmpty: "نردبانی ثبت نشده. می‌توانید یک نردبان ایجاد کنید.",
  jobRefGradesEmpty: "گریدی برای این نردبان ثبت نشده.",
  jobRefActionFailed: "عملیات مرجع شغلی انجام نشد.",
} as const;

/**
 * Stale/recalc banner — Voice pattern: fact + time + next step.
 * `pendingUntilLabel` should already use Persian digits (e.g. ۰۹:۱۴).
 */
export function staleRecalcMessage(pendingUntilLabel: string): string {
  return `داده به‌روز نیست — تا ${pendingUntilLabel} محاسبه نشده.`;
}

/**
 * Short route landmark announce (EXPERIENCE landmarks / UX-DR21).
 * When a section tab is active: «سطح — تب».
 */
export function routeAnnounce(
  surfaceLabel: string,
  tabLabel?: string | null,
): string {
  if (tabLabel) return `${surfaceLabel} — ${tabLabel}`;
  return surfaceLabel;
}

/** Import-preview leave-guard body (batch id already Persian digits if needed). */
export function leaveGuardImportPreviewMessage(batchId: string): string {
  return `پیش‌نمایش دسته ${batchId} ذخیره نشده.`;
}

export function leaveGuardImportStagingMessage(batchId: string): string {
  return `دسته موقت ${batchId} هنوز به پایان نرسیده است.`;
}

export function importConcurrentBatchMessage(opts: {
  ownerDisplayName: string;
  correlationId: string;
}): string {
  const owner = opts.ownerDisplayName.trim() || "—";
  return `${operationalCopy.importConcurrentBatch} — مالک: ${owner} — شناسه همبستگی: ${opts.correlationId}`;
}
