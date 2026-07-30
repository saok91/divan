/**
 * Data Dictionary types + field↔element maps (Story 3.3 / FR-7).
 * Registry governs enablement; Person columns hold MVP approve values (not EAV).
 *
 * Story 7.7: default foreshadow string binds to AR-DATA partial freeze;
 * runtime resolver may override via Launch Artifact Register when present.
 */

/** @provisional-pending-AR-DATA-freeze — foreshadow; prefer register controlling version */
export const DATA_DICTIONARY_REGISTRY_VERSION =
  "ar-data-partial-freeze-2026-07-16";

/**
 * Bind dictionary registryVersion to AR-DATA controlling version when registered.
 * Fail-closed incomplete when enforcement flag is on and unresolved.
 */
export function bindDataDictionaryRegistryVersion(
  controllingVersionLabel: string | null | undefined,
  opts?: { enforce?: boolean },
): string {
  const label = controllingVersionLabel?.trim() ?? "";
  if (label) return label;
  if (opts?.enforce) {
    throw new Error("CONTROLLING_VERSION_UNRESOLVED:AR-DATA");
  }
  return DATA_DICTIONARY_REGISTRY_VERSION;
}

export type DataElementDisposition = "approve" | "later" | "reject";

/** Mandatory metadata keys before enablement (FR-7 / AC #2). */
export const DATA_ELEMENT_MANDATORY_METADATA = [
  "purpose",
  "ownerSource",
  "format",
  "sensitivity",
  "access",
  "retention",
  "export",
  "audit",
] as const;

export type DataElementMandatoryMetaKey =
  (typeof DATA_ELEMENT_MANDATORY_METADATA)[number];

export type DataElementRecord = {
  elementId: string;
  disposition: DataElementDisposition;
  enabled: boolean;
  purpose: string | null;
  ownerSource: string | null;
  format: string | null;
  sensitivity: string | null;
  access: string | null;
  retention: string | null;
  export: string | null;
  audit: string | null;
  categoryId: string | null;
  freeTextPurpose: string | null;
  lineage: string | null;
  personFieldKey: string | null;
  labelFa: string;
  registryVersion: string;
};

/** Person column keys governed by the dictionary for MVP. */
export type PersonProfileFieldKey =
  | "personnelCode"
  | "givenName"
  | "familyName"
  | "mobilePhone"
  | "fatherName"
  | "birthDate"
  | "gender"
  | "nationality"
  | "nationalId";

/** Stable elementId → Person field (approve set). */
export const ELEMENT_ID = {
  personnelCode: "person.personnel_code",
  givenName: "person.given_name",
  familyName: "person.family_name",
  fatherName: "person.father_name",
  birthDate: "person.birth_date",
  gender: "person.gender",
  nationality: "person.nationality",
  nationalId: "person.national_id",
  mobilePhone: "person.mobile_phone",
  birthCertificate: "person.birth_certificate_number",
  birthPlace: "person.birth_place",
  birthCertIssuePlace: "person.birth_certificate_issue_place",
  religion: "person.religion",
  militaryService: "person.military_service_status",
  landline: "person.landline",
  personalEmail: "person.personal_email",
  organizationalEmail: "person.organizational_email",
  residentialAddress: "person.residential_address",
  postalCode: "person.postal_code",
  workLocation: "person.work_location",
  family: "person.family",
  education: "person.education",
  bank: "person.bank",
  insurance: "person.insurance",
  health: "person.health",
  // Compensation / contractual candidates (Story 3.4) — disposition later until AR-DATA
  compensationAmount: "compensation.amount",
  compensationComponents: "compensation.components",
  compensationCurrency: "compensation.currency",
  compensationChangeType: "compensation.change_type",
  compensationNotes: "compensation.notes",
  contractCollaborationType: "contract.collaboration_type",
  contractType: "contract.contract_type",
  contractingEntity: "contract.contracting_entity",
  insuringEntity: "contract.insuring_entity",
  contractReference: "contract.reference",
  contractDates: "contract.dates",
} as const;

export const PERSON_FIELD_TO_ELEMENT: Record<
  PersonProfileFieldKey,
  string
> = {
  personnelCode: ELEMENT_ID.personnelCode,
  givenName: ELEMENT_ID.givenName,
  familyName: ELEMENT_ID.familyName,
  mobilePhone: ELEMENT_ID.mobilePhone,
  fatherName: ELEMENT_ID.fatherName,
  birthDate: ELEMENT_ID.birthDate,
  gender: ELEMENT_ID.gender,
  nationality: ELEMENT_ID.nationality,
  nationalId: ELEMENT_ID.nationalId,
};

