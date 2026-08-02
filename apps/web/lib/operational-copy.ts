/**
 * Epic-1 operational Persian copy catalog (EXPERIENCE State Patterns / Voice).
 * Fact + next step; no emoji; no ceremonial success. Persian-only UI.
 */

import { toPersianDigits } from "./persian-digits";

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

  /**
   * Audit investigation empty filter (Story 7.1 / UX-DR22) — exact string.
   * Never reuse emptySearch.
   */
  auditEmptyFilter: "رویدادی با این فیلتر نیست.",
  auditQueryFailed: "بازیابی شواهد ممیزی ممکن نشد.",
  auditLoadError: "بارگذاری سطح ممیزی ممکن نشد.",
  auditLoadingResults: "در حال بارگذاری…",
  auditSelfReviewBlocked:
    "بازبینی فعالیت حساس خودتان مجاز نیست. بازبین مستقل الزامی است.",
  auditSelfReviewGateOk:
    "استقلال بازبین تأیید شد. ادامهٔ بازبینی از مسیر حاکمیتی موجود.",
  auditMigrationHonestyTitle: "صداقت شواهد مهاجرت",
  auditAuthAttemptHonesty:
    "جداول قدیمی AuthAttempt/AccessDenial منبع اولیهٔ تحقیق نیستند؛ منبع = رویدادهای هسته. پر کردن تاریخی معوق است.",
  auditInferenceBulkEvidenceOnly:
    "کنترل InferenceBulk روی کانال ممیزی فقط برای ثبت شواهد بازیابی است؛ نتایج تحقیق از انبار رویداد فیلتر جمعیت نمی‌شوند.",
  auditTruncatedResults:
    "نتایج بیش از سقف صفحه است — فیلتر را محدودتر کنید.",
  auditInvalidDateRange: "بازهٔ تاریخ نامعتبر است.",
  auditInvalidReviewHref: "مسیر بازبینی نامعتبر است.",
  auditEvidenceNotFound: "شواهد ممیزی یافت نشد.",
  auditOpenExportArtifact: "باز کردن خروجی مدیریت‌شده",
  auditOpenReview: "باز کردن بازبینی مستقل",
  auditFilterActor: "بازیگر",
  auditFilterOperation: "عملیات",
  auditFilterEntityType: "نوع موجودیت",
  auditFilterEntityId: "موجودیت",
  auditFilterResult: "نتیجه",
  auditFilterCorrelation: "همبستگی",
  auditFilterEventClass: "کلاس رویداد",
  auditFilterFrom: "از تاریخ",
  auditFilterTo: "تا تاریخ",
  auditApplyFilters: "اعمال فیلتر",
  auditDetailTitle: "جزئیات رویداد",
  auditSearchHeading: "تحقیق شواهد ممیزی",

  /** Clear filters CTA — EXPERIENCE exact (Story 4b.4 / UX-DR7). */
  clearFilters: "پاک کردن فیلترها",

  /**
   * Suppressed small-cohort / differencing (Story 2.7 / UX-DR15).
   * Never render as 0 — cards and cells use this exact string.
   */
  suppressedCohort: "داده قابل نمایش نیست",
  personnelPopulationFixtureEmpty:
    "محدودهٔ جمعیت فعلاً fixture است — فهرست خالی (fail-closed). برای توسعهٔ محلی ALLOW_DEV_POPULATION_UUID_REGISTRY=true را در .env بگذارید (همراه ALLOW_DEV_SEED).",

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
  dashboardPending: "در حال محاسبه — عدد ممکن است تغییر کند.",
  /**
   * Team filter applies to org/HC cards only — population cards stay on
   * PopulationPort ∩ InferenceBulk cohort (Story 5.4 review decision).
   */
  dashboardTeamFilterHint:
    "فیلتر تیم فقط روی کارت‌های سازمان و ظرفیت اعمال می‌شود؛ افراد فعال و روند روی محدودهٔ دسترسی جمعیت است.",

  /** Report load / filter failures (Story 5.5) — never reuse accessDenied for infra. */
  reportLoadError: "بارگذاری گزارش ممکن نشد.",
  reportFilterInvalid: "تاریخ یا بازهٔ فیلتر گزارش نامعتبر است.",
  reportPending: "در حال محاسبه — عدد ممکن است تغییر کند.",
  reportImportBatchUnavailable:
    "گزارش نتیجه دسته‌های واردسازی پس از Epic ۶ (مهاجرت) فعال می‌شود؛ دادهٔ واردسازی هنوز در دسترس نیست.",
  /** @deprecated Story 6.5 — kept for reference; live export uses export* keys. */
  reportExportStubHint:
    "خروجی حاکمیتی فعال است؛ از پنل خروجی برای دریافت فایل استفاده کنید.",
  reportTeamFilterHint:
    "فیلتر تیم جمعیت گزارش‌های فرد/رویداد را قطع می‌کند؛ برای سازمان، اعضای تیم و ظرفیت هم اعمال می‌شود.",

  /** Governed export artifact panel (Story 6.5 / UX-DR17 / FR-41 / FR-52). */
  exportLoadError: "آماده‌سازی خروجی ممکن نشد.",
  exportDenied: "مجوز خروجی برای این محدوده را ندارید.",
  exportArtifactNotFound: "خروجی یافت نشد.",
  exportSnapshotMismatch:
    "فیلتر یا محدودهٔ خروجی با نتیجهٔ بازبینی‌شده هم‌خوان نیست.",
  exportOpenPanel: "خروجی",
  exportPanelTitle: "خروجی حاکمیتی",
  exportClassificationLabel: "طبقه‌بندی",
  exportHandlingLabel: "نحوهٔ نگهداری",
  exportExpiryLabel: "انقضا",
  exportFieldScopeLabel: "محدودهٔ فیلدها",
  exportFormatLabel: "قالب",
  exportFormatCsv: "CSV",
  exportFormatXlsx: "XLSX",
  exportGenerate: "آماده‌سازی خروجی",
  exportDownload: "دریافت فایل",
  exportDownloadDisabledReason: "ابتدا پذیرش نگهداری را تأیید کنید.",
  exportCustodyAckLabel:
    "می‌پذیرم که دریافت‌کننده و مقصد را درست اعلام کرده‌ام و نسخه‌های خارج از سامانه تحت کنترل دیوان نیستند.",
  exportCustodyBoundary:
    "دیوان پیوند/خروجی مدیریت‌شده را لغو می‌کند؛ نسخه‌های محلی، ایمیل یا اشتراک خارج از سامانه تحت کنترل دیوان نیستند و باید طبق فرایند سازمانی امحا شوند.",
  exportRecipientLabel: "گیرنده",
  exportRecipientRequired: "گیرنده را وارد کنید.",
  exportDestinationLabel: "کلاس مقصد",
  exportDestinationLocal: "دانلود محلی",
  exportDestinationShared: "درایو اشتراکی",
  exportDestinationEmail: "ایمیل",
  exportDestinationOther: "سایر",
  exportRevoke: "لغو خروجی مدیریت‌شده",
  exportBusy: "در حال آماده‌سازی…",
  exportRowCountLabel: "تعداد ردیف",
  exportOmittedSensitiveHint:
    "برخی فیلدهای حساس به‌دلیل نبود مجوز جداگانهٔ خروجی حذف شدند.",
  exportClose: "بستن",

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
  importCatalogueTitle: "فهرست قالب‌ها",
  importCataloguePurposeLabel: "هدف",
  importCataloguePermissionLabel: "مجوز لازم",
  importSampleDownload: "دانلود قالب نمونه",
  importTemplateAccessRequired:
    "برای استفاده از این قالب، مجوز «{permission}» لازم است.",
  importSampleClassificationFa: "نمونهٔ قالب واردسازی — غیرحساس عملیاتی",
  importSampleDownloadError: "دانلود قالب نمونه ممکن نشد.",
  /** Day-to-day bulk purpose — distinguishes from `/import` migration wizard. */
  importBulkCatalogueHint:
    "ورود گروهی روزمره برای ایجاد چند رکورد با همان مجوزی که ایجاد تکی دارد. ویزارد پیشرفتهٔ مهاجرت (هفت‌مرحله‌ای با تأیید/اجرا و تطبیق) در «ورود داده» است — این مسیر همان نیست.",
  /** Five-step bulk labels (Story 9.2) — distinct from migration seven-step. */
  bulkStepTemplate: "قالب",
  bulkStepUpload: "آپلود",
  bulkStepPreview: "پیش‌نمایش و خطاها",
  bulkStepConfirm: "تأیید",
  bulkStepResult: "نتیجه",
  bulkFlowPurpose:
    "جریان پنج‌مرحله‌ای ورود گروهی روزمره: قالب، آپلود، پیش‌نمایش و خطاها، تأیید، نتیجه. مسیر مهاجرت پیشرفته در «ورود داده» است.",
  bulkContinueToUpload: "ادامه به آپلود",
  bulkContinueToConfirm: "ادامه به تأیید",
  bulkConfirmHint:
    "تأیید، دستهٔ بدون خطای ساختاری را اتمی ثبت می‌کند؛ بدون نیاز به مجوزهای تأیید/اجرای مهاجرت.",
  bulkConfirmAction: "تأیید و ثبت گروهی",
  bulkCommitSuccess: "ثبت گروهی انجام شد.",
  bulkCommitFailed: "ثبت گروهی ممکن نشد.",
  bulkPreviewHasErrors:
    "تا رفع خطاهای پیش‌نمایش نمی‌توان تأیید کرد.",
  bulkResultCreated: "ایجادشده",
  bulkResultUpdated: "به‌روزرسانی‌شده",
  bulkResultRejected: "ردشده",
  bulkStartOver: "شروع مجدد",
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
  importToastBatchLink: "بازگشت به واردسازی",
  importExecuteFailed: "ناموفق",
  /** In-place pending — must not read as committed success. */
  actionPending: "در حال انجام…",
  actionSaving: "در حال ذخیره…",
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
  reconOwnerPlaceholder: "حساب مالک…",
  reconRationalePlaceholder: "توجیه معافیت",
  reconIndependentApproverPlaceholder: "تأییدکننده مستقل…",
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

  /**
   * Recalc banner disclosure (Story 8.9 / Direction A) — no clock deadline.
   */
  staleRecalcDisclosureSummary: "توضیح بیشتر",
  staleRecalcDisclosureBody:
    "پس از هر رویداد پرسنلی، وضعیت جاری فرد دوباره محاسبه می‌شود. تا پایان محاسبه، ردیف‌های علامت‌خورده فقط خواندنی هستند و در خروجی اکسل نمی‌آیند. اگر بیش از ۱۵ دقیقه طول کشید، از «عملیات ← صف محاسبه» وضعیت را ببینید.",

  /**
   * Banner when N is unknown (fail-closed / signal error) — no invented count.
   */
  staleRecalcUnknownScope:
    "محاسبهٔ وضعیت جاری هنوز کامل نشده — نهایی‌سازی رویداد و خروجی گرفتن موقتاً غیرفعال است. معمولاً چند دقیقه طول می‌کشد.",

  /**
   * Pending/muted figures (Story 8.9 / UX-DR32) — exact string.
   * Prefer over soft dashboardPending/reportPending for displayed figures.
   */
  figureRecalculating: "در حال محاسبه — عدد ممکن است تغییر کند.",
  /** Compact in-row mark — same voice family as figureRecalculating. */
  figureRecalculatingCompact: "در حال محاسبه",

  /** Disabled-reason helpers (honest cause, not always actionPending). */
  confirmReasonRequired: "دلیل تأیید را وارد کنید.",
  formIncomplete: "موارد الزامی را کامل کنید.",
  exportSelectSource: "منبع خروجی را انتخاب کنید.",
  breakGlassSelfApproveDenied: "تأیید درخواست خودتان مجاز نیست.",
  breakGlassSelfWaiveDenied:
    "رد درخواست برای درخواست‌کننده یا موضوع همان حساب مجاز نیست.",
  tableChromeLoading: "جدول در حال بارگذاری است.",
  reportCatalogueBusy: "در حال بارگذاری گزارش…",
  disposeNotReady: "شرایط خاتمه هنوز برقرار نیست.",
  selectReconRun: "یک اجرای تطبیق را انتخاب کنید.",
  noDraftToFinalize: "پیش‌نویسی برای نهایی‌سازی نیست.",
  artifactLoadFailed: "بارگذاری سند ممکن نشد.",
  publicationSnapshotRequired: "اسنپ‌شات بازبینی‌شده لازم است.",
  importUploadPrerequisites: "قالب و پرونده را انتخاب کنید.",
  importPreviewAlreadyLoaded: "پیش‌نمایش بارگذاری شده؛ ابتدا لغو کنید.",
  importReconRequired: "تطبیق تولید هنوز آماده نیست.",

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

  /** Operations health (Story 7.2 / FR-45 / UJ-5) — no HR content. */
  opsHealthHeading: "سلامت عملیات",
  opsHealthIntro:
    "وضعیت سرویس، هویت، ورود، بازمحاسبه و قلاب پشتیبان — بدون ردیف پرسنلی.",
  opsHealthLoading: "در حال بارگذاری وضعیت عملیات…",
  opsHealthLoadError: "بارگذاری سطح عملیات ممکن نشد.",
  opsHealthProbeFailed: "بررسی سلامت عملیاتی ممکن نشد. دوباره تلاش کنید.",
  opsHealthDenied: "دسترسی ندارید.",
  opsSectionIdentity: "هویت (LDAP)",
  opsSectionService: "سرویس و پایگاه‌داده",
  opsSectionRecalc: "بازمحاسبه",
  opsSectionImport: "ورود / مهاجرت",
  opsSectionBackup: "پشتیبان / بازیابی",
  opsSectionDependencies: "وابستگی‌ها",
  opsSectionConfiguration: "پیکربندی تنظیمات",
  opsSectionAuditTrust: "اعتماد ممیزی",
  opsHonestyTitle: "صداقت عملیاتی",
  opsStatusOk: "سالم",
  opsStatusDegraded: "تضعیف‌شده",
  opsStatusRed: "قرمز",
  opsStatusUnavailable: "در دسترس نیست",
  opsStatusNotConfigured: "پیکربندی نشده",
  opsStatusEvidenceRecorded: "شواهد ثبت شده",
  opsServiceOk: "فرآیند برنامه و پایگاه‌داده پاسخ می‌دهند.",
  opsServiceDbDown: "پایگاه‌داده در دسترس نیست.",
  opsRecalcOk: "بازمحاسبه مسدودکننده‌ای در صف نیست.",
  opsRecalcPending: "بازمحاسبه در صف است — بنر سراسری نیز فعال است.",
  opsRecalcBlocking:
    "بازمحاسبه ناموفق یا کهنه — مسیرهای حساس fail-closed می‌مانند.",
  opsRecalcUnavailable: "سیگنال بازمحاسبه در دسترس نیست.",
  opsDepPostgresOk: "PostgreSQL: سالم",
  opsDepPostgresDown: "PostgreSQL: قطع",
  opsDepLdapOk: "LDAP: سالم",
  opsDepLdapNotConfigured: "LDAP: پیکربندی نشده (seeded-dev)",
  opsDepRecalcWorkerKnown: "صف بازمحاسبه: از وضعیت مشتق قابل مشاهده است",
  opsDepRecalcWorkerUnavailable: "صف بازمحاسبه: سیگنال در دسترس نیست",
  opsCountPending: "در انتظار",
  opsCountFailed: "ناموفق",
  opsCountStale: "کهنه",
  opsCorrelationLabel: "همبستگی",
  opsGateNote:
    "مسیر SysAdmin فقط هویت/پیکربندی/سلامت است؛ محتوای HR نیازمند break-glass است.",

  /** Data lifecycle / legal hold / disposal (Story 7.3 / FR-50; Story 9.8 discoverability). */
  lifecycleHeading: "نگهداری قانونی و حذف",
  lifecycleIntro:
    "نگهداری قانونی حذف را مسدود می‌کند؛ حذف فقط روی مقادیر عملیاتی و خروجی‌های مدیریت‌شده اعمال می‌شود — نه حذف ردیف ممیزی. از پروفایل فرد می‌توان به این سطح رسید؛ محدودهٔ فرد را اینجا انتخاب کنید.",
  lifecycleLoading: "در حال بارگذاری چرخهٔ عمر…",
  lifecycleLoadError: "بارگذاری چرخهٔ عمر ممکن نشد.",
  lifecycleActionFailed: "عملیات چرخهٔ عمر انجام نشد.",
  lifecycleDenied: "دسترسی ندارید.",
  lifecycleHoldsEmpty: "نگهداری قانونی فعالی ثبت نشده.",
  lifecycleRunsEmpty: "اجرای حذفی ثبت نشده.",
  lifecycleRunNotFound: "اجرای حذف یافت نشد.",
  lifecyclePlaceHold: "ثبت نگهداری قانونی",
  lifecycleReleaseHold: "آزادسازی نگهداری",
  lifecycleRunDisposal: "اجرای حذف",
  lifecycleConfirmPlaceHold:
    "نگهداری قانونی ثبت شود؟ تا آزادسازی، حذف مسدود می‌ماند.",
  lifecycleConfirmReleaseHold: "نگهداری قانونی آزاد شود؟",
  lifecycleConfirmRunDisposal:
    "حذف در محدودهٔ مشخص اجرا شود؟ مقادیر عملیاتی و خروجی‌های مدیریت‌شده پاک یا ناشناس می‌شوند.",
  lifecycleScopeKind: "نوع محدوده",
  lifecycleScopeRef: "مرجع محدوده",
  lifecycleReason: "دلیل",
  lifecyclePersonId: "افراد مشمول حذف (برای محدودهٔ دسته/سازمان الزامی)",
  lifecycleArtifactId: "شناسه خروجی (اختیاری)",
  lifecycleDisposeSubjectsRequired:
    "برای حذف با محدودهٔ دسته یا سازمان، حداقل یک فرد لازم است.",
  lifecycleListDisposalLimited:
    "برخی ردیف‌ها پس از حذف/ناشناس‌سازی محدود شده‌اند؛ مقدار قبلی بازسازی نمی‌شود.",
  lifecycleStatusActive: "فعال",
  lifecycleStatusReleased: "آزادشده",
  lifecycleExportTtlNotRetention:
    "انقضای ۴ساعتهٔ خروجی، سیاست نگهداری AR-DATA نیست.",
  lifecycleCustodyBoundary:
    "دیوان لینک/بایت مدیریت‌شده را پاک می‌کند؛ نسخه‌های محلی/ایمیل/اشتراک فرآیند سازمانی است.",
  lifecycleBlockedByHold:
    "حذف به‌خاطر نگهداری قانونی مسدود شد. نگهداری را آزاد کنید یا با حقوقی تماس بگیرید.",
  lifecycleMetadataIncomplete:
    "کلاس چرخهٔ عمر داده ناقص یا ناشناخته است؛ اقدام پایان ممکن نیست.",
  lifecycleRestoreCatchUp:
    "پس از بازیابی، نگهداری و حذف باید دوباره اعمال شوند — اثبات بازیابی اینجا نیست.",
  lifecycleCancel: "انصراف",
  lifecycleConfirm: "تأیید",
  lifecycleHoldsHeading: "نگهداری‌های قانونی",
  lifecycleRunsHeading: "اجراهای حذف",
  lifecycleOutcome: "نتیجه",

  /** Audit trust fail-safe (Story 7.4 / FR-51 / NFR-9) — no HR content. */
  auditTrustHeading: "اعتماد ممیزی",
  auditTrustSuspendedBanner:
    "ثبت ممیزی متوقف شده است؛ عملیات حساس مسدود است. رخدادهای باز را بررسی کنید یا با امنیت تماس بگیرید.",
  auditTrustSuspendedDetail:
    "نویسندهٔ شواهد معلق است — عملیات حساس تا بازبینی اعتماد مسدود است.",
  auditTrustSuspendTtlElapsed:
    "مهلت موقت تعلیق گذشته است؛ رفع تعلیق همچنان نیاز به بازبینی صریح دارد (بدون پاک‌سازی خودکار).",
  auditTrustDegradedDetail:
    "رخداد اعتماد باز وجود دارد؛ وضعیت تضعیف‌شده.",
  auditTrustReviewDeepLink: "بازبینی رخدادهای اعتماد در سطح ممیزی",
  auditTrustOkDetail: "وضعیت نویسندهٔ شواهد سالم است.",
  auditTrustUnavailable: "وضعیت اعتماد ممیزی در دسترس نیست.",
  auditTrustHashChainHonesty:
    "زنجیرهٔ درهم‌سازی تولید هنوز Deferred است — راستی‌آزمایی MVP = تریگر + فاصله + تعلیق.",
  auditTrustActionFailed: "عملیات اعتماد ممیزی انجام نشد.",
  auditTrustDenied: "دسترسی ندارید.",
  auditTrustIncidentsEmpty: "رخداد اعتماد بازی ثبت نشده.",
  auditTrustAssign: "واگذاری برای بازبینی",
  auditTrustAcknowledge: "تأیید دریافت",
  auditTrustClose: "بستن رخداد",
  auditTrustClearSuspend: "رفع تعلیق نویسنده",
  auditTrustClearSuspendConfirm:
    "تعلیق نویسندهٔ شواهد رفع شود؟ این کار قابل انتساب است و نیاز به مجوز بازبینی دارد.",
  auditTrustSelfReviewBlocked: "بازبینی خودی برای این رخداد اعتماد مجاز نیست.",
  auditTrustOpenIncidents: "رخدادهای باز",
  auditTrustLastVerification: "آخرین راستی‌آزمایی",
  auditTrustRunIntegrity: "اجرای راستی‌آزمایی تمامیت",

  /** External data-subject correction cases (Story 7.5 / FR-53; Story 9.8 IA). */
  correctionCaseHeading: "اصلاح اطلاعات",
  /** Purpose: holds + who raises + who closes (UX-DR37 / Key Flow ۴). */
  correctionCasePurpose:
    "رسیدگی به درخواست اصلاح دادهٔ فرد صاحب‌داده؛ ادمین منابع انسانی با تصمیم و شواهد پرونده را می‌بندد.",
  correctionCaseIntro:
    "درخواست اصلاح داده از صاحب‌دادهٔ خارجی؛ ثبت و بستن با تصمیم و شواهد توسط ادمین منابع انسانی — نه خودخدمتی کارمند و نه مدیریت عمومی اسناد.",
  correctionCaseLoading: "در حال بارگذاری اصلاح اطلاعات…",
  correctionCaseLoadError: "بارگذاری اصلاح اطلاعات ممکن نشد.",
  correctionCaseActionFailed: "عملیات پرونده اصلاح انجام نشد.",
  correctionCaseDenied: "دسترسی ندارید.",
  correctionCaseEmpty: "پرونده اصلاحی ثبت نشده.",
  correctionCaseOpen: "گشودن پرونده",
  correctionCaseDecide: "ثبت تصمیم",
  correctionCaseClose: "بستن پرونده",
  correctionCaseEscalate: "اسکالیشن مهلت‌گذشته",
  correctionCaseConfirmOpen: "پرونده اصلاح جدید گشوده شود؟",
  correctionCaseConfirmDecide: "تصمیم پرونده ثبت شود؟ این کار قابل انتساب است.",
  correctionCaseConfirmClose: "پرونده با شواهد بستن بسته شود؟",
  correctionCaseRequestRef: "مرجع درخواست",
  correctionCaseAuthority: "تأیید مرجع/اختیار",
  correctionCasePersonId: "فرد",
  correctionCaseOwner: "مالک پرونده",
  correctionCaseDeadline: "مهلت",
  correctionCaseStatus: "وضعیت",
  correctionCaseDecision: "تصمیم",
  correctionCaseDecisionReason: "دلیل تصمیم",
  correctionCaseClosureEvidence: "شواهد بستن",
  correctionCaseBreachedBadge: "مهلت گذشته",
  correctionCaseFilterBreached: "فقط مهلت‌گذشته",
  correctionCaseFilterAll: "همه",
  correctionCaseAttachments: "پیوست‌ها",
  correctionCaseUpload: "بارگذاری پیوست",
  correctionCaseDownload: "دریافت",
  correctionCasePreview: "پیش‌نمایش",
  correctionCaseOutcomeLinks: "پیوندهای نتیجه",
  correctionCaseLinkOutcome: "افزودن پیوند نتیجه",
  correctionCaseEvidenceRefs: "مراجع شواهد",
  correctionCaseAddEvidence: "افزودن مرجع شواهد",
  correctionCasePendingPublicationHonesty:
    "پیوند انتظار انتشار — وقتی شناسهٔ انتشار تصمیم مشخص نیست؛ در صورت وجود شناسه، «انتشار گزارش تصمیم» را ترجیح دهید.",
  correctionCaseCancel: "انصراف",
  correctionCaseConfirm: "تأیید",
  correctionCaseDetail: "جزئیات پرونده",
  correctionCaseStatusOpen: "باز",
  correctionCaseStatusInProgress: "در حال رسیدگی",
  correctionCaseStatusPendingDecision: "در انتظار تصمیم",
  correctionCaseStatusApproved: "تأییدشده",
  correctionCaseStatusRejected: "ردشده",
  correctionCaseStatusConstrained: "محدودشده",
  correctionCaseStatusClosed: "بسته‌شده",
  correctionCaseStatusBreached: "مهلت گذشته",
  correctionCaseNoSelection: "یک پرونده را از فهرست انتخاب کنید.",
  correctionCaseAttachmentRejected: "پیوست رد شد؛ نوع یا محتوای مجاز نیست.",
  correctionCaseAttachmentQuarantined:
    "پیوست قرنطینه شد؛ پیش‌نمایش و دریافت تا بازبینی ممکن نیست.",
  correctionCaseAttachmentTooLarge: "حجم فایل از سقف مجاز بیشتر است.",
  correctionCaseInspectionAllowed: "مجاز",
  correctionCaseInspectionRejected: "ردشده",
  correctionCaseInspectionQuarantined: "قرنطینه",
  correctionCaseLinkPendingPublication: "انتظار انتشار (۷٫۶)",
  correctionCaseLinkPersonnelCorrection: "اصلاح رویداد پرسنلی",
  correctionCaseLinkDisposalRun: "اجرای امحا",
  correctionCaseLinkHold: "نگه‌داری قانونی",
  correctionCaseLinkRecalc: "همبستگی محاسبه مجدد",
  correctionCaseLinkResponseEvidence: "شواهد پاسخ",
  correctionCaseLinkPublishedArtifact: "آرتیفکت منتشرشده",
  correctionCaseLinkDecisionPublication: "انتشار گزارش تصمیم",
  correctionCaseEvidenceKindRequest: "درخواست",
  correctionCaseEvidenceKindResponse: "پاسخ",
  correctionCaseEvidenceKindInternal: "داخلی",
  correctionCaseEvidenceKindOther: "سایر",
  correctionCaseEvidenceUri: "مرجع/URI",
  correctionCaseCapabilitiesError: "بارگذاری مجوزهای اصلاح اطلاعات ممکن نشد.",
  /** Story 9.7 / 9.8 — profile + timeline contextual entry into correction cases. */
  profileCorrectionRequestCta: "ثبت درخواست اصلاح",
  profileCorrectionRequestDenied:
    "برای ثبت درخواست اصلاح به مجوز نوشتن پرونده اصلاح نیاز دارید.",
  profileEventFocusMissing:
    "رویداد در بازهٔ قابل نمایش نیست. در صورت نیاز «بارگذاری بیشتر» را بزنید یا از فهرست رویدادها باز کنید.",
  /** Story 9.8 — other governance contextual entries from person profile. */
  profileAccessManageCta: "مدیریت دسترسی‌ها",
  profileAccessManageHint:
    "اعطای نقش، محدوده و شکست‌شیشه روی حساب‌های کاربری در سطح دسترسی‌ها انجام می‌شود — نه از روی پروفایل فرد.",
  profileLifecycleManageCta: "نگهداری قانونی و حذف",
  profileLifecycleManageHint:
    "نگهداری قانونی حذف را مسدود می‌کند؛ مدیریت از فرهنگ‌دادهٔ پرسنلی است (پیش‌پر شدن فرد در این مسیر نیست).",
  accessSurfacePurpose:
    "چه کسی نقش، محدودهٔ سازمانی و دسترسی اضطراری را برای کدام حساب اعطا یا لغو می‌کند.",
  auditSurfacePurpose:
    "بازبین مستقل شواهد قابل‌انتساب را برای تحقیق فیلتر و جزئیات بررسی می‌کند.",
  operationsSurfacePurpose:
    "سلامت سرویس، صف بازمحاسبه و آرتیفکت‌های پرتاب برای SysAdmin — بدون مرور محتوای HR.",
  settingsSurfacePurpose:
    "پارامترهای حاکمیتی مجاز برای نقش شما — فقط مشاهده؛ تغییر در موج ویرایش بعدی.",
  settingsLoading: "در حال بارگذاری تنظیمات…",
  settingsLoadError: "بارگذاری تنظیمات ممکن نشد.",
  settingsStoreUnavailable:
    "مخزن تنظیمات در دسترس نبود؛ مقادیر پیش‌فرض کد نمایش داده می‌شوند.",
  settingsEmpty: "برای این بخش پارامتری ثبت نشده است.",
  settingsNeverChanged: "هنوز تغییری ثبت نشده",
  settingsSourceCodeDefault: "پیش‌فرض کد",
  settingsSourceStore: "ذخیرهٔ حاکمیتی",
  settingsSourceEnvironment: "محیط استقرار",
  settingsEditabilityAdmin: "قابل ویرایش توسط ادمین",
  settingsEditabilityReadOnly: "فقط‌خواندنی با مسیر تغییر",
  lifecycleHostPurpose:
    "نگهداری قانونی حذف را مسدود می‌کند؛ حذف فقط عملیاتی/خروجی است — نه پاک‌کردن ردیف ممیزی.",
  auditTrustReviewRequiresAuditor:
    "باز کردن این مسیر نیازمند نقش بازبین ممیزی است؛ SysAdmin به سطح ممیزی دسترسی ندارد.",
  publicationPublishCta: "انتشار به‌عنوان تصمیم رسمی",
  publicationPublishConfirm:
    "آیا این گزارش را به‌عنوان تصمیم سازمانی رسمی منتشر می‌کنید؟ محتوای تصمیم پس از انتشار بازنویسی نمی‌شود.",
  publicationListTitle: "انتشارهای گزارش تصمیم",
  publicationEmpty: "هنوز انتشاری برای این گزارش ثبت نشده است.",
  publicationLoadError: "بارگذاری انتشارها ممکن نشد.",
  publicationActionFailed: "انجام عملیات انتشار ممکن نشد.",
  publicationCapabilitiesError: "بارگذاری مجوزهای انتشار ممکن نشد.",
  publicationStatusPublished: "منتشرشده",
  publicationStatusSuperseded: "جایگزین / اصلاح‌شده",
  publicationStatusNonReproducible: "غیرقابل‌بازتولید پس از امحا",
  publicationStatusPackageRetained: "بستهٔ بازتولید نگهداری‌شده",
  publicationHasNoticeBadge: "دارای اعلان جایگزینی",
  publicationNotReproducible: "در حال حاضر قابل‌بازتولید نیست.",
  publicationReproduceForbidden: "بازتولید برای این انتشار مجاز نیست.",
  publicationNoticesTitle: "اعلان‌های جایگزینی / اصلاح",
  publicationNoticeKindCorrection: "اصلاح رویداد پرسنلی",
  publicationNoticeKindMetricPolicyChange: "تغییر نسخهٔ متریک/سیاست",
  publicationNoticeKindDisposal: "امحا",
  publicationNoticeKindSupersession: "جایگزینی",
  publicationPublishedAt: "زمان انتشار",
  publicationSnapshotHash: "هش اسنپ‌شات",
  publicationConfirmCancel: "انصراف",
  publicationConfirmProceed: "تأیید انتشار",
  launchArtifactHeading: "ثبت آرتیفکت‌های پرتاب",
  launchArtifactIntro:
    "نسخه‌های کنترل‌کننده، معافیت‌های FR-۵۵، تعارض‌ها و بازپایه — بدون فرض تقدم محلی.",
  launchArtifactLoadError: "بارگذاری ثبت آرتیفکت پرتاب ممکن نشد.",
  launchArtifactActionFailed: "انجام عملیات آرتیفکت پرتاب ممکن نشد.",
  launchArtifactCapabilitiesError: "بارگذاری مجوزهای آرتیفکت پرتاب ممکن نشد.",
  launchArtifactDenied: "دسترسی به ثبت آرتیفکت پرتاب ندارید.",
  launchArtifactEmptyInfraError:
    "ثبت آرتیفکت پرتاب خالی است؛ این وضعیت زیرساختی است نه «بدون مورد».",
  launchArtifactStatusPending: "در انتظار",
  launchArtifactStatusPartialFreeze: "انجماد جزئی",
  launchArtifactStatusApproved: "تأییدشده",
  launchArtifactStatusSuperseded: "جایگزین‌شده",
  launchArtifactStatusExpired: "منقضی",
  launchArtifactVersionDraft: "پیش‌نویس",
  launchArtifactHasVersion: "دارای نسخه",
  launchArtifactNoVersion: "بدون نسخهٔ کنترل‌کننده",
  launchArtifactSignalOpenWaivers: "معافیت باز",
  launchArtifactSignalOpenConflicts: "تعارض باز",
  launchArtifactSignalOpenRebaselines: "بازپایه باز",
  launchArtifactSignalExpired: "نسخهٔ منقضی",
  launchArtifactIssueWaiver: "صدور معافیت",
  launchArtifactOpenConflict: "ثبت تعارض",
  launchArtifactRequireRebaseline: "الزام بازپایه",
  launchArtifactApproveVersion: "تأیید نسخه",
  launchArtifactApproveRebaseline: "تأیید بازپایه",
  launchArtifactConflictsHeading: "تعارض‌های باز",
  launchArtifactRebaselinesHeading: "بازپایه‌های الزامی",
  launchArtifactWaiversHeading: "معافیت‌های باز",
  launchArtifactCloseWaiver: "بستن معافیت",
  launchArtifactResolveConflict: "حل تعارض",
  launchArtifactFieldClosureEvidence: "شواهد بستن",
  launchArtifactFieldResolutionVersions: "شناسه نسخه‌های حل (با ویرگول)",
  launchArtifactFieldJointApprover: "تأییدکننده مشترک",
  launchArtifactBadgeConflictOpen: "تعارض باز",
  launchArtifactBadgeRebaselineRequired: "نیاز به بازپایه",
  launchArtifactBadgeWaiverOpen: "معافیت باز",
  launchArtifactConfirmTitle: "تأیید عملیات حساس",
  launchArtifactConfirmBody:
    "این عمل نسخه یا بازپایه را تأیید می‌کند و قابل بازنویسی خاموش نیست.",
  launchArtifactConfirmCancel: "انصراف",
  launchArtifactConfirmProceed: "تأیید",
  launchArtifactSubmit: "ثبت",
  launchArtifactFieldArtifactId: "شناسهٔ آرتیفکت",
  launchArtifactFieldOwner: "مالک",
  launchArtifactFieldApprover: "تأییدکننده مستقل",
  launchArtifactFieldScope: "دامنه",
  launchArtifactFieldRisk: "ریسک",
  launchArtifactFieldCompensating: "کنترل جبرانی",
  launchArtifactFieldExpiry: "انقضا",
  launchArtifactFieldGate: "کد دروازه (اختیاری)",
  launchArtifactFieldChange: "خلاصهٔ تغییر",
  launchArtifactFieldImpact: "ارزیابی اثر",
  launchArtifactFieldRegressionRefs: "مراجع رگرسیون/پذیرش",
  launchArtifactFieldBuildRef: "مرجع ساخت",

  // Story 7.8 — evaluation snapshot integrity honesty (ops; no HR rows)
  evaluationSnapshotHonestyHeading: "صداقت اسنپ‌شات ارزیابی",
  evaluationSnapshotHonestyIntro:
    "شمارش توکن‌های اسنپ‌شات ارزیابی معتبر — بدون ردیف پرسنل. عدم تطابق در مسیرهای نهایی‌سازی، واردات، خروجی و انتشار با پیام فارسی مسدود می‌شود.",
  evaluationSnapshotLoading: "در حال بارگذاری وضعیت اسنپ‌شات ارزیابی…",
  evaluationSnapshotLoadError: "بارگذاری سیگنال اسنپ‌شات ارزیابی ممکن نشد.",
  evaluationSnapshotCapabilitiesError:
    "بررسی قابلیت اسنپ‌شات ارزیابی ممکن نشد.",
  evaluationSnapshotActionFailed: "عملیات اسنپ‌شات ارزیابی انجام نشد.",
  evaluationSnapshotDenied: "دسترسی به فرادادهٔ اسنپ‌شات ارزیابی ندارید.",
  evaluationSnapshotSignalActive: "فعال",
  evaluationSnapshotSignalConsumed: "مصرف‌شده",
  evaluationSnapshotSignalExpired: "منقضی",
  evaluationSnapshotMismatch:
    "اسنپ‌شات ارزیابی با نسخهٔ بازبینی‌شده هم‌خوان نیست.",
  evaluationSnapshotStale:
    "اسنپ‌شات ارزیابی کهنه شده است؛ عملیات را از ابتدا تکرار کنید.",
  evaluationSnapshotVersionMix:
    "نسخه‌های ارزیابی مخلوط شده‌اند؛ فیلتر یا مرتب‌سازی را از صفحهٔ اول از سر بگیرید.",
} as const;

/**
 * Stale/recalc banner — fact + scope (N) + consequence + expectation (Story 8.9).
 * Never embed a clock deadline. `N` rendered with Persian digits.
 * `null`/`undefined`/NaN → unknown-scope copy (no invented «۰ فرد»).
 */
export function staleRecalcMessage(
  affectedPersonCount: number | null | undefined,
): string {
  if (
    affectedPersonCount == null ||
    !Number.isFinite(affectedPersonCount)
  ) {
    return operationalCopy.staleRecalcUnknownScope;
  }
  const n = Math.max(0, Math.trunc(affectedPersonCount));
  const nFa = toPersianDigits(String(n));
  return `محاسبهٔ وضعیت جاری برای ${nFa} فرد هنوز کامل نشده — نهایی‌سازی رویداد و خروجی گرفتن برای این افراد موقتاً غیرفعال است. معمولاً چند دقیقه طول می‌کشد.`;
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
