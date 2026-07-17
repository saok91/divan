/**
 * Compensation / contractual projection writers + reads (Story 3.4 / FR-8).
 *
 * Internal / seed / Epic-4-ready surface — NOT operator changeSalary / updateContract.
 * AD-2: upserting projections is not a substitute for event-store append.
 * No payroll, tax, insurance, payslip, or payment calculation.
 */

import { Prisma, type PrismaClient } from "@divan/db";
import {
  assertFieldEnabled,
  assertFreeTextAllowed,
  ELEMENT_ID,
  PersonIdentityError,
} from "@divan/person-employment";

import {
  assertAtMostOneActiveAsOf,
  assertNoOverlapWithExisting,
  assertValidCompensationInterval,
  isCompensationActiveAsOf,
  type CompensationInterval,
} from "./compensation-invariants";
import { getCompensationDb } from "./db";
import {
  CompensationError,
  MSG_COMPENSATION_ALREADY_CLOSED_FA,
  MSG_COMPENSATION_NOT_FOUND_FA,
  MSG_CONCURRENT_COMPENSATION_FORBIDDEN_FA,
  MSG_EMPLOYMENT_NOT_FOUND_FA,
  MSG_FIELD_NOT_ENABLED_FA,
  MSG_FREE_TEXT_PURPOSE_REQUIRED_FA,
  MSG_INVALID_COMPENSATION_INTERVAL_FA,
  MSG_INVALID_FACT_KIND_FA,
  MSG_OVERLAPPING_COMPENSATION_FA,
  MSG_PERSON_NOT_FOUND_FA,
  MSG_SENTINEL_OPTIONAL_FA,
} from "./errors";
import { normalizeOptionalString } from "./normalize";

export const FACT_KIND = {
  compensation: "compensation",
  contractual: "contractual",
} as const;

export type FactKind = (typeof FACT_KIND)[keyof typeof FACT_KIND];

