/**
 * Person identity master-data APIs (Stories 3.1 / 3.3 / FR-5 / FR-7).
 *
 * Create / update / read identity facts only — not Employment, Assignment,
 * or compensation mutations (Epic 4). No business events to event-store.
 *
 * AC #5: Person delete-on-Employment-end is not offered. When Employment
 * appears later (3.2+), `onDelete` must not cascade-remove Person.
 *
 * Historical workforce-affecting overwrite (Story 3.3 AC #4):
 * Names / mobile / ordinary identity contact updates are master-data projection
 * updates only. They must NOT rewrite historical Employment, Assignment,
 * contract, compensation, or org effective-dated facts — those mutate only via
 * Epic 4 AR-TEMPORAL events. This module exposes no “edit history cell” path.
 */

import type { PrismaClient } from "@divan/db";

import {
  assertPersonFieldEnabled,
  type PersonProfileFieldKey,
} from "./data-dictionary";
import { getPersonDb } from "./db";
import {
  normalizeDigitsForMatch,
  normalizeIranianMobilePhone,
} from "./digits";
import {
  MSG_BLOCKED_IDENTITY_OPERATION_FA,
  MSG_DUPLICATE_NATIONAL_ID_FA,
  MSG_DUPLICATE_PERSONNEL_CODE_FA,
  MSG_PERSON_NOT_FOUND_FA,
  MSG_REQUIRED_FIELD_FA,
  PersonIdentityError,
} from "./errors";
import {
  normalizeOptionalString,
  requireNonEmpty,
} from "./normalize";

