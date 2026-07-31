/**
 * Launch import template catalogue (Story 6.1 / 9.1 / 9.3).
 *
 * AR-MIGRATION-pluggable: provisional column contracts aligned to already-shipped
 * domain fields (Person / Employment / Assignment / PE / Headcount). Signed template
 * freeze is pending — unknown templates and header mismatches fail closed with
 * Persian explanation. Do not invent columns from AR-DATA open dispositions.
 *
 * Story 9.1 contract evolution: entity reference columns use **business codes**
 * (not UUIDs) in headers, keys, examples, and structural validation. Old
 * UUID-header workbooks fail closed intentionally — no silent dual accept.
 *
 * Story 9.3: section metadata + event/headcount day-to-day templates.
 */

/** Host section for shared bulk-entry tabs (Story 9.3). */
export type BulkEntrySection =
  | "personnel"
  | "personnel-events"
  | "headcount";

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
  /**
   * Bulk-entry host sections that may list this template (Story 9.3).
   * Denied templates for a section still show with accessRequirementFa.
   */
  sections: readonly BulkEntrySection[];
  /**
   * When true, template may appear on `/import` migration SoD wizard.
   * Day-to-day-only templates omit / false.
   */
  migrationSodEligible?: boolean;
  columns: readonly ImportTemplateColumn[];
};

/** Seeded data categories — do not invent AR-DATA strings. */
const CAT_PERSON = "identity.person";
const CAT_HEADCOUNT_APPROVAL = "organization.headcount_approval";

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
  sections: ["personnel"],
  migrationSodEligible: true,
  columns: [
    {
      key: "personnelCode",
      headerFa: "کد پرسنلی",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "P-100",
      valueFormatHintFa: "حروف/رقم و جداکننده‌های مجاز تا ۳۲ نویسه",
    },
    {
      key: "givenName",
      headerFa: "نام",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "نیلوفر",
    },
    {
      key: "familyName",
      headerFa: "نام خانوادگی",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "احمدی",
    },
    {
      key: "mobilePhone",
      headerFa: "موبایل",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "09121234567",
    },
    {
      key: "fatherName",
      headerFa: "نام پدر",
      required: false,
      dataCategory: CAT_PERSON,
      exampleValue: "علی",
    },
    {
      key: "birthDate",
      headerFa: "تاریخ تولد",
      required: false,
      dataCategory: CAT_PERSON,
      exampleValue: "1990-01-15",
      valueFormatHintFa: "تاریخ میلادی YYYY-MM-DD",
    },
    {
      key: "gender",
      headerFa: "جنسیت",
      required: false,
      dataCategory: CAT_PERSON,
      exampleValue: "female",
      valueFormatHintFa: "male / female / other / unspecified",
    },
    {
      key: "nationality",
      headerFa: "ملیت",
      required: false,
      dataCategory: CAT_PERSON,
      exampleValue: "IR",
    },
    {
      key: "startDate",
      headerFa: "تاریخ شروع",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "2026-03-01",
      valueFormatHintFa: "تاریخ میلادی YYYY-MM-DD",
    },
    {
      key: "collaborationType",
      headerFa: "نوع همکاری",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "employee",
      valueFormatHintFa: "employee / contractor / intern / consultant",
    },
    {
      key: "teamCode",
      headerFa: "کد تیم",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "TEAM-DEMO",
    },
    {
      key: "organizationalRoleCode",
      headerFa: "کد نقش سازمانی",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "ROLE-HR-SPEC",
    },
    {
      key: "jobTitleCode",
      headerFa: "کد عنوان شغلی",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "JT-HR-SPEC",
    },
    {
      key: "ladderCode",
      headerFa: "کد نردبان",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "LAD-DEMO",
    },
    {
      key: "gradeCode",
      headerFa: "کد گرید",
      required: true,
      dataCategory: CAT_PERSON,
      exampleValue: "G-12",
    },
    {
      key: "seniorityCode",
      headerFa: "کد ارشدیت",
      required: false,
      dataCategory: CAT_PERSON,
      exampleValue: "SEN-MID",
    },
  ],
};

/**
 * Day-to-day TransferRecorded bulk (Story 9.3).
 * Cutover: createDraft → finalizeDraft (product path). Permission = finalize.
 */
export const LAUNCH_IMPORT_TEMPLATE_PERSONNEL_EVENT_TRANSFER: LaunchImportTemplate =
  {
    key: "personnel_event_transfer",
    titleFa: "رویداد انتقال پرسنل",
    purposeFa:
      "ورود گروهی رویداد TransferRecorded با همان قواعد نهایی‌سازی تکی (تاریخ مؤثر، تعارض، ظرفیت).",
    requiredPermission: "personnel_event.finalize",
    arMigrationStatus: "provisional-pending-freeze",
    sections: ["personnel-events"],
    migrationSodEligible: false,
    columns: [
      {
        key: "personnelCode",
        headerFa: "کد پرسنلی",
        required: true,
        dataCategory: CAT_PERSON,
        exampleValue: "P-100",
        valueFormatHintFa: "حروف/رقم و جداکننده‌های مجاز تا ۳۲ نویسه",
      },
      {
        key: "effectiveDate",
        headerFa: "تاریخ مؤثر",
        required: true,
        dataCategory: CAT_PERSON,
        exampleValue: "2026-06-01",
        valueFormatHintFa: "تاریخ میلادی YYYY-MM-DD",
      },
      {
        key: "teamCode",
        headerFa: "کد تیم مقصد",
        required: true,
        dataCategory: CAT_PERSON,
        exampleValue: "TEAM-DEMO",
      },
      {
        key: "organizationalRoleCode",
        headerFa: "کد نقش سازمانی",
        required: true,
        dataCategory: CAT_PERSON,
        exampleValue: "ROLE-HR-SPEC",
      },
      {
        key: "jobTitleCode",
        headerFa: "کد عنوان شغلی",
        required: true,
        dataCategory: CAT_PERSON,
        exampleValue: "JT-HR-SPEC",
      },
      {
        key: "ladderCode",
        headerFa: "کد نردبان",
        required: true,
        dataCategory: CAT_PERSON,
        exampleValue: "LAD-DEMO",
      },
      {
        key: "gradeCode",
        headerFa: "کد گرید",
        required: true,
        dataCategory: CAT_PERSON,
        exampleValue: "G-12",
      },
      {
        key: "seniorityCode",
        headerFa: "کد ارشدیت",
        required: false,
        dataCategory: CAT_PERSON,
        exampleValue: "SEN-MID",
      },
      {
        key: "preferredApprovalCode",
        headerFa: "کد مجوز ظرفیت ترجیحی",
        required: false,
        dataCategory: CAT_HEADCOUNT_APPROVAL,
        exampleValue: "REQ-DEMO",
        valueFormatHintFa: "کد کسب‌وکار مجوز ظرفیت (نه UUID)",
      },
    ],
  };