export type CompensationFactRecord = {
  id: string;
  personId: string;
  employmentId: string | null;
  factKind: FactKind;
  startDate: string;
  endDateExclusive: string | null;
  amount: string | null;
  components: Prisma.JsonValue | null;
  currency: string | null;
  changeType: string | null;
  notes: string | null;
  collaborationType: string | null;
  contractType: string | null;
  contractingEntity: string | null;
  insuringEntity: string | null;
  contractReference: string | null;
  contractStartDate: string | null;
  contractEndDateExclusive: string | null;
  sourceEventId: string | null;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ApplyCompensationProjectionInput = {
  id?: string;
  personId: string;
  employmentId?: string | null;
  startDate: string;
  endDateExclusive?: string | null;
  amount?: string | number | null;
  components?: Prisma.InputJsonValue | null;
  currency?: string | null;
  changeType?: string | null;
  notes?: string | null;
  sourceEventId?: string | null;
  /**
   * Seed / selfcheck only until AR-DATA enables compensation elements.
   * Forbidden when `NODE_ENV === "production"` — Epic 4 writers must leave unset.
   */
  skipDictionaryGate?: boolean;
};

export type ApplyContractualProjectionInput = {
  id?: string;
  personId: string;
  employmentId?: string | null;
  startDate: string;
  endDateExclusive?: string | null;
  collaborationType?: string | null;
  contractType?: string | null;
  contractingEntity?: string | null;
  insuringEntity?: string | null;
  contractReference?: string | null;
  contractStartDate?: string | null;
  contractEndDateExclusive?: string | null;
  notes?: string | null;
  sourceEventId?: string | null;
  /**
   * Seed / selfcheck only until AR-DATA enables compensation elements.
   * Forbidden when `NODE_ENV === "production"` — Epic 4 writers must leave unset.
   */
  skipDictionaryGate?: boolean;
};

/** Field key → Data Dictionary elementId for write gating. */
export const COMPENSATION_FIELD_ELEMENT: Record<string, string> = {
  amount: ELEMENT_ID.compensationAmount,
  components: ELEMENT_ID.compensationComponents,
  currency: ELEMENT_ID.compensationCurrency,
  changeType: ELEMENT_ID.compensationChangeType,
  notes: ELEMENT_ID.compensationNotes,
  collaborationType: ELEMENT_ID.contractCollaborationType,
  contractType: ELEMENT_ID.contractType,
  contractingEntity: ELEMENT_ID.contractingEntity,
  insuringEntity: ELEMENT_ID.insuringEntity,
  contractReference: ELEMENT_ID.contractReference,
  contractStartDate: ELEMENT_ID.contractDates,
  contractEndDateExclusive: ELEMENT_ID.contractDates,
};

function dateOnlyToDb(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function dateOnlyFromDb(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function amountToString(amount: string | null | undefined): string | null {
  if (amount === null || amount === undefined) return null;
  return amount;
}

const AMOUNT_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Parse compensation amount as a plain decimal string.
 * Blank/missing → null. `"0"` / `0` are real monetary zeros (not identity-style sentinels).
 * Reject N/A-style stand-ins and number coercions that stringify outside AMOUNT_PATTERN
 * (e.g. scientific notation).
 */
function parseAmount(
  value: string | number | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CompensationError(
        "VALIDATION",
        MSG_INVALID_COMPENSATION_INTERVAL_FA,
        "invalid_amount",
      );
    }
    const asString = String(value);
    if (!AMOUNT_PATTERN.test(asString)) {
      throw new CompensationError(
        "VALIDATION",
        MSG_INVALID_COMPENSATION_INTERVAL_FA,
        "invalid_amount",
      );
    }
    return asString;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (
    trimmed.toUpperCase() === "N/A" ||
    trimmed.toLowerCase() === "n/a" ||
    trimmed === "verified absence" ||
    trimmed === "Verified Absence"
  ) {
    throw new CompensationError(
      "SENTINEL_VALUE",
      MSG_SENTINEL_OPTIONAL_FA,
      "sentinel_amount",
    );
  }
  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new CompensationError(
      "VALIDATION",
      MSG_INVALID_COMPENSATION_INTERVAL_FA,
      "invalid_amount",
    );
  }
  return trimmed;
}

type FactRow = {
  id: string;
  personId: string;
  employmentId: string | null;
  factKind: string;
  startDate: Date;
  endDateExclusive: Date | null;
  amount: string | null;
  components: Prisma.JsonValue | null;
  currency: string | null;
  changeType: string | null;
  notes: string | null;
  collaborationType: string | null;
  contractType: string | null;
  contractingEntity: string | null;
  insuringEntity: string | null;
  contractReference: string | null;
  contractStartDate: Date | null;
  contractEndDateExclusive: Date | null;
  sourceEventId: string | null;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function mapFact(row: FactRow): CompensationFactRecord {
  if (
    row.factKind !== FACT_KIND.compensation &&
    row.factKind !== FACT_KIND.contractual
  ) {
    throw new CompensationError("INVALID_FACT_KIND", MSG_INVALID_FACT_KIND_FA);
  }
  return {
    id: row.id,
    personId: row.personId,
    employmentId: row.employmentId,
    factKind: row.factKind,
    startDate: dateOnlyFromDb(row.startDate)!,
    endDateExclusive: dateOnlyFromDb(row.endDateExclusive),
    amount: amountToString(row.amount),
    components: row.components,
    currency: row.currency,
    changeType: row.changeType,
    notes: row.notes,
    collaborationType: row.collaborationType,
    contractType: row.contractType,
    contractingEntity: row.contractingEntity,
    insuringEntity: row.insuringEntity,
    contractReference: row.contractReference,
    contractStartDate: dateOnlyFromDb(row.contractStartDate),
    contractEndDateExclusive: dateOnlyFromDb(row.contractEndDateExclusive),
    sourceEventId: row.sourceEventId,
    recordedAt: row.recordedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toInterval(
  row: CompensationFactRecord,
): CompensationInterval & { id: string } {
  return {
    id: row.id,
    startDate: row.startDate,
    endDateExclusive: row.endDateExclusive,
  };
}

function isExclusionViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as {
    code?: unknown;
    meta?: { code?: unknown };
    message?: unknown;
    cause?: { code?: unknown };
  };
  if (e.code === "23P01") return true;
  if (e.meta?.code === "23P01") return true;
  if (e.cause?.code === "23P01") return true;
  if (typeof e.message === "string") {
    if (
      e.message.includes("23P01") ||
      e.message.includes("CompensationFact_person_kind_effective_excl") ||
      /exclusion_violation/i.test(e.message)
    ) {
      return true;
    }
  }
  return false;
}

function isPersonFkViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === "P2003") {
    if (typeof e.message === "string" && /employment/i.test(e.message)) {
      return false;
    }
    return true;
  }
  if (typeof e.message === "string") {
    if (
      /CompensationFact_personId_fkey/i.test(e.message) ||
      (/foreign key/i.test(e.message) && /person/i.test(e.message))
    ) {
      return true;
    }
  }
  return false;
}

function isEmploymentFkViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === "P2003") {
    if (typeof e.message === "string" && /employment/i.test(e.message)) {
      return true;
    }
  }
  if (typeof e.message === "string") {
    if (/CompensationFact_employmentId_fkey/i.test(e.message)) return true;
  }
  return false;
}

