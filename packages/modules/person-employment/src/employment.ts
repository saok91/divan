/**
 * Employment projection writers + reads (Story 3.2 / FR-6).
 *
 * Internal / seed / Epic-4-ready surface — NOT operator Start/Return/Terminate.
 * AD-2: upserting projections is not a substitute for event-store append.
 */

import type { PrismaClient } from "@divan/db";

import { getPersonDb } from "./db";
import {
  assertAtMostOneActiveAsOf,
  assertNoOverlapWithExisting,
  assertValidEmploymentInterval,
  isEmploymentActiveAsOf,
  type EmploymentInterval,
} from "./employment-invariants";
import {
  EmploymentError,
  MSG_CONCURRENT_EMPLOYMENT_FORBIDDEN_FA,
  MSG_EMPLOYMENT_ALREADY_CLOSED_FA,
  MSG_EMPLOYMENT_NOT_FOUND_FA,
  MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
  MSG_OVERLAPPING_EMPLOYMENT_FA,
  MSG_PERSON_NOT_FOUND_FA,
  MSG_SENTINEL_OPTIONAL_FA,
  PersonIdentityError,
} from "./errors";
import { normalizeOptionalString } from "./normalize";

export type EmploymentRecord = {
  id: string;
  personId: string;
  startDate: string;
  endDateExclusive: string | null;
  collaborationType: string | null;
  terminationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApplyEmploymentProjectionInput = {
  /** When set, updates that projection row; otherwise creates. */
  id?: string;
  personId: string;
  startDate: string;
  endDateExclusive?: string | null;
  collaborationType?: string | null;
  terminationReason?: string | null;
};

function dateOnlyToDb(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function dateOnlyFromDb(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapEmployment(row: {
  id: string;
  personId: string;
  startDate: Date;
  endDateExclusive: Date | null;
  collaborationType: string | null;
  terminationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EmploymentRecord {
  return {
    id: row.id,
    personId: row.personId,
    startDate: dateOnlyFromDb(row.startDate),
    endDateExclusive: row.endDateExclusive
      ? dateOnlyFromDb(row.endDateExclusive)
      : null,
    collaborationType: row.collaborationType,
    terminationReason: row.terminationReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toInterval(row: EmploymentRecord): EmploymentInterval & { id: string } {
  return {
    id: row.id,
    startDate: row.startDate,
    endDateExclusive: row.endDateExclusive,
  };
}

function normalizeEmploymentOptional(
  value: string | null | undefined,
): string | null {
  try {
    return normalizeOptionalString(value);
  } catch (err) {
    if (err instanceof PersonIdentityError && err.code === "SENTINEL_VALUE") {
      throw new EmploymentError("SENTINEL_VALUE", MSG_SENTINEL_OPTIONAL_FA);
    }
    throw err;
  }
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
      e.message.includes("Employment_person_effective_excl") ||
      /exclusion_violation/i.test(e.message)
    ) {
      return true;
    }
  }
  return false;
}

/** Prisma P2003 / PG FK failure when Person disappeared mid-flight. */
function isPersonFkViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as {
    code?: unknown;
    message?: unknown;
    meta?: { field_name?: unknown; constraint?: unknown };
  };
  if (e.code === "P2003") return true;
  if (typeof e.message === "string") {
    if (
      /Employment_personId_fkey/i.test(e.message) ||
      (/foreign key/i.test(e.message) && /person/i.test(e.message))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Apply (create/update) an Employment projection after invariant checks.
 * Maps unique/exclusion violations to typed domain errors.
 */
export async function applyEmploymentProjection(
  input: ApplyEmploymentProjectionInput,
  db: PrismaClient = getPersonDb(),
): Promise<EmploymentRecord> {
  const person = await db.person.findUnique({
    where: { id: input.personId },
  });
  if (!person) {
    throw new EmploymentError("PERSON_NOT_FOUND", MSG_PERSON_NOT_FOUND_FA);
  }

  const interval = assertValidEmploymentInterval(
    input.startDate,
    input.endDateExclusive,
  );

  const collaborationType = normalizeEmploymentOptional(
    input.collaborationType ?? null,
  );
  const terminationReason = normalizeEmploymentOptional(
    input.terminationReason ?? null,
  );

  // Open interval + termination reason is inconsistent lean data — strip reason.
  const reason =
    interval.endDateExclusive === null ? null : terminationReason;

  const siblings = await listEmploymentsForPerson(input.personId, db);

  // Second open while another open exists → fail closed (AR-DATA exceptions not yet defined).
  if (interval.endDateExclusive === null) {
    const otherOpen = siblings.find(
      (s) => s.endDateExclusive === null && s.id !== input.id,
    );
    if (otherOpen) {
      throw new EmploymentError(
        "CONCURRENT_EMPLOYMENT_FORBIDDEN",
        MSG_CONCURRENT_EMPLOYMENT_FORBIDDEN_FA,
      );
    }
  }

  assertNoOverlapWithExisting(interval, siblings.map(toInterval), input.id);

  const data = {
    personId: input.personId,
    startDate: dateOnlyToDb(interval.startDate),
    endDateExclusive: interval.endDateExclusive
      ? dateOnlyToDb(interval.endDateExclusive)
      : null,
    collaborationType,
    terminationReason: reason,
  };

  try {
    if (input.id) {
      const existing = await db.employment.findUnique({
        where: { id: input.id },
      });
      if (!existing || existing.personId !== input.personId) {
        throw new EmploymentError(
          "EMPLOYMENT_NOT_FOUND",
          MSG_EMPLOYMENT_NOT_FOUND_FA,
        );
      }
      const row = await db.employment.update({
        where: { id: input.id },
        data,
      });
      return mapEmployment(row);
    }

    const row = await db.employment.create({ data });
    return mapEmployment(row);
  } catch (err) {
    if (err instanceof EmploymentError) throw err;
    if (isExclusionViolation(err)) {
      throw new EmploymentError(
        "OVERLAPPING_EMPLOYMENT",
        MSG_OVERLAPPING_EMPLOYMENT_FA,
        "pg_exclusion_23P01",
      );
    }
    if (isPersonFkViolation(err)) {
      throw new EmploymentError("PERSON_NOT_FOUND", MSG_PERSON_NOT_FOUND_FA);
    }
    throw err;
  }
}

/**
 * Close an open Employment interval (simulates Termination effect for tests).
 * Does not delete Person; does not append events.
 */
export async function closeEmploymentProjection(
  id: string,
  endDateExclusive: string,
  db: PrismaClient = getPersonDb(),
): Promise<EmploymentRecord> {
  if (!endDateExclusive?.trim()) {
    throw new EmploymentError(
      "INVALID_EMPLOYMENT_INTERVAL",
      MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
      "close_requires_end",
    );
  }

  const existing = await db.employment.findUnique({ where: { id } });
  if (!existing) {
    throw new EmploymentError(
      "EMPLOYMENT_NOT_FOUND",
      MSG_EMPLOYMENT_NOT_FOUND_FA,
    );
  }
  if (existing.endDateExclusive !== null) {
    throw new EmploymentError(
      "VALIDATION",
      MSG_EMPLOYMENT_ALREADY_CLOSED_FA,
    );
  }

  const startDate = dateOnlyFromDb(existing.startDate);
  const interval = assertValidEmploymentInterval(startDate, endDateExclusive);
  if (interval.endDateExclusive === null) {
    throw new EmploymentError(
      "INVALID_EMPLOYMENT_INTERVAL",
      MSG_INVALID_EMPLOYMENT_INTERVAL_FA,
      "close_requires_end",
    );
  }

  const siblings = await listEmploymentsForPerson(existing.personId, db);
  assertNoOverlapWithExisting(
    interval,
    siblings.map(toInterval),
    id,
  );

  try {
    const updated = await db.employment.updateMany({
      where: { id, endDateExclusive: null },
      data: {
        endDateExclusive: dateOnlyToDb(interval.endDateExclusive),
      },
    });
    if (updated.count === 0) {
      const again = await db.employment.findUnique({ where: { id } });
      if (!again) {
        throw new EmploymentError(
          "EMPLOYMENT_NOT_FOUND",
          MSG_EMPLOYMENT_NOT_FOUND_FA,
        );
      }
      throw new EmploymentError(
        "VALIDATION",
        MSG_EMPLOYMENT_ALREADY_CLOSED_FA,
      );
    }
    const row = await db.employment.findUnique({ where: { id } });
    if (!row) {
      throw new EmploymentError(
        "EMPLOYMENT_NOT_FOUND",
        MSG_EMPLOYMENT_NOT_FOUND_FA,
      );
    }
    return mapEmployment(row);
  } catch (err) {
    if (err instanceof EmploymentError) throw err;
    if (isExclusionViolation(err)) {
      throw new EmploymentError(
        "OVERLAPPING_EMPLOYMENT",
        MSG_OVERLAPPING_EMPLOYMENT_FA,
        "pg_exclusion_23P01",
      );
    }
    throw err;
  }
}

export async function listEmploymentsForPerson(
  personId: string,
  db: PrismaClient = getPersonDb(),
): Promise<EmploymentRecord[]> {
  const rows = await db.employment.findMany({
    where: { personId },
    orderBy: { startDate: "asc" },
  });
  return rows.map(mapEmployment);
}

export async function getEmploymentById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<EmploymentRecord | null> {
  const row = await db.employment.findUnique({ where: { id } });
  return row ? mapEmployment(row) : null;
}

export async function getActiveEmploymentAsOf(
  personId: string,
  asOf: string,
  db: PrismaClient = getPersonDb(),
): Promise<EmploymentRecord | null> {
  const rows = await listEmploymentsForPerson(personId, db);
  assertAtMostOneActiveAsOf(rows, asOf);
  const active = rows.filter((e) => isEmploymentActiveAsOf(e, asOf));
  return active[0] ?? null;
}

export {
  assertValidEmploymentInterval,
  assertNoOverlapWithExisting,
  isEmploymentActiveAsOf,
  assertAtMostOneActiveAsOf,
} from "./employment-invariants";
