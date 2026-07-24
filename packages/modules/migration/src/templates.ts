/**
 * Launch import template catalogue (Story 6.1).
 *
 * AR-MIGRATION-pluggable: provisional column contracts aligned to already-shipped
 * domain fields (Person / Employment / Assignment). Signed template freeze is
 * pending — unknown templates and header mismatches fail closed with Persian
 * explanation. Do not invent columns from AR-DATA open dispositions.
 */

export type ImportTemplateColumn = {
  /** Stable machine key used in row records and permission omit. */
  key: string;
  /** Exact header label expected in CSV/XLSX (Persian operational label). */
  headerFa: string;
  required: boolean;
  /** Data category hint for permission omit (never invent new categories). */
  dataCategory: string;
};

export type LaunchImportTemplate = {
  key: string;
  titleFa: string;
  /** Provisional — pending AR-MIGRATION freeze. */
  arMigrationStatus: "provisional-pending-freeze";
  columns: readonly ImportTemplateColumn[];
};

/**
 * Person identity + employment start assignment facts for launch migration.
 * IDs are UUID strings as already used in domain create/start payloads.
 */
export const LAUNCH_IMPORT_TEMPLATE_PERSON_EMPLOYMENT: LaunchImportTemplate = {
  key: "person_employment_start",
  titleFa: "هویت پرسنل و شروع اشتغال",
  arMigrationStatus: "provisional-pending-freeze",
  columns: [
    {
      key: "personnelCode",
      headerFa: "کد پرسنلی",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "givenName",
      headerFa: "نام",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "familyName",
      headerFa: "نام خانوادگی",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "mobilePhone",
      headerFa: "موبایل",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "fatherName",
      headerFa: "نام پدر",
      required: false,
      dataCategory: "identity.person",
    },
    {
      key: "birthDate",
      headerFa: "تاریخ تولد",
      required: false,
      dataCategory: "identity.person",
    },
    {
      key: "gender",
      headerFa: "جنسیت",
      required: false,
      dataCategory: "identity.person",
    },
    {
      key: "nationality",
      headerFa: "ملیت",
      required: false,
      dataCategory: "identity.person",
    },
    {
      key: "startDate",
      headerFa: "تاریخ شروع",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "collaborationType",
      headerFa: "نوع همکاری",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "teamId",
      headerFa: "شناسه تیم",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "organizationalRoleId",
      headerFa: "شناسه نقش سازمانی",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "jobTitleId",
      headerFa: "شناسه عنوان شغلی",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "ladderId",
      headerFa: "شناسه نردبان",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "gradeId",
      headerFa: "شناسه گرید",
      required: true,
      dataCategory: "identity.person",
    },
    {
      key: "seniorityId",
      headerFa: "شناسه ارشدیت",
      required: false,
      dataCategory: "identity.person",
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