async function assertDictionaryFieldsEnabled(
  fields: Record<string, unknown>,
  db: PrismaClient,
  skip: boolean | undefined,
): Promise<void> {
  if (skip) {
    if (process.env.NODE_ENV === "production") {
      throw new CompensationError(
        "FIELD_NOT_ENABLED",
        MSG_FIELD_NOT_ENABLED_FA,
        "skip_dictionary_gate_forbidden",
      );
    }
    return;
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    const elementId = COMPENSATION_FIELD_ELEMENT[key];
    if (!elementId) continue;
    try {
      const el = await assertFieldEnabled(elementId, db);
      if (key === "notes") {
        try {
          assertFreeTextAllowed(el);
        } catch (err) {
          if (
            err instanceof Error &&
            "code" in err &&
            (err as { code: string }).code === "FREE_TEXT_PURPOSE_REQUIRED"
          ) {
            throw new CompensationError(
              "FREE_TEXT_PURPOSE_REQUIRED",
              MSG_FREE_TEXT_PURPOSE_REQUIRED_FA,
            );
          }
          throw err;
        }
      }
    } catch (err) {
      if (
        err instanceof PersonIdentityError &&
        err.code === "FIELD_NOT_ENABLED"
      ) {
        throw new CompensationError(
          "FIELD_NOT_ENABLED",
          MSG_FIELD_NOT_ENABLED_FA,
        );
      }
      if (err instanceof CompensationError) throw err;
      throw err;
    }
  }
}

async function assertPersonAndEmployment(
  personId: string,
  employmentId: string | null,
  db: PrismaClient,
): Promise<void> {
  const person = await db.person.findUnique({ where: { id: personId } });
  if (!person) {
    throw new CompensationError("PERSON_NOT_FOUND", MSG_PERSON_NOT_FOUND_FA);
  }
  if (employmentId) {
    const employment = await db.employment.findUnique({
      where: { id: employmentId },
    });
    if (!employment || employment.personId !== personId) {
      throw new CompensationError(
        "EMPLOYMENT_NOT_FOUND",
        MSG_EMPLOYMENT_NOT_FOUND_FA,
      );
    }
  }
}

