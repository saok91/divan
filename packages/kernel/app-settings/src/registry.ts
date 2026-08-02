/**
 * Typed governed settings registry (Story 10.1 / FR-60 / AD-7).
 * Code defaults are the fail-closed values. Unknown keys throw.
 */

import type {
  SettingsParameterDefinition,
  SettingsScalar,
} from "./types";

/** Banned fragments for registry key / allowlist hygiene (Story 10.4). */
const BANNED_REGISTRY_SECRET_FRAGMENTS = [
  "password",
  "secret",
  "token",
  "private_key",
  "connection_string",
  "database_url",
  "bind_password",
  "tls_ca",
  "bind_dn",
] as const;

const CORRECTION_ATTACHMENT_ALLOWLIST = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "txt",
  "csv",
] as const;

/**
 * Wave-1 admin-editable parameters + read-only-with-evidence posture placeholders.
 * Defaults match pre-10.1 literals — do not invent new operational envelopes.
 */
export const GOVERNED_SETTINGS_REGISTRY = [
  {
    key: "import.max_file_bytes",
    labelFa: "حداکثر حجم فایل ورود",
    descriptionFa: "سقف بایت برای هر فایل پیش‌نمایش/ورود گروهی.",
    valueType: "number",
    unitFa: "بایت",
    range: { min: 1, max: 50 * 1024 * 1024 },
    allowlist: null,
    defaultValue: 5 * 1024 * 1024,
    editability: "admin_editable",
    owningDomain: "import_export",
    changePathFa: null,
    highImpact: true,
    blastRadiusFa: "فایل‌های بزرگ‌تر مصرف حافظه و زمان پارس را افزایش می‌دهند.",
    boundaryClass: "operational",
  },
  {
    key: "import.max_data_rows",
    labelFa: "حداکثر ردیف داده ورود",
    descriptionFa: "سقف ردیف‌های داده (بدون هدر) در یک فایل ورود.",
    valueType: "number",
    unitFa: "ردیف",
    range: { min: 1, max: 100_000 },
    allowlist: null,
    defaultValue: 5_000,
    editability: "admin_editable",
    owningDomain: "import_export",
    changePathFa: null,
    highImpact: true,
    blastRadiusFa: "افزایش سقف، بار پردازش و زمان پیش‌نمایش را بالا می‌برد.",
    boundaryClass: "operational",
  },
  {
    key: "import.max_drafts_global",
    labelFa: "سقف پیش‌نویس‌های ورود (سراسری)",
    descriptionFa: "حداکثر پیش‌نویس‌های همزمان در کل سامانه.",
    valueType: "number",
    unitFa: "عدد",
    range: { min: 1, max: 500 },
    allowlist: null,
    defaultValue: 50,
    editability: "admin_editable",
    owningDomain: "import_export",
    changePathFa: null,
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "operational",
  },
  {
    key: "import.max_drafts_per_actor",
    labelFa: "سقف پیش‌نویس ورود برای هر عامل",
    descriptionFa: "حداکثر پیش‌نویس همزمان برای یک حساب.",
    valueType: "number",
    unitFa: "عدد",
    range: { min: 1, max: 50 },
    allowlist: null,
    defaultValue: 5,
    editability: "admin_editable",
    owningDomain: "import_export",
    changePathFa: null,
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "operational",
  },
  {
    key: "import.draft_ttl_ms",
    labelFa: "عمر پیش‌نویس ورود",
    descriptionFa: "مدت نگهداری پیش‌نویس ورود قبل از انقضا.",
    valueType: "duration_ms",
    unitFa: "میلی‌ثانیه",
    range: { min: 60_000, max: 7 * 24 * 60 * 60 * 1000 },
    allowlist: null,
    defaultValue: 60 * 60 * 1000,
    editability: "admin_editable",
    owningDomain: "import_export",
    changePathFa: null,
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "operational",
  },
  {
    key: "export.artifact_ttl_ms",
    labelFa: "عمر فایل خروجی",
    descriptionFa: "مدت دسترسی به artifact خروجی قبل از انقضا.",
    valueType: "duration_ms",
    unitFa: "میلی‌ثانیه",
    range: { min: 60_000, max: 7 * 24 * 60 * 60 * 1000 },
    allowlist: null,
    defaultValue: 4 * 60 * 60 * 1000,
    editability: "admin_editable",
    owningDomain: "import_export",
    changePathFa: null,
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "operational",
  },
  {
    key: "export.custody_bulk_row_threshold",
    labelFa: "آستانه حضانت خروجی حجیم",
    descriptionFa: "از این تعداد ردیف به بالا مسیر حضانت خروجی حجیم اعمال می‌شود.",
    valueType: "number",
    unitFa: "ردیف",
    range: { min: 1, max: 25 },
    allowlist: null,
    defaultValue: 25,
    editability: "read_only_with_evidence",
    owningDomain: "import_export",
    changePathFa:
      "تغییر آستانه حضانت خروجی فقط از مسیر استقرار/تغییر کد با شواهد FR42؛ ویرایش ادمین باز نیست تا مرز export شل نشود.",
    highImpact: true,
    blastRadiusFa: "بالا بردن آستانه الزام حضانت را برای خروجی‌های بزرگ‌تر برمی‌دارد.",
    boundaryClass: "operational",
  },
  {
    key: "list.personnel_max_rows",
    labelFa: "سقف ردیف فهرست پرسنل",
    descriptionFa: "حداکثر ردیف قابل بازگردانی در پروجکشن فهرست پرسنل.",
    valueType: "number",
    unitFa: "ردیف",
    range: { min: 1, max: 5_000 },
    allowlist: null,
    defaultValue: 500,
    editability: "admin_editable",
    owningDomain: "general_display",
    changePathFa: null,
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "operational",
  },
  {
    key: "list.search_page_size_default",
    labelFa: "اندازه صفحه پیش‌فرض جستجوی پرسنل",
    descriptionFa: "تعداد ردیف پیش‌فرض هر صفحه در جستجوی محدودهٔ پرسنل.",
    valueType: "number",
    unitFa: "ردیف",
    range: { min: 1, max: 500 },
    allowlist: null,
    defaultValue: 50,
    editability: "admin_editable",
    owningDomain: "general_display",
    changePathFa: null,
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "operational",
  },
  {
    key: "list.search_page_size_max",
    labelFa: "حداکثر اندازه صفحه جستجوی پرسنل",
    descriptionFa: "سقف اندازه صفحه درخواستی برای جستجوی پرسنل.",
    valueType: "number",
    unitFa: "ردیف",
    range: { min: 1, max: 500 },
    allowlist: null,
    defaultValue: 100,
    editability: "admin_editable",
    owningDomain: "general_display",
    changePathFa: null,
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "operational",
  },
  {
    key: "headcount.reservation_expiry_warning_days",
    labelFa: "هشدار انقضای رزرو هدکانت",
    descriptionFa: "چند روز قبل از انقضای رزرو هشدار نمایش داده شود.",
    valueType: "number",
    unitFa: "روز",
    range: { min: 1, max: 365 },
    allowlist: null,
    defaultValue: 14,
    editability: "admin_editable",
    owningDomain: "capacity_hiring",
    changePathFa: null,
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "operational",
  },
  {
    key: "correction.attachment_max_bytes",
    labelFa: "حداکثر حجم پیوست اصلاح",
    descriptionFa: "سقف بایت برای هر پیوست پرونده اصلاح (موقت تا انجماد AR-DATA).",
    valueType: "number",
    unitFa: "بایت",
    range: { min: 1, max: 20 * 1024 * 1024 },
    allowlist: null,
    defaultValue: 1_048_576,
    editability: "admin_editable",
    owningDomain: "data_retention",
    changePathFa: null,
    highImpact: true,
    blastRadiusFa: "افزایش سقف فضای ذخیره‌سازی و بار آپلود را بالا می‌برد.",
    boundaryClass: "operational",
  },
  {
    key: "correction.attachment_max_per_case",
    labelFa: "حداکثر تعداد پیوست در هر پرونده اصلاح",
    descriptionFa: "سقف تعداد فایل پیوست برای یک پرونده اصلاح.",
    valueType: "number",
    unitFa: "عدد",
    range: { min: 1, max: 100 },
    allowlist: null,
    defaultValue: 10,
    editability: "admin_editable",
    owningDomain: "data_retention",
    changePathFa: null,
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "operational",
  },
  {
    key: "correction.attachment_allowlist",
    labelFa: "پسوندهای مجاز پیوست اصلاح",
    descriptionFa: "فهرست پسوندهای مجاز برای پیوست پرونده اصلاح (بدون رندر secret).",
    valueType: "string_list",
    unitFa: null,
    range: null,
    allowlist: [...CORRECTION_ATTACHMENT_ALLOWLIST],
    defaultValue: [...CORRECTION_ATTACHMENT_ALLOWLIST],
    editability: "admin_editable",
    owningDomain: "data_retention",
    changePathFa: null,
    highImpact: true,
    blastRadiusFa: "گسترش allowlist انواع فایل قابل پذیرش را تغییر می‌دهد؛ انواع اجرایی ممنوع می‌مانند.",
    boundaryClass: "operational",
  },
  {
    key: "entitlement.recert_window_ms",
    labelFa: "پنجرهٔ بازتأیید entitlement",
    descriptionFa: "مدت پیش‌فرض پنجرهٔ recertification برای entitlement.",
    valueType: "duration_ms",
    unitFa: "میلی‌ثانیه",
    range: { min: 24 * 60 * 60 * 1000, max: 365 * 24 * 60 * 60 * 1000 },
    allowlist: null,
    defaultValue: 30 * 24 * 60 * 60 * 1000,
    editability: "admin_editable",
    owningDomain: "access_session",
    changePathFa: null,
    highImpact: true,
    blastRadiusFa: "کوتاه‌کردن پنجره تناوب بازتأیید دسترسی را افزایش می‌دهد.",
    boundaryClass: "operational",
  },
  // --- Read-only-with-evidence placeholders (10.4 shape proof; non-secret) ---
  {
    key: "session.idle_timeout_seconds",
    labelFa: "مهلت بی‌فعالیتی نشست",
    descriptionFa:
      "مهلت idle نشست — مدیریت‌شده با استقرار؛ فقط شواهد تغییر مسیر (بدون secret).",
    valueType: "number",
    unitFa: "ثانیه",
    range: { min: 60, max: 7 * 24 * 60 * 60 },
    allowlist: null,
    defaultValue: 8 * 60 * 60,
    editability: "read_only_with_evidence",
    owningDomain: "access_session",
    changePathFa:
      "تغییر از طریق متغیر AUTH_SESSION_IDLE_TIMEOUT_SECONDS در استقرار Infra؛ بدون ویرایش ادمین در سامانه.",
    highImpact: true,
    blastRadiusFa: "کوتاه‌کردن idle نشست‌های فعال را زودتر منقضی می‌کند.",
    boundaryClass: "security_posture",
  },
  {
    key: "session.absolute_timeout_seconds",
    labelFa: "مهلت مطلق نشست",
    descriptionFa:
      "مهلت مطلق نشست — مدیریت‌شده با استقرار؛ فقط شواهد تغییر مسیر.",
    valueType: "number",
    unitFa: "ثانیه",
    range: { min: 60, max: 14 * 24 * 60 * 60 },
    allowlist: null,
    defaultValue: 24 * 60 * 60,
    editability: "read_only_with_evidence",
    owningDomain: "access_session",
    changePathFa:
      "تغییر از طریق متغیر AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS در استقرار Infra؛ بدون ویرایش ادمین در سامانه.",
    highImpact: true,
    blastRadiusFa: "کوتاه‌کردن absolute همه نشست‌ها را زودتر قطع می‌کند.",
    boundaryClass: "security_posture",
  },
  {
    key: "identity.provider_mode",
    labelFa: "حالت ارائه‌دهنده هویت",
    descriptionFa:
      "حالت موثر ارائه‌دهنده هویت (seeded|ldap) — بدون افشای secret اتصال.",
    valueType: "string",
    unitFa: null,
    range: null,
    allowlist: ["seeded", "ldap"],
    defaultValue: "seeded",
    editability: "read_only_with_evidence",
    owningDomain: "infrastructure",
    changePathFa:
      "تغییر از طریق IDENTITY_PROVIDER در استقرار Infra/AR-IDENTITY؛ ادمین اپلیکیشن ویرایش نمی‌کند.",
    highImpact: true,
    blastRadiusFa: "جابه‌جایی حالت هویت مسیر ورود و وابستگی به LDAP را عوض می‌کند.",
    boundaryClass: "security_posture",
  },
  // --- Story 10.4 RO infrastructure / security inventory (non-secret) ---
  {
    key: "identity.ldap_configured",
    labelFa: "پیکربندی LDAP",
    descriptionFa:
      "آیا متغیرهای لازم LDAP برای اتصال تنظیم شده‌اند (بدون نمایش URL/رمز).",
    valueType: "boolean",
    unitFa: null,
    range: null,
    allowlist: null,
    defaultValue: false,
    editability: "read_only_with_evidence",
    owningDomain: "infrastructure",
    changePathFa:
      "فقط با استقرار Infra و تنظیم متغیرهای LDAP؛ از این سطح قابل تغییر نیست.",
    highImpact: true,
    blastRadiusFa: "فعال‌سازی LDAP مسیر احراز هویت را وابسته به دایرکتوری می‌کند.",
    boundaryClass: "security_posture",
  },
  {
    key: "identity.ldap_url_scheme",
    labelFa: "طرح URL دایرکتوری LDAP",
    descriptionFa: "فقط طرح اتصال (ldap|ldaps|unset) — بدون افشای میزبان یا اعتبارنامه.",
    valueType: "string",
    unitFa: null,
    range: null,
    allowlist: ["ldap", "ldaps", "unset"],
    defaultValue: "unset",
    editability: "read_only_with_evidence",
    owningDomain: "infrastructure",
    changePathFa:
      "تغییر طرح از طریق LDAP_URL در استقرار Infra؛ ادمین اپلیکیشن ویرایش نمی‌کند.",
    highImpact: true,
    blastRadiusFa: "جابه‌جایی ldap↔ldaps الزامات TLS را عوض می‌کند.",
    boundaryClass: "security_posture",
  },
  {
    key: "identity.ldap_tls_reject_unauthorized",
    labelFa: "رد گواهی TLS نامعتبر LDAP",
    descriptionFa:
      "وضعیت rejectUnauthorized برای TLS دایرکتوری (پیش‌فرض true مگر صریحاً false).",
    valueType: "boolean",
    unitFa: null,
    range: null,
    allowlist: null,
    defaultValue: true,
    editability: "read_only_with_evidence",
    owningDomain: "infrastructure",
    changePathFa:
      "تغییر از طریق LDAP_TLS_REJECT_UNAUTHORIZED در استقرار Infra؛ بدون ویرایش ادمین.",
    highImpact: true,
    blastRadiusFa: "خاموش کردن رد گواهی نامعتبر سطح اعتماد TLS را کاهش می‌دهد.",
    boundaryClass: "security_posture",
  },
  {
    key: "identity.ldap_connect_timeout_ms",
    labelFa: "مهلت اتصال LDAP",
    descriptionFa: "مهلت اتصال به دایرکتوری بر حسب میلی‌ثانیه.",
    valueType: "number",
    unitFa: "میلی‌ثانیه",
    range: { min: 100, max: 120_000 },
    allowlist: null,
    defaultValue: 10_000,
    editability: "read_only_with_evidence",
    owningDomain: "infrastructure",
    changePathFa:
      "تغییر از طریق LDAP_CONNECT_TIMEOUT_MS در استقرار Infra؛ بدون ویرایش ادمین.",
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "security_posture",
  },
  {
    key: "identity.ldap_create_mapping_mode",
    labelFa: "حالت نگاشت ایجاد حساب LDAP",
    descriptionFa:
      "آیا نگاشت create-on-first-login پیکربندی شده (forbidden|mapped) — بدون افشای محتوا.",
    valueType: "string",
    unitFa: null,
    range: null,
    allowlist: ["forbidden", "mapped"],
    defaultValue: "forbidden",
    editability: "read_only_with_evidence",
    owningDomain: "infrastructure",
    changePathFa:
      "تغییر از طریق LDAP_CREATE_MAPPING_JSON در استقرار Infra؛ بدون ویرایش ادمین.",
    highImpact: true,
    blastRadiusFa: "فعال‌سازی mapped اجازهٔ ایجاد حساب هنگام اولین ورود را می‌دهد.",
    boundaryClass: "security_posture",
  },
  {
    key: "audit.inference_bulk_enabled",
    labelFa: "فعال بودن کنترل حجم استنتاج",
    descriptionFa:
      "وضعیت موثر قلاب‌های inference/bulk (موقت DEMO تا انجماد AR-ACCESS) — نه مبنای پرتاب.",
    valueType: "boolean",
    unitFa: null,
    range: null,
    allowlist: null,
    defaultValue: true,
    editability: "read_only_with_evidence",
    owningDomain: "audit_integrity",
    changePathFa:
      "تغییر از طریق AUDIT_INFERENCE_BULK_ENABLED و NODE_ENV در استقرار؛ فقط با استقرار قابل تغییر است.",
    highImpact: true,
    blastRadiusFa: "خاموش کردن قلاب‌ها مسیرهای حفاظت‌شده را fail-closed می‌کند.",
    boundaryClass: "security_posture",
  },
  {
    key: "audit.inference_bulk_min_cohort",
    labelFa: "حداقل اندازهٔ هم‌گروه استنتاج",
    descriptionFa:
      "آستانهٔ DEMO/DISABLED برای small-cohort — مقادیر انجماد AR-REPORTING نیست.",
    valueType: "number",
    unitFa: "عدد",
    range: { min: 0, max: Number.MAX_SAFE_INTEGER },
    allowlist: null,
    defaultValue: 3,
    editability: "read_only_with_evidence",
    owningDomain: "audit_integrity",
    changePathFa:
      "آستانه‌ها فقط با استقرار/انتشار کد قلاب‌های audit-envelope تغییر می‌کنند.",
    highImpact: true,
    blastRadiusFa: "کاهش آستانه سرکوب هم‌گروه کوچک را شل می‌کند.",
    boundaryClass: "security_posture",
  },
  {
    key: "audit.inference_bulk_max_volume_per_request",
    labelFa: "سقف حجم درخواست استنتاج",
    descriptionFa: "سقف DEMO/DISABLED حجم در هر درخواست — نه عدد انجماد AR-ACCESS.",
    valueType: "number",
    unitFa: "عدد",
    range: { min: 0, max: 1_000_000 },
    allowlist: null,
    defaultValue: 10,
    editability: "read_only_with_evidence",
    owningDomain: "audit_integrity",
    changePathFa:
      "آستانه‌ها فقط با استقرار/انتشار کد قلاب‌های audit-envelope تغییر می‌کنند.",
    highImpact: true,
    blastRadiusFa: null,
    boundaryClass: "security_posture",
  },
  {
    key: "audit.inference_bulk_max_volume_per_window",
    labelFa: "سقف حجم پنجرهٔ استنتاج",
    descriptionFa: "سقف DEMO/DISABLED حجم در پنجرهٔ زمانی — نه عدد انجماد AR-ACCESS.",
    valueType: "number",
    unitFa: "عدد",
    range: { min: 0, max: 1_000_000 },
    allowlist: null,
    defaultValue: 20,
    editability: "read_only_with_evidence",
    owningDomain: "audit_integrity",
    changePathFa:
      "آستانه‌ها فقط با استقرار/انتشار کد قلاب‌های audit-envelope تغییر می‌کنند.",
    highImpact: true,
    blastRadiusFa: null,
    boundaryClass: "security_posture",
  },
  {
    key: "audit.trust_enforce",
    labelFa: "اجبار پیکربندی اعتماد ممیزی",
    descriptionFa:
      "اگر فعال باشد، نبود آستانه‌های اعتماد fail-closed است (موقت تا انجماد AR-AUDIT).",
    valueType: "boolean",
    unitFa: null,
    range: null,
    allowlist: null,
    defaultValue: false,
    editability: "read_only_with_evidence",
    owningDomain: "audit_integrity",
    changePathFa:
      "تغییر از طریق DIVAN_AUDIT_TRUST_ENFORCE در استقرار Infra؛ فقط با استقرار قابل تغییر است.",
    highImpact: true,
    blastRadiusFa: "فعال‌سازی enforce بدون knobs کامل سامانه را fail-closed می‌کند.",
    boundaryClass: "security_posture",
  },
  {
    key: "audit.trust_max_clock_skew_ms",
    labelFa: "حداکثر انحراف ساعت اعتماد ممیزی",
    descriptionFa: "حد |ساعت اپ − ساعت DB| قبل از ناهنجاری ساعت (موقت).",
    valueType: "number",
    unitFa: "میلی‌ثانیه",
    range: { min: 1, max: 24 * 60 * 60 * 1000 },
    allowlist: null,
    defaultValue: 120_000,
    editability: "read_only_with_evidence",
    owningDomain: "audit_integrity",
    changePathFa:
      "تغییر از طریق DIVAN_AUDIT_TRUST_MAX_CLOCK_SKEW_MS در استقرار؛ بدون ویرایش ادمین.",
    highImpact: true,
    blastRadiusFa: null,
    boundaryClass: "security_posture",
  },
  {
    key: "audit.trust_verification_window_hours",
    labelFa: "پنجرهٔ تأیید یکپارچگی ممیزی",
    descriptionFa: "پنجرهٔ lookback تأیید یکپارچگی بر حسب ساعت (موقت).",
    valueType: "number",
    unitFa: "ساعت",
    range: { min: 1, max: 24 * 30 },
    allowlist: null,
    defaultValue: 24,
    editability: "read_only_with_evidence",
    owningDomain: "audit_integrity",
    changePathFa:
      "تغییر از طریق DIVAN_AUDIT_TRUST_VERIFICATION_WINDOW_HOURS در استقرار؛ بدون ویرایش ادمین.",
    highImpact: true,
    blastRadiusFa: null,
    boundaryClass: "security_posture",
  },
  {
    key: "audit.trust_suspend_ttl_ms",
    labelFa: "عمر تعلیق اعتماد ممیزی",
    descriptionFa:
      "TTL تعلیق خودکار؛ ۰ یعنی بدون انقضای خودکار (معادل none).",
    valueType: "number",
    unitFa: "میلی‌ثانیه",
    range: { min: 0, max: 30 * 24 * 60 * 60 * 1000 },
    allowlist: null,
    defaultValue: 0,
    editability: "read_only_with_evidence",
    owningDomain: "audit_integrity",
    changePathFa:
      "تغییر از طریق DIVAN_AUDIT_TRUST_SUSPEND_TTL_MS در استقرار؛ بدون ویرایش ادمین.",
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "security_posture",
  },
  {
    key: "audit.envelope_category_count",
    labelFa: "تعداد دستهٔ ثبت‌شدهٔ پاکت ممیزی",
    descriptionFa:
      "تعداد شناسه‌های دسته در رجیستری کد (وضعیت مسیر دسته — بدون ویرایش موازی).",
    valueType: "number",
    unitFa: "عدد",
    range: { min: 0, max: 10_000 },
    allowlist: null,
    defaultValue: 25,
    editability: "read_only_with_evidence",
    owningDomain: "audit_integrity",
    changePathFa:
      "فقط با استقرار/انتشار کد categories در audit-envelope قابل تغییر است.",
    highImpact: false,
    blastRadiusFa: null,
    boundaryClass: "security_posture",
  },
  {
    key: "infra.pg_pool_max",
    labelFa: "حداکثر اتصال استخر Postgres",
    descriptionFa:
      "سقف اتصال استخر اشتراکی pg — بدون نمایش رشتهٔ اتصال. بدون DIVAN_PG_POOL_MAX مقدار مؤثر در توسعه ۵ و در تولید ۱۰ است (هم‌تراز defaultPoolMax).",
    valueType: "number",
    unitFa: "اتصال",
    range: { min: 1, max: 200 },
    allowlist: null,
    defaultValue: 5,
    editability: "read_only_with_evidence",
    owningDomain: "infrastructure",
    changePathFa:
      "تغییر از طریق DIVAN_PG_POOL_MAX در استقرار Infra و راه‌اندازی مجدد فرایند؛ بدون ویرایش ادمین.",
    highImpact: true,
    blastRadiusFa: "افزایش سقف فشار روی max_connections پایگاه را بالا می‌برد.",
    boundaryClass: "operational",
  },
  {
    key: "infra.baseline_boundary_date",
    labelFa: "تاریخ مرز Baseline",
    descriptionFa:
      "تاریخ فقط‌روز مرز Baseline؛ unset یعنی پیکربندی نشده (بدون epoch جعلی).",
    valueType: "string",
    unitFa: null,
    range: null,
    allowlist: null,
    defaultValue: "unset",
    editability: "read_only_with_evidence",
    owningDomain: "infrastructure",
    changePathFa:
      "تغییر از طریق DIVAN_BASELINE_BOUNDARY_DATE در استقرار Infra؛ بدون ویرایش ادمین.",
    highImpact: true,
    blastRadiusFa: "جابه‌جایی مرز سیاست تداخل رویدادهای پیش از مرز را عوض می‌کند.",
    boundaryClass: "operational",
  },
] as const satisfies readonly SettingsParameterDefinition[];

