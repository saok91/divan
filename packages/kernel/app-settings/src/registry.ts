/**
 * Typed governed settings registry (Story 10.1 / FR-60 / AD-7).
 * Code defaults are the fail-closed values. Unknown keys throw.
 */

import type {
  SettingsParameterDefinition,
  SettingsScalar,
} from "./types";

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
  for (const def of GOVERNED_SETTINGS_REGISTRY as readonly SettingsParameterDefinition[]) {
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