/**
 * Day-to-day headcount approval create (+ activate at cutover) (Story 9.3).
 */
export const LAUNCH_IMPORT_TEMPLATE_HEADCOUNT_APPROVAL_CREATE: LaunchImportTemplate =
  {
    key: "headcount_approval_create",
    titleFa: "ایجاد مجوز ظرفیت",
    purposeFa:
      "ورود گروهی مجوز ظرفیت با قواعد تأیید Epic 4؛ پس از ایجاد، مجوز فعال می‌شود تا اسلات ظرفیت موجود باشد.",
    requiredPermission: "headcount.approval.write",
    arMigrationStatus: "provisional-pending-freeze",
    sections: ["headcount"],
    migrationSodEligible: false,
    columns: [
      {
        key: "requirementCode",
        headerFa: "کد نیازمندی",
        required: true,
        dataCategory: CAT_HEADCOUNT_APPROVAL,
        exampleValue: "REQ-100",
        valueFormatHintFa: "حروف/رقم و جداکننده‌های مجاز تا ۳۲ نویسه",
      },
      {
        key: "teamCode",
        headerFa: "کد تیم",
        required: true,
        dataCategory: CAT_HEADCOUNT_APPROVAL,
        exampleValue: "TEAM-DEMO",
      },
      {
        key: "jobTitleCode",
        headerFa: "کد عنوان شغلی",
        required: true,
        dataCategory: CAT_HEADCOUNT_APPROVAL,
        exampleValue: "JT-HR-SPEC",
      },
      {
        key: "seniorityCode",
        headerFa: "کد ارشدیت",
        required: false,
        dataCategory: CAT_HEADCOUNT_APPROVAL,
        exampleValue: "SEN-MID",
      },
      {
        key: "allowedCount",
        headerFa: "سقف مجاز",
        required: true,
        dataCategory: CAT_HEADCOUNT_APPROVAL,
        exampleValue: "2",
        valueFormatHintFa: "عدد صحیح غیرمنفی",
      },
      {
        key: "validityStart",
        headerFa: "شروع اعتبار",
        required: true,
        dataCategory: CAT_HEADCOUNT_APPROVAL,
        exampleValue: "2026-01-01",
        valueFormatHintFa: "تاریخ میلادی YYYY-MM-DD",
      },
      {
        key: "validityEndExclusive",
        headerFa: "پایان اعتبار (غیرشامل)",
        required: true,
        dataCategory: CAT_HEADCOUNT_APPROVAL,
        exampleValue: "2027-01-01",
        valueFormatHintFa: "تاریخ میلادی YYYY-MM-DD (غیرشامل)",
      },
      {
        key: "approvalReference",
        headerFa: "مرجع مجوز",
        required: false,
        dataCategory: CAT_HEADCOUNT_APPROVAL,
        exampleValue: "MEMO-2026-01",
      },
    ],
  };

export const LAUNCH_IMPORT_TEMPLATES: readonly LaunchImportTemplate[] = [
  LAUNCH_IMPORT_TEMPLATE_PERSON_EMPLOYMENT,
  LAUNCH_IMPORT_TEMPLATE_PERSONNEL_EVENT_TRANSFER,
  LAUNCH_IMPORT_TEMPLATE_HEADCOUNT_APPROVAL_CREATE,
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

/** Templates visible on a bulk-entry host section (includes denied — UI shows access). */
export function templatesForBulkSection(
  section: BulkEntrySection,
): readonly LaunchImportTemplate[] {
  return LAUNCH_IMPORT_TEMPLATES.filter((t) => t.sections.includes(section));
}

/** Templates eligible for `/import` migration SoD wizard. */
export function templatesForMigrationSod(): readonly LaunchImportTemplate[] {
  return LAUNCH_IMPORT_TEMPLATES.filter((t) => t.migrationSodEligible === true);
}

/** Data categories implied by template columns (permission omit / reveal). */
export function permittedDataCategoriesForTemplate(
  template: LaunchImportTemplate,
): Set<string> {
  return new Set(template.columns.map((c) => c.dataCategory));
}

/**
 * Single envelope dataCategory for authorize — first column category.
 * Fail closed if template has no columns.
 */
export function envelopeDataCategoryForTemplate(
  template: LaunchImportTemplate,
): string {
  const cat = template.columns[0]?.dataCategory?.trim();
  if (!cat) {
    throw new Error(`template ${template.key} has no dataCategory`);
  }
  return cat;
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