export type GovernedSettingsKey =
  (typeof GOVERNED_SETTINGS_REGISTRY)[number]["key"];

const BY_KEY = new Map<string, SettingsParameterDefinition>(
  GOVERNED_SETTINGS_REGISTRY.map((d) => [d.key, d]),
);

export class GovernedSettingsError extends Error {
  readonly code: "SETTINGS_UNKNOWN_KEY" | "SETTINGS_INVALID_DEFINITION";
  readonly messageFa: string;

  constructor(
    code: "SETTINGS_UNKNOWN_KEY" | "SETTINGS_INVALID_DEFINITION",
    messageFa: string,
  ) {
    super(code);
    this.name = "GovernedSettingsError";
    this.code = code;
    this.messageFa = messageFa;
  }
}

export function requireGovernedSettingsRegistry(): readonly SettingsParameterDefinition[] {
  const defs =
    GOVERNED_SETTINGS_REGISTRY as readonly SettingsParameterDefinition[];
  for (const def of defs) {
    if (
      def.editability === "read_only_with_evidence" &&
      (def.changePathFa == null || def.changePathFa.trim() === "")
    ) {
      throw new GovernedSettingsError(
        "SETTINGS_INVALID_DEFINITION",
        `پارامتر فقط‌خواندنی بدون مسیر تغییر: ${def.key}`,
      );
    }
    if (
      def.boundaryClass === "security_posture" &&
      def.editability !== "read_only_with_evidence"
    ) {
      throw new GovernedSettingsError(
        "SETTINGS_INVALID_DEFINITION",
        `پارامتر امنیتی باید فقط‌خواندنی باشد: ${def.key}`,
      );
    }
    const keyLower = def.key.toLowerCase();
    if (BANNED_REGISTRY_SECRET_FRAGMENTS.some((f) => keyLower.includes(f))) {
      throw new GovernedSettingsError(
        "SETTINGS_INVALID_DEFINITION",
        `کلید شبیه secret در رجیستری: ${def.key}`,
      );
    }
    if (def.allowlist) {
      for (const item of def.allowlist) {
        if (/PASSWORD|SECRET|DATABASE_URL|LDAP_TLS_CA|LDAP_BIND_PASSWORD/i.test(item)) {
          throw new GovernedSettingsError(
            "SETTINGS_INVALID_DEFINITION",
            `allowlist شبیه secret برای ${def.key}`,
          );
        }
      }
    }
  }
  return GOVERNED_SETTINGS_REGISTRY;
}

export function getSettingsParameter(
  key: string,
): SettingsParameterDefinition {
  const def = BY_KEY.get(key);
  if (!def) {
    throw new GovernedSettingsError(
      "SETTINGS_UNKNOWN_KEY",
      `پارامتر تنظیمات ناشناخته است: ${key}`,
    );
  }
  return def;
}

export function listGovernedSettingsKeys(): readonly string[] {
  return GOVERNED_SETTINGS_REGISTRY.map((d) => d.key);
}

export function listAdminEditableKeys(): readonly string[] {
  return GOVERNED_SETTINGS_REGISTRY.filter(
    (d) => d.editability === "admin_editable",
  ).map((d) => d.key);
}

export function isGovernedSettingsKey(key: string): key is GovernedSettingsKey {
  return BY_KEY.has(key);
}

export function getCodeDefault(key: string): SettingsScalar {
  return getSettingsParameter(key).defaultValue;
}