export const ELEMENT_TO_PERSON_FIELD: Record<string, PersonProfileFieldKey> = {
  [ELEMENT_ID.personnelCode]: "personnelCode",
  [ELEMENT_ID.givenName]: "givenName",
  [ELEMENT_ID.familyName]: "familyName",
  [ELEMENT_ID.mobilePhone]: "mobilePhone",
  [ELEMENT_ID.fatherName]: "fatherName",
  [ELEMENT_ID.birthDate]: "birthDate",
  [ELEMENT_ID.gender]: "gender",
  [ELEMENT_ID.nationality]: "nationality",
  [ELEMENT_ID.nationalId]: "nationalId",
};

/**
 * Field → envelope category for omitUnauthorizedCategories.
 * Ordinary identity fields map to identity.person; national ID is separate.
 * Disposition approve ≠ production category enabled (FR-3).
 */
export const PERSON_FIELD_CATEGORY: Record<string, string> = {
  nationalId: "identity.national_id",
  personnelCode: "identity.person",
  givenName: "identity.person",
  familyName: "identity.person",
  mobilePhone: "identity.person",
  fatherName: "identity.person",
  birthDate: "identity.person",
  gender: "identity.person",
  nationality: "identity.person",
};

export type SeedDataElementDef = {
  elementId: string;
  disposition: DataElementDisposition;
  labelFa: string;
  personFieldKey?: PersonProfileFieldKey | null;
  categoryId?: string | null;
  /** When disposition=approve, seed with complete metadata (then enable). */
  metadata?: {
    purpose: string;
    ownerSource: string;
    format: string;
    sensitivity: string;
    access: string;
    retention: string;
    export: string;
    audit: string;
  };
  freeTextPurpose?: string | null;
  lineage?: string | null;
};

function approveMeta(partial: {
  purpose: string;
  format: string;
  sensitivity?: string;
  access?: string;
}): SeedDataElementDef["metadata"] {
  return {
    purpose: partial.purpose,
    ownerSource: "AR-DATA partial freeze 2026-07-16",
    format: partial.format,
    sensitivity: partial.sensitivity ?? "ordinary",
    access: partial.access ?? "identity.person + person.read/write",
    retention: "retain",
    export: "governed export only (FR-50+)",
    audit: "access-event + identity change audit",
  };
}

/**
 * Seed catalogue from data-element-dispositions.md.
 * Spreadsheet/addendum presence alone does not enable — only approve + metadata + enable.
 */