async function applyFactProjection(
  factKind: FactKind,
  input: {
    id?: string;
    personId: string;
    employmentId?: string | null;
    startDate: string;
    endDateExclusive?: string | null;
    sourceEventId?: string | null;
    skipDictionaryGate?: boolean;
    fieldValues: Record<string, unknown>;
    data: Omit<
      Prisma.CompensationFactUncheckedCreateInput,
      | "personId"
      | "employmentId"
      | "factKind"
      | "startDate"
      | "endDateExclusive"
      | "sourceEventId"
    >;
  },
  db: PrismaClient,
): Promise<CompensationFactRecord> {
  const employmentId =
    input.employmentId === undefined || input.employmentId === null
      ? null
      : input.employmentId;

  await assertPersonAndEmployment(input.personId, employmentId, db);

  const interval = assertValidCompensationInterval(
    input.startDate,
    input.endDateExclusive,
  );

  await assertDictionaryFieldsEnabled(
    input.fieldValues,
    db,
    input.skipDictionaryGate,
  );

  const siblings = await listCompensationFactsForPerson(
    input.personId,
    factKind,
    db,
  );

  if (interval.endDateExclusive === null) {
    const otherOpen = siblings.find(
      (s) => s.endDateExclusive === null && s.id !== input.id,
    );
    if (otherOpen) {
      throw new CompensationError(
        "CONCURRENT_COMPENSATION_FORBIDDEN",
        MSG_CONCURRENT_COMPENSATION_FORBIDDEN_FA,
      );
    }
  }

  assertNoOverlapWithExisting(interval, siblings.map(toInterval), input.id);

  const data: Prisma.CompensationFactUncheckedCreateInput = {
    ...input.data,
    personId: input.personId,
    employmentId,
    factKind,
    startDate: dateOnlyToDb(interval.startDate),
    endDateExclusive: interval.endDateExclusive
      ? dateOnlyToDb(interval.endDateExclusive)
      : null,
    sourceEventId: normalizeOptionalString(input.sourceEventId ?? null),
  };

  try {
    if (input.id) {
      const existing = await db.compensationFact.findUnique({
        where: { id: input.id },
      });
      if (
        !existing ||
        existing.personId !== input.personId ||
        existing.factKind !== factKind
      ) {
        throw new CompensationError(
          "COMPENSATION_NOT_FOUND",
          MSG_COMPENSATION_NOT_FOUND_FA,
        );
      }
      const row = await db.compensationFact.update({
        where: { id: input.id },
        data,
      });
      return mapFact(row);
    }

    const row = await db.compensationFact.create({ data });
    return mapFact(row);
  } catch (err) {
    if (err instanceof CompensationError) throw err;
    if (isExclusionViolation(err)) {
      throw new CompensationError(
        "OVERLAPPING_COMPENSATION",
        MSG_OVERLAPPING_COMPENSATION_FA,
        "pg_exclusion_23P01",
      );
    }
    if (isEmploymentFkViolation(err)) {
      throw new CompensationError(
        "EMPLOYMENT_NOT_FOUND",
        MSG_EMPLOYMENT_NOT_FOUND_FA,
      );
    }
    if (isPersonFkViolation(err)) {
      throw new CompensationError("PERSON_NOT_FOUND", MSG_PERSON_NOT_FOUND_FA);
    }
    throw err;
  }
}

/**
 * Apply (create/update) a compensation-kind projection after invariant checks.
 */
export async function applyCompensationProjection(
  input: ApplyCompensationProjectionInput,
  db: PrismaClient = getCompensationDb(),
): Promise<CompensationFactRecord> {
  const amount = parseAmount(input.amount);
  const currency = normalizeOptionalString(input.currency ?? null);
  const changeType = normalizeOptionalString(input.changeType ?? null);
  const notes = normalizeOptionalString(input.notes ?? null);
  const components =
    input.components === undefined ? null : input.components;

  return applyFactProjection(
    FACT_KIND.compensation,
    {
      id: input.id,
      personId: input.personId,
      employmentId: input.employmentId,
      startDate: input.startDate,
      endDateExclusive: input.endDateExclusive,
      sourceEventId: input.sourceEventId,
      skipDictionaryGate: input.skipDictionaryGate,
      fieldValues: {
        amount,
        components,
        currency,
        changeType,
        notes,
      },
      data: {
        amount,
        components:
          components === null ? Prisma.JsonNull : components,
        currency,
        changeType,
        notes,
      },
    },
    db,
  );
}

