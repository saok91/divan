/**
 * Launch import template catalogue (Story 6.1 / 9.1).
 *
 * AR-MIGRATION-pluggable: provisional column contracts aligned to already-shipped
 * domain fields (Person / Employment / Assignment). Signed template freeze is
 * pending — unknown templates and header mismatches fail closed with Persian
 * explanation. Do not invent columns from AR-DATA open dispositions.
 *
 * Story 9.1 contract evolution: entity reference columns use **business codes**
 * (not UUIDs) in headers, keys, examples, and structural validation. Old
 * UUID-header workbooks fail closed intentionally — no silent dual accept.
 */

export type ImportTemplateColumn = {
  /** Stable machine key used in row records and permission omit. */
  key: string;
  /** Exact header label expected in CSV/XLSX (Persian operational label). */
  headerFa: string;
  required: boolean;
  /** Data category hint for permission omit (never invent new categories). */
  dataCategory: string;
  /** Documented example cell for sample workbook generation (Story 9.1). */
  exampleValue: string;
  /** Optional Persian hint for dates/enums/value shape. */
  valueFormatHintFa?: string;
};

export type LaunchImportTemplate = {
  key: string;
  titleFa: string;
  /** Operator-facing purpose (catalogue / sample lifecycle). */
  purposeFa: string;
  /**
   * Existing documented permission string required to use/download this template.
   * Prefer seeded keys (e.g. person.write) — do not invent AR-ACCESS SoD splits.
   */
  requiredPermission: string;
  /** Provisional — pending AR-MIGRATION freeze. */
  arMigrationStatus: "provisional-pending-freeze";
  columns: readonly ImportTemplateColumn[];
};

/**
 * Person identity + employment start assignment facts for launch migration.
 * Entity columns are business codes (Epic 8 identifier-first) — never UUIDs.
 */
export const LAUNCH_IMPORT_TEMPLATE_PERSON_EMPLOYMENT: LaunchImportTemplate = {
  key: "person_employment_start",
  titleFa: "هویت پرسنل و شروع اشتغال",
  purposeFa:
    "بارگذاری هویت پرسنل و حقایق شروع اشتغال برای مهاجرت کنترل‌شدهٔ راه‌اندازی.",
  requiredPermission: "person.write",
  arMigrationStatus: "provisional-pending-freeze",
  columns: [
    {
      key: "personnelCode",
      headerFa: "کد پرسنلی",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "P-100",
      valueFormatHintFa: "حروف/رقم و جداکننده‌های مجاز تا ۳۲ نویسه",
    },
    {
      key: "givenName",
      headerFa: "نام",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "نیلوفر",
    },
    {
      key: "familyName",
      headerFa: "نام خانوادگی",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "احمدی",
    },
    {
      key: "mobilePhone",
      headerFa: "موبایل",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "09121234567",
    },
    {
      key: "fatherName",
      headerFa: "نام پدر",
      required: false,
      dataCategory: "identity.person",
      exampleValue: "علی",
    },
    {
      key: "birthDate",
      headerFa: "تاریخ تولد",
      required: false,
      dataCategory: "identity.person",
      exampleValue: "1990-01-15",
      valueFormatHintFa: "تاریخ میلادی YYYY-MM-DD",
    },
    {
      key: "gender",
      headerFa: "جنسیت",
      required: false,
      dataCategory: "identity.person",
      exampleValue: "female",
      valueFormatHintFa: "male / female / other / unspecified",
    },
    {
      key: "nationality",
      headerFa: "ملیت",
      required: false,
      dataCategory: "identity.person",
      exampleValue: "IR",
    },
    {
      key: "startDate",
      headerFa: "تاریخ شروع",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "2026-03-01",
      valueFormatHintFa: "تاریخ میلادی YYYY-MM-DD",
    },
    {
      key: "collaborationType",
      headerFa: "نوع همکاری",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "employee",
      valueFormatHintFa: "employee / contractor / intern / consultant",
    },
    {
      key: "teamCode",
      headerFa: "کد تیم",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "TEAM-DEMO",
    },
    {
      key: "organizationalRoleCode",
      headerFa: "کد نقش سازمانی",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "ROLE-HR-SPEC",
    },
    {
      key: "jobTitleCode",
      headerFa: "کد عنوان شغلی",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "JT-HR-SPEC",
    },
    {
      key: "ladderCode",
      headerFa: "کد نردبان",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "LAD-DEMO",
    },
    {
      key: "gradeCode",
      headerFa: "کد گرید",
      required: true,
      dataCategory: "identity.person",
      exampleValue: "G-12",
    },
    {
      key: "seniorityCode",
      headerFa: "کد ارشدیت",
      required: false,
      dataCategory: "identity.person",
      exampleValue: "SEN-MID",
    },
  ],
};

export const LAUNCH_IMPORT_TEMPLATES: readonly LaunchImportTemplate[] = [
  LAUNCH_IMPORT_TEMPLATE_PERSON_EMPLOYMENT,
];

export const LAUNCH_IMPORT_TEMPLATE_KEYS = LAUNCH_IMPORT_TEMPLATES.map(
  (t) => t.key,
) as readonly string[];

export function isLaunchImportTemplateKey(key: string): boolean {
  return LAUNCH_IMPORT_TEMPLATES.some((t) => t.key === key);
}

/** Fail-closed catalogue accessor — always returns the provisional launch set. */
export function requireLaunchImportTemplateCatalogue(): readonly LaunchImportTemplate[] {
  if (LAUNCH_IMPORT_TEMPLATES.length === 0) {
    throw new Error("LAUNCH_IMPORT_TEMPLATES empty");
  }
  return LAUNCH_IMPORT_TEMPLATES;
}

export function getLaunchImportTemplate(
  key: string,
): LaunchImportTemplate | undefined {
  return LAUNCH_IMPORT_TEMPLATES.find((t) => t.key === key);
}

export function templateHeaderMap(
  template: LaunchImportTemplate,
): Map<string, ImportTemplateColumn> {
  const map = new Map<string, ImportTemplateColumn>();
  for (const col of template.columns) {
    map.set(col.headerFa.trim(), col);
  }
  return map;
}