export type PersonRecord = {
  id: string;
  personnelCode: string;
  givenName: string;
  familyName: string;
  mobilePhone: string;
  fatherName: string | null;
  birthDate: string | null;
  gender: string | null;
  nationality: string | null;
  /** Omitted from public reads unless national-id category authorized. */
  nationalId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePersonInput = {
  personnelCode: string;
  givenName: string;
  familyName: string;
  mobilePhone: string;
  fatherName?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  nationality?: string | null;
  /**
   * Not accepted on create — national ID is category-gated via
   * `updatePersonIdentity` / `person.setNationalId` only.
   */
  nationalId?: never;
};

/** Soft bounds for identity strings (Story 3.1 review). */
export const PERSON_FIELD_MAX = {
  personnelCode: 32,
  givenName: 100,
  familyName: 100,
  mobilePhone: 32,
  fatherName: 100,
  gender: 32,
  nationality: 100,
  nationalId: 32,
} as const;

export type UpdatePersonIdentityInput = {
  givenName?: string;
  familyName?: string;
  mobilePhone?: string;
  fatherName?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  nationality?: string | null;
  nationalId?: string | null;
};

export type PersonActorCtx = {
  accountId: string;
  correlationId: string;
};

function mapPerson(row: {
  id: string;
  personnelCode: string;
  givenName: string;
  familyName: string;
  mobilePhone: string;
  fatherName: string | null;
  birthDate: Date | null;
  gender: string | null;
  nationality: string | null;
  nationalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PersonRecord {
  return {
    id: row.id,
    personnelCode: row.personnelCode,
    givenName: row.givenName,
    familyName: row.familyName,
    mobilePhone: row.mobilePhone,
    fatherName: row.fatherName,
    birthDate: row.birthDate
      ? row.birthDate.toISOString().slice(0, 10)
      : null,
    gender: row.gender,
    nationality: row.nationality,
    nationalId: row.nationalId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseOptionalDate(
  value: string | null | undefined,
): Date | null {
  const normalized = normalizeOptionalString(value ?? null);
  if (!normalized) return null;
  // Expect YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new PersonIdentityError(
      "VALIDATION",
      "تاریخ تولد نامعتبر است.",
    );
  }
  const d = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new PersonIdentityError(
      "VALIDATION",
      "تاریخ تولد نامعتبر است.",
    );
  }
  // Reject calendar rollover (e.g. 2024-02-30 → 2024-03-01).
  if (d.toISOString().slice(0, 10) !== normalized) {
    throw new PersonIdentityError(
      "VALIDATION",
      "تاریخ تولد نامعتبر است.",
    );
  }
  return d;
}

function isUniqueViolation(err: unknown, target?: string): boolean {
  if (
    typeof err !== "object" ||
    err === null ||
    !("code" in err) ||
    (err as { code: unknown }).code !== "P2002"
  ) {
    return false;
  }
  if (!target) return true;
  const meta = (err as { meta?: { target?: string | string[] } }).meta;
  const t = meta?.target;
  if (typeof t === "string") return t.includes(target);
  if (Array.isArray(t)) return t.some((x) => String(x).includes(target));
  return false;
}

function enforceMaxLength(
  value: string,
  max: number,
  messageFa: string,
): string {
  if (value.length > max) {
    throw new PersonIdentityError("VALIDATION", messageFa);
  }
  return value;
}

function normalizePersonnelCode(raw: string): string {
  const required = requireNonEmpty(raw, "کد پرسنلی الزامی است.");
  const canonical = normalizeDigitsForMatch(required);
  if (canonical.length === 0) {
    throw new PersonIdentityError(
      "VALIDATION",
      "کد پرسنلی الزامی است.",
    );
  }
  return enforceMaxLength(
    canonical,
    PERSON_FIELD_MAX.personnelCode,
    "کد پرسنلی بیش از حد طولانی است.",
  );
}

function normalizeNationalId(
  raw: string | null | undefined,
): string | null {
  const opt = normalizeOptionalString(raw);
  if (!opt) return null;
  const canonical = normalizeDigitsForMatch(opt);
  // Separators-only / non-digit junk → omit (null), never "" or punctuation.
  if (canonical.length === 0 || !/\d/.test(canonical)) return null;
  return enforceMaxLength(
    canonical,
    PERSON_FIELD_MAX.nationalId,
    "کد ملی بیش از حد طولانی است.",
  );
}

function normalizeMobilePhone(raw: string): string {
  const required = requireNonEmpty(raw, "شماره موبایل الزامی است.");
  const canonical = normalizeIranianMobilePhone(required);
  return enforceMaxLength(
    canonical,
    PERSON_FIELD_MAX.mobilePhone,
    "شماره موبایل بیش از حد طولانی است.",
  );
}

async function requireEnabledFields(
  fieldKeys: readonly PersonProfileFieldKey[],
  db: PrismaClient,
): Promise<void> {
  for (const key of fieldKeys) {
    await assertPersonFieldEnabled(key, db);
  }
}

/**
 * Create a Person with unique Personnel Code.
 * National ID uniqueness enforced when non-null.
 * Writes rejected when target dictionary fields are not enabled+approved.
 */
export async function createPerson(
  input: CreatePersonInput,
  _ctx: PersonActorCtx,
  db: PrismaClient = getPersonDb(),
): Promise<PersonRecord> {
  if (
    "nationalId" in input &&
    (input as { nationalId?: unknown }).nationalId !== undefined
  ) {
    throw new PersonIdentityError(
      "VALIDATION",
      "ثبت کد ملی فقط از مسیر مجاز دسته‌بندی داده امکان‌پذیر است.",
    );
  }

  const requiredKeys: PersonProfileFieldKey[] = [
    "personnelCode",
    "givenName",
    "familyName",
    "mobilePhone",
  ];
  const optionalPresent: PersonProfileFieldKey[] = [];
  if (normalizeOptionalString(input.fatherName ?? null) !== null) {
    optionalPresent.push("fatherName");
  }
  if (normalizeOptionalString(input.birthDate ?? null) !== null) {
    optionalPresent.push("birthDate");
  }
  if (normalizeOptionalString(input.gender ?? null) !== null) {
    optionalPresent.push("gender");
  }
  if (normalizeOptionalString(input.nationality ?? null) !== null) {
    optionalPresent.push("nationality");
  }
  await requireEnabledFields([...requiredKeys, ...optionalPresent], db);

  const personnelCode = normalizePersonnelCode(input.personnelCode);
  const givenName = enforceMaxLength(
    requireNonEmpty(input.givenName, "نام الزامی است."),
    PERSON_FIELD_MAX.givenName,
    "نام بیش از حد طولانی است.",
  );
  const familyName = enforceMaxLength(
    requireNonEmpty(input.familyName, "نام خانوادگی الزامی است."),
    PERSON_FIELD_MAX.familyName,
    "نام خانوادگی بیش از حد طولانی است.",
  );
  const mobilePhone = normalizeMobilePhone(input.mobilePhone);
  const fatherNameRaw = normalizeOptionalString(input.fatherName);
  const fatherName = fatherNameRaw
    ? enforceMaxLength(
        fatherNameRaw,
        PERSON_FIELD_MAX.fatherName,
        "نام پدر بیش از حد طولانی است.",
      )
    : null;
  const genderRaw = normalizeOptionalString(input.gender);
  const gender = genderRaw
    ? enforceMaxLength(
        genderRaw,
        PERSON_FIELD_MAX.gender,
        "جنسیت بیش از حد طولانی است.",
      )
    : null;
  const nationalityRaw = normalizeOptionalString(input.nationality);
  const nationality = nationalityRaw
    ? enforceMaxLength(
        nationalityRaw,
        PERSON_FIELD_MAX.nationality,
        "ملیت بیش از حد طولانی است.",
      )
    : null;
  const birthDate = parseOptionalDate(input.birthDate);

  const existingCode = await db.person.findUnique({
    where: { personnelCode },
  });
  if (existingCode) {
    throw new PersonIdentityError(
      "DUPLICATE_PERSONNEL_CODE",
      MSG_DUPLICATE_PERSONNEL_CODE_FA,
    );
  }

  try {
    const row = await db.person.create({
      data: {
        personnelCode,
        givenName,
        familyName,
        mobilePhone,
        fatherName,
        gender,
        nationality,
        nationalId: null,
        birthDate,
      },
    });
    return mapPerson(row);
  } catch (err) {
    if (isUniqueViolation(err, "personnelCode")) {
      throw new PersonIdentityError(
        "DUPLICATE_PERSONNEL_CODE",
        MSG_DUPLICATE_PERSONNEL_CODE_FA,
      );
    }
    throw err;
  }
}

/**
 * Update identity fields — not Personnel Code (correction is blocked).
 * Master-data only — does not rewrite Employment/Assignment/compensation history.
 */
export async function updatePersonIdentity(
  id: string,
  input: UpdatePersonIdentityInput,
  _ctx: PersonActorCtx,
  db: PrismaClient = getPersonDb(),
): Promise<PersonRecord> {
  const existing = await db.person.findUnique({ where: { id } });
  if (!existing) {
    throw new PersonIdentityError(
      "PERSON_NOT_FOUND",
      MSG_PERSON_NOT_FOUND_FA,
    );
  }

  const writeKeys: PersonProfileFieldKey[] = [];
  if (input.givenName !== undefined) writeKeys.push("givenName");
  if (input.familyName !== undefined) writeKeys.push("familyName");
  if (input.mobilePhone !== undefined) writeKeys.push("mobilePhone");
  if (input.fatherName !== undefined) writeKeys.push("fatherName");
  if (input.birthDate !== undefined) writeKeys.push("birthDate");
  if (input.gender !== undefined) writeKeys.push("gender");
  if (input.nationality !== undefined) writeKeys.push("nationality");
  if (input.nationalId !== undefined) writeKeys.push("nationalId");
  await requireEnabledFields(writeKeys, db);

  const data: {
    givenName?: string;
    familyName?: string;
    mobilePhone?: string;
    fatherName?: string | null;
    birthDate?: Date | null;
    gender?: string | null;
    nationality?: string | null;
    nationalId?: string | null;
  } = {};

  if (input.givenName !== undefined) {
    data.givenName = enforceMaxLength(
      requireNonEmpty(input.givenName, "نام الزامی است."),
      PERSON_FIELD_MAX.givenName,
      "نام بیش از حد طولانی است.",
    );
  }
  if (input.familyName !== undefined) {
    data.familyName = enforceMaxLength(
      requireNonEmpty(input.familyName, "نام خانوادگی الزامی است."),
      PERSON_FIELD_MAX.familyName,
      "نام خانوادگی بیش از حد طولانی است.",
    );
  }
  if (input.mobilePhone !== undefined) {
    data.mobilePhone = normalizeMobilePhone(input.mobilePhone);
  }
  if (input.fatherName !== undefined) {
    const fatherName = normalizeOptionalString(input.fatherName);
    data.fatherName = fatherName
      ? enforceMaxLength(
          fatherName,
          PERSON_FIELD_MAX.fatherName,
          "نام پدر بیش از حد طولانی است.",
        )
      : null;
  }
  if (input.gender !== undefined) {
    const gender = normalizeOptionalString(input.gender);
    data.gender = gender
      ? enforceMaxLength(
          gender,
          PERSON_FIELD_MAX.gender,
          "جنسیت بیش از حد طولانی است.",
        )
      : null;
  }
  if (input.nationality !== undefined) {
    const nationality = normalizeOptionalString(input.nationality);
    data.nationality = nationality
      ? enforceMaxLength(
          nationality,
          PERSON_FIELD_MAX.nationality,
          "ملیت بیش از حد طولانی است.",
        )
      : null;
  }
  if (input.birthDate !== undefined) {
    data.birthDate = parseOptionalDate(input.birthDate);
  }
  if (input.nationalId !== undefined) {
    const nationalId = normalizeNationalId(input.nationalId);
    if (nationalId) {
      const clash = await db.person.findFirst({
        where: { nationalId, NOT: { id } },
      });
      if (clash) {
        throw new PersonIdentityError(
          "DUPLICATE_NATIONAL_ID",
          MSG_DUPLICATE_NATIONAL_ID_FA,
        );
      }
    }
    data.nationalId = nationalId;
  }

  if (Object.keys(data).length === 0) {
    throw new PersonIdentityError(
      "VALIDATION",
      MSG_REQUIRED_FIELD_FA,
    );
  }

  try {
    const row = await db.person.update({ where: { id }, data });
    return mapPerson(row);
  } catch (err) {
    if (isUniqueViolation(err, "nationalId")) {
      throw new PersonIdentityError(
        "DUPLICATE_NATIONAL_ID",
        MSG_DUPLICATE_NATIONAL_ID_FA,
      );
    }
    throw err;
  }
}

export async function getPersonById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<PersonRecord | null> {
  const row = await db.person.findUnique({ where: { id } });
  return row ? mapPerson(row) : null;
}

export async function getPersonByPersonnelCode(
  personnelCode: string,
  db: PrismaClient = getPersonDb(),
): Promise<PersonRecord | null> {
  const canonical = normalizeDigitsForMatch(personnelCode.trim());
  if (!canonical) return null;
  const row = await db.person.findUnique({
    where: { personnelCode: canonical },
  });
  return row ? mapPerson(row) : null;
}

/** Thin list for personnel landing — not Epic 5 search. */
export async function listPersons(
  db: PrismaClient = getPersonDb(),
  limit = 50,
): Promise<PersonRecord[]> {
  const rows = await db.person.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map(mapPerson);
}

function blockedOp(_name: string): never {
  throw new PersonIdentityError(
    "BLOCKED_IDENTITY_OPERATION",
    MSG_BLOCKED_IDENTITY_OPERATION_FA,
  );
}

/** Fail-closed until AR-DATA / AR-MIGRATION. */
export function correctPersonnelCode(
  _personId: string,
  _newCode: string,
  _ctx: PersonActorCtx,
): never {
  return blockedOp("correctPersonnelCode");
}

/** Fail-closed until AR-DATA / AR-MIGRATION. */
export function mergePersons(
  _sourceId: string,
  _targetId: string,
  _ctx: PersonActorCtx,
): never {
  return blockedOp("mergePersons");
}

/** Fail-closed until AR-DATA / AR-MIGRATION. */
export function splitPerson(
  _personId: string,
  _ctx: PersonActorCtx,
): never {
  return blockedOp("splitPerson");
}

/** Fail-closed until AR-DATA / AR-MIGRATION. */
export function matchReturn(
  _personId: string,
  _ctx: PersonActorCtx,
): never {
  return blockedOp("matchReturn");
}

/**
 * Continuity invariant (FR-5 / AC #3): ending Employment never deletes Person.
 *
 * Contract (schema + API):
 * - Employment.personId → Person.id uses onDelete: Restrict (never Cascade / SetNull).
 * - closeEmploymentProjection only sets endDateExclusive — no deletePerson path.
 * - No public Start/Return/Terminate product verbs; projection close is test/Epic-4 surface.
 */
export async function assertPersonSurvivesEmploymentEnd(
  personId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  const person = await getPersonById(personId, db);
  if (!person) {
    throw new PersonIdentityError(
      "PERSON_NOT_FOUND",
      MSG_PERSON_NOT_FOUND_FA,
    );
  }
  // Person remains readable after any Employment close; FK Restrict blocks cascade delete.
}