/**
 * Apply (create/update) a contractual-kind projection after invariant checks.
 */
export async function applyContractualProjection(
  input: ApplyContractualProjectionInput,
  db: PrismaClient = getCompensationDb(),
): Promise<CompensationFactRecord> {
  const collaborationType = normalizeOptionalString(
    input.collaborationType ?? null,
  );
  const contractType = normalizeOptionalString(input.contractType ?? null);
  const contractingEntity = normalizeOptionalString(
    input.contractingEntity ?? null,
  );
  const insuringEntity = normalizeOptionalString(input.insuringEntity ?? null);
  const contractReference = normalizeOptionalString(
    input.contractReference ?? null,
  );
  const notes = normalizeOptionalString(input.notes ?? null);

  let contractStartDate: string | null = null;
  let contractEndDateExclusive: string | null = null;
  const endRaw = input.contractEndDateExclusive;
  const endProvided =
    endRaw !== undefined &&
    endRaw !== null &&
    String(endRaw).trim().length > 0;
  if (
    input.contractStartDate !== undefined &&
    input.contractStartDate !== null
  ) {
    const startTrimmed = String(input.contractStartDate).trim();
    if (startTrimmed.length > 0) {
      const interval = assertValidCompensationInterval(
        startTrimmed,
        input.contractEndDateExclusive,
      );
      contractStartDate = interval.startDate;
      contractEndDateExclusive = interval.endDateExclusive;
    } else if (endProvided) {
      throw new CompensationError(
        "INVALID_COMPENSATION_INTERVAL",
        MSG_INVALID_COMPENSATION_INTERVAL_FA,
        "contract_end_without_start",
      );
    }
  } else if (endProvided) {
    throw new CompensationError(
      "INVALID_COMPENSATION_INTERVAL",
      MSG_INVALID_COMPENSATION_INTERVAL_FA,
      "contract_end_without_start",
    );
  }

  return applyFactProjection(
    FACT_KIND.contractual,
    {
      id: input.id,
      personId: input.personId,
      employmentId: input.employmentId,
      startDate: input.startDate,
      endDateExclusive: input.endDateExclusive,
      sourceEventId: input.sourceEventId,
      skipDictionaryGate: input.skipDictionaryGate,
      fieldValues: {
        collaborationType,
        contractType,
        contractingEntity,
        insuringEntity,
        contractReference,
        contractStartDate,
        contractEndDateExclusive,
        notes,
      },
      data: {
        collaborationType,
        contractType,
        contractingEntity,
        insuringEntity,
        contractReference,
        contractStartDate: contractStartDate
          ? dateOnlyToDb(contractStartDate)
          : null,
        contractEndDateExclusive: contractEndDateExclusive
          ? dateOnlyToDb(contractEndDateExclusive)
          : null,
        notes,
      },
    },
    db,
  );
}

/**
 * Close an open compensation or contractual interval.
 * Does not delete Person; does not append events.
 */