export const DATA_ELEMENT_SEED: readonly SeedDataElementDef[] = [
  {
    elementId: ELEMENT_ID.personnelCode,
    disposition: "approve",
    labelFa: "کد پرسنلی",
    personFieldKey: "personnelCode",
    metadata: approveMeta({
      purpose: "Stable workforce identifier",
      format: "latin-digits canonical; max 32",
    }),
  },
  {
    elementId: ELEMENT_ID.givenName,
    disposition: "approve",
    labelFa: "نام",
    personFieldKey: "givenName",
    metadata: approveMeta({
      purpose: "Legal / operational given name",
      format: "non-empty unicode text; max 100",
    }),
  },
  {
    elementId: ELEMENT_ID.familyName,
    disposition: "approve",
    labelFa: "نام خانوادگی",
    personFieldKey: "familyName",
    metadata: approveMeta({
      purpose: "Legal / operational family name",
      format: "non-empty unicode text; max 100",
    }),
  },
  {
    elementId: ELEMENT_ID.fatherName,
    disposition: "approve",
    labelFa: "نام پدر",
    personFieldKey: "fatherName",
    metadata: approveMeta({
      purpose: "Father name for identity matching",
      format: "optional unicode text; max 100",
    }),
  },
  {
    elementId: ELEMENT_ID.birthDate,
    disposition: "approve",
    labelFa: "تاریخ تولد",
    personFieldKey: "birthDate",
    metadata: approveMeta({
      purpose: "Date of birth (Jalali UX; store Gregorian date)",
      format: "YYYY-MM-DD optional",
    }),
  },
  {
    elementId: ELEMENT_ID.gender,
    disposition: "approve",
    labelFa: "جنسیت",
    personFieldKey: "gender",
    metadata: approveMeta({
      purpose: "Gender classification for HR records",
      format: "optional short code/text; max 32",
    }),
  },
  {
    elementId: ELEMENT_ID.nationality,
    disposition: "approve",
    labelFa: "ملیت",
    personFieldKey: "nationality",
    metadata: approveMeta({
      purpose: "Nationality for identity records",
      format: "optional text; max 100",
    }),
  },
  {
    elementId: ELEMENT_ID.nationalId,
    disposition: "approve",
    labelFa: "کد ملی",
    personFieldKey: "nationalId",
    categoryId: "identity.national_id",
    metadata: approveMeta({
      purpose: "National ID when category authorized",
      format: "latin digits canonical; unique when present",
      sensitivity: "sensitive",
      access: "identity.national_id category + person.write",
    }),
  },
  {
    elementId: ELEMENT_ID.mobilePhone,
    disposition: "approve",
    labelFa: "موبایل",
    personFieldKey: "mobilePhone",
    metadata: approveMeta({
      purpose: "MVP mandatory contact channel",
      format:
        "Iranian mobile: canonical 09XXXXXXXXX (11 Latin digits); accept Persian/Arabic-Indic digits; optional +98/98 prefix normalized to 09",
    }),
  },
  // later — exist with enabled=false; incomplete or placeholder metadata OK
  {
    elementId: ELEMENT_ID.birthCertificate,
    disposition: "later",
    labelFa: "شماره / سریال شناسنامه",
  },
  {
    elementId: ELEMENT_ID.birthPlace,
    disposition: "later",
    labelFa: "محل تولد",
  },
  {
    elementId: ELEMENT_ID.birthCertIssuePlace,
    disposition: "later",
    labelFa: "محل صدور شناسنامه",
  },
  {
    elementId: ELEMENT_ID.militaryService,
    disposition: "later",
    labelFa: "وضعیت نظام‌وظیفه",
  },
  {
    elementId: ELEMENT_ID.landline,
    disposition: "later",
    labelFa: "تلفن ثابت",
  },
  {
    elementId: ELEMENT_ID.personalEmail,
    disposition: "later",
    labelFa: "ایمیل شخصی",
  },
  {
    elementId: ELEMENT_ID.organizationalEmail,
    disposition: "later",
    labelFa: "ایمیل سازمانی",
  },
  {
    elementId: ELEMENT_ID.residentialAddress,
    disposition: "later",
    labelFa: "آدرس محل سکونت",
  },
  {
    elementId: ELEMENT_ID.postalCode,
    disposition: "later",
    labelFa: "کد پستی",
  },
  {
    elementId: ELEMENT_ID.workLocation,
    disposition: "later",
    labelFa: "محل کار / سایت",
  },
  {
    elementId: ELEMENT_ID.family,
    disposition: "later",
    labelFa: "خانواده / وابستگان",
  },
  {
    elementId: ELEMENT_ID.education,
    disposition: "later",
    labelFa: "تحصیلات",
  },
  {
    elementId: ELEMENT_ID.bank,
    disposition: "later",
    labelFa: "اطلاعات بانکی",
  },
  {
    elementId: ELEMENT_ID.insurance,
    disposition: "later",
    labelFa: "بیمه",
  },
  {
    elementId: ELEMENT_ID.health,
    disposition: "later",
    labelFa: "سلامت / وضعیت جسمانی",
  },
  // Compensation / contractual candidates (Story 3.4 / addendum §3.2 / §3.4)
  // disposition later + enabled=false — spreadsheet alone never enables (AR-DATA)
  {
    elementId: ELEMENT_ID.compensationAmount,
    disposition: "later",
    labelFa: "مبلغ جبران‌خدمت",
    categoryId: "compensation",
  },
  {
    elementId: ELEMENT_ID.compensationComponents,
    disposition: "later",
    labelFa: "اجزای جبران‌خدمت",
    categoryId: "compensation",
  },
  {
    elementId: ELEMENT_ID.compensationCurrency,
    disposition: "later",
    labelFa: "واحد پول جبران‌خدمت",
    categoryId: "compensation",
  },
  {
    elementId: ELEMENT_ID.compensationChangeType,
    disposition: "later",
    labelFa: "نوع تغییر جبران‌خدمت",
    categoryId: "compensation",
  },
  {
    elementId: ELEMENT_ID.compensationNotes,
    disposition: "later",
    labelFa: "توضیحات / دلیل جبران‌خدمت",
    categoryId: "compensation",
    freeTextPurpose: "purpose-limited compensation change notes (AR-DATA)",
  },
  {
    elementId: ELEMENT_ID.contractCollaborationType,
    disposition: "later",
    labelFa: "نوع همکاری (تاریخ‌دار قراردادی)",
    categoryId: "compensation",
  },
  {
    elementId: ELEMENT_ID.contractType,
    disposition: "later",
    labelFa: "نوع قرارداد",
    categoryId: "compensation",
  },
  {
    elementId: ELEMENT_ID.contractingEntity,
    disposition: "later",
    labelFa: "شخص حقوقی طرف قرارداد",
    categoryId: "compensation",
  },
  {
    elementId: ELEMENT_ID.insuringEntity,
    disposition: "later",
    labelFa: "بیمه‌گر",
    categoryId: "compensation",
  },
  {
    elementId: ELEMENT_ID.contractReference,
    disposition: "later",
    labelFa: "مرجع / شماره قرارداد",
    categoryId: "compensation",
  },
  {
    elementId: ELEMENT_ID.contractDates,
    disposition: "later",
    labelFa: "تاریخ‌های قرارداد",
    categoryId: "compensation",
  },
  // reject — never enable via API
  {
    elementId: ELEMENT_ID.religion,
    disposition: "reject",
    labelFa: "مذهب / فرقه",
  },
];