export async function closeCompensationProjection(
  id: string,
  endDateExclusive: string,
  db: PrismaClient = getCompensationDb(),
): Promise<CompensationFactRecord> {
  if (!endDateExclusive?.trim()) {
    throw new CompensationError(
      "INVALID_COMPENSATION_INTERVAL",
      MSG_INVALID_COMPENSATION_INTERVAL_FA,
      "close_requires_end",
    );
  }

  const existing = await db.compensationFact.findUnique({ where: { id } });
  if (!existing) {
    throw new CompensationError(
      "COMPENSATION_NOT_FOUND",
      MSG_COMPENSATION_NOT_FOUND_FA,
    );
  }
  if (existing.endDateExclusive !== null) {
    throw new CompensationError(
      "VALIDATION",
      MSG_COMPENSATION_ALREADY_CLOSED_FA,
    );
  }

  const startDate = dateOnlyFromDb(existing.startDate)!;
  const interval = assertValidCompensationInterval(startDate, endDateExclusive);
  if (interval.endDateExclusive === null) {
    throw new CompensationError(
      "INVALID_COMPENSATION_INTERVAL",
      MSG_INVALID_COMPENSATION_INTERVAL_FA,
      "close_requires_end",
    );
  }

  const siblings = await listCompensationFactsForPerson(
    existing.personId,
    existing.factKind as FactKind,
    db,
  );
  assertNoOverlapWithExisting(interval, siblings.map(toInterval), id);

  try {
    const updated = await db.compensationFact.updateMany({
      where: { id, endDateExclusive: null },
      data: {
        endDateExclusive: dateOnlyToDb(interval.endDateExclusive),
      },
    });
    if (updated.count === 0) {
      const again = await db.compensationFact.findUnique({ where: { id } });
      if (!again) {
        throw new CompensationError(
          "COMPENSATION_NOT_FOUND",
          MSG_COMPENSATION_NOT_FOUND_FA,
        );
      }
      throw new CompensationError(
        "VALIDATION",
        MSG_COMPENSATION_ALREADY_CLOSED_FA,
      );
    }
    const row = await db.compensationFact.findUnique({ where: { id } });
    if (!row) {
      throw new CompensationError(
        "COMPENSATION_NOT_FOUND",
        MSG_COMPENSATION_NOT_FOUND_FA,
      );
    }
    return mapFact(row);
  } catch (err) {
    if (err instanceof CompensationError) throw err;
    if (isExclusionViolation(err)) {
      throw new CompensationError(
        "OVERLAPPING_COMPENSATION",
        MSG_OVERLAPPING_COMPENSATION_FA,
        "pg_exclusion_23P01",
      );
    }
    throw err;
  }
}

export async function listCompensationFactsForPerson(
  personId: string,
  factKind?: FactKind,
  db: PrismaClient = getCompensationDb(),
): Promise<CompensationFactRecord[]> {
  const rows = await db.compensationFact.findMany({
    where: {
      personId,
      ...(factKind ? { factKind } : {}),
    },
    orderBy: [{ factKind: "asc" }, { startDate: "asc" }],
  });
  return rows.map(mapFact);
}

export async function listContractualFactsForPerson(
  personId: string,
  db: PrismaClient = getCompensationDb(),
): Promise<CompensationFactRecord[]> {
  return listCompensationFactsForPerson(personId, FACT_KIND.contractual, db);
}

export async function getCompensationFactById(
  id: string,
  db: PrismaClient = getCompensationDb(),
): Promise<CompensationFactRecord | null> {
  const row = await db.compensationFact.findUnique({ where: { id } });
  return row ? mapFact(row) : null;
}

export async function getCompensationAsOf(
  personId: string,
  asOf: string,
  db: PrismaClient = getCompensationDb(),
): Promise<CompensationFactRecord | null> {
  const rows = await listCompensationFactsForPerson(
    personId,
    FACT_KIND.compensation,
    db,
  );
  assertAtMostOneActiveAsOf(rows, asOf);
  const active = rows.filter((f) => isCompensationActiveAsOf(f, asOf));
  return active[0] ?? null;
}

export async function getContractualAsOf(
  personId: string,
  asOf: string,
  db: PrismaClient = getCompensationDb(),
): Promise<CompensationFactRecord | null> {
  const rows = await listCompensationFactsForPerson(
    personId,
    FACT_KIND.contractual,
    db,
  );
  assertAtMostOneActiveAsOf(rows, asOf);
  const active = rows.filter((f) => isCompensationActiveAsOf(f, asOf));
  return active[0] ?? null;
}

export {
  assertValidCompensationInterval,
  assertNoOverlapWithExisting,
  isCompensationActiveAsOf,
  assertAtMostOneActiveAsOf,
} from "./compensation-invariants";
