/**
 * Secondary Assignment projection writers + reads (Story 3.8 / FR-12).
 *
 * Internal / seed / Epic-4-ready surface — NOT operator Secondary create/change/end.
 * AD-2: upserting projections is not a substitute for event-store append.
 * FR-12 / FR-29: Secondary does NOT consume headcount by default — no @divan/headcount.
 *
 * Do NOT export createSecondaryAssignment / assignSecondaryRole / endSecondary.
 */

import type { PrismaClient } from "@divan/db";

import { getPersonDb } from "./db";
import { getEmploymentById } from "./employment";
import {
  MSG_EMPLOYMENT_NOT_FOUND_FA,
  MSG_GRADE_NOT_IN_LADDER_FA,
  MSG_INVALID_SECONDARY_INTERVAL_FA,
  MSG_OVERLAPPING_EQUIVALENT_SECONDARY_FA,
  MSG_SECONDARY_ALREADY_CLOSED_FA,
  MSG_SECONDARY_ASSIGNMENT_NOT_FOUND_FA,
  MSG_SECONDARY_REF_NOT_FOUND_FA,
  MSG_SENTINEL_OPTIONAL_FA,
  PersonIdentityError,
  SecondaryAssignmentError,
} from "./errors";
import {
  registerJobRefDependencyHook,
  type JobRefConcept,
} from "./job-reference";
import { normalizeOptionalString } from "./normalize";
import { registerOrgUnitDependencyHook } from "./org-unit";
import {
  assertNoEquivalentOverlap,
  assertPersonMatchesEmployment,
  assertSecondaryGradeMatchesLadder,
  assertSecondaryWithinEmployment,
  assertValidSecondaryInterval,
  isSecondaryActiveAsOf,
} from "./secondary-assignment-invariants";
import { assertReasonTypeInInventory } from "./secondary-assignment-inventory";

export type SecondaryAssignmentRecord = {
  id: string;
  personId: string;
  employmentId: string;
  orgUnitId: string;
  reasonType: string;
  organizationalRoleId: string | null;
  jobTitleId: string | null;
  ladderId: string | null;
  gradeId: string | null;
  seniorityId: string | null;
  startDate: string;
  endDateExclusive: string | null;
  sourceEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApplySecondaryAssignmentProjectionInput = {
  /** When set, updates that projection row; otherwise creates. */
  id?: string;
  personId: string;
  employmentId: string;
  orgUnitId: string;
  reasonType: string;
  organizationalRoleId?: string | null;
  jobTitleId?: string | null;
  ladderId?: string | null;
  gradeId?: string | null;
  seniorityId?: string | null;
  startDate: string;
  endDateExclusive?: string | null;
  sourceEventId?: string | null;
};

function dateOnlyToDb(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function dateOnlyFromDb(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapSecondary(row: {
  id: string;
  personId: string;
  employmentId: string;
  orgUnitId: string;
  reasonType: string;
  organizationalRoleId: string | null;
  jobTitleId: string | null;
  ladderId: string | null;
  gradeId: string | null;
  seniorityId: string | null;
  startDate: Date;
  endDateExclusive: Date | null;
  sourceEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SecondaryAssignmentRecord {
  return {
    id: row.id,
    personId: row.personId,
    employmentId: row.employmentId,
    orgUnitId: row.orgUnitId,
    reasonType: row.reasonType,
    organizationalRoleId: row.organizationalRoleId,
    jobTitleId: row.jobTitleId,
    ladderId: row.ladderId,
    gradeId: row.gradeId,
    seniorityId: row.seniorityId,
    startDate: dateOnlyFromDb(row.startDate),
    endDateExclusive: row.endDateExclusive
      ? dateOnlyFromDb(row.endDateExclusive)
      : null,
    sourceEventId: row.sourceEventId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEquivalentSibling(row: SecondaryAssignmentRecord) {
  return {
    id: row.id,
    personId: row.personId,
    orgUnitId: row.orgUnitId,
    reasonType: row.reasonType,
    startDate: row.startDate,
    endDateExclusive: row.endDateExclusive,
  };
}

function normalizeOptionalRefId(
  value: string | null | undefined,
): string | null {
  try {
    return normalizeOptionalString(value);
  } catch (err) {
    if (err instanceof PersonIdentityError && err.code === "SENTINEL_VALUE") {
      throw new SecondaryAssignmentError("SENTINEL_VALUE", MSG_SENTINEL_OPTIONAL_FA);
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
      e.message.includes("SecondaryAssignment_equivalent_effective_excl") ||
      /exclusion_violation/i.test(e.message)
    ) {
      return true;
    }
  }
  return false;
}

function isFkViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === "P2003") return true;
  if (typeof e.message === "string" && /foreign key/i.test(e.message)) {
    return true;
  }
  return false;
}

async function assertRefsExist(
  input: {
    employmentId: string;
    orgUnitId: string;
    organizationalRoleId: string | null;
    jobTitleId: string | null;
    ladderId: string | null;
    gradeId: string | null;
    seniorityId: string | null;
  },
  db: PrismaClient,
): Promise<void> {
  const employment = await getEmploymentById(input.employmentId, db);
  if (!employment) {
    throw new SecondaryAssignmentError(
      "EMPLOYMENT_NOT_FOUND",
      MSG_EMPLOYMENT_NOT_FOUND_FA,
    );
  }

  const orgUnit = await db.organizationalUnit.findUnique({
    where: { id: input.orgUnitId },
  });
  if (!orgUnit) {
    throw new SecondaryAssignmentError(
      "SECONDARY_REF_NOT_FOUND",
      MSG_SECONDARY_REF_NOT_FOUND_FA,
      "org_unit",
    );
  }
  // orgUnitId is NOT TEAM-only — DEPARTMENT / BU / TEAM all allowed.

  if (input.organizationalRoleId) {
    const role = await db.organizationalRole.findUnique({
      where: { id: input.organizationalRoleId },
    });
    if (!role) {
      throw new SecondaryAssignmentError(
        "SECONDARY_REF_NOT_FOUND",
        MSG_SECONDARY_REF_NOT_FOUND_FA,
        "organizational_role",
      );
    }
  }
  if (input.jobTitleId) {
    const title = await db.jobTitle.findUnique({
      where: { id: input.jobTitleId },
    });
    if (!title) {
      throw new SecondaryAssignmentError(
        "SECONDARY_REF_NOT_FOUND",
        MSG_SECONDARY_REF_NOT_FOUND_FA,
        "job_title",
      );
    }
  }
  if (input.ladderId) {
    const ladder = await db.ladder.findUnique({
      where: { id: input.ladderId },
    });
    if (!ladder) {
      throw new SecondaryAssignmentError(
        "SECONDARY_REF_NOT_FOUND",
        MSG_SECONDARY_REF_NOT_FOUND_FA,
        "ladder",
      );
    }
  }
  if (input.gradeId) {
    const grade = await db.grade.findUnique({
      where: { id: input.gradeId },
    });
    if (!grade) {
      throw new SecondaryAssignmentError(
        "SECONDARY_REF_NOT_FOUND",
        MSG_SECONDARY_REF_NOT_FOUND_FA,
        "grade",
      );
    }
    if (input.ladderId) {
      assertSecondaryGradeMatchesLadder(grade, input.ladderId);
    }
  }
  if (input.seniorityId) {
    const seniority = await db.seniority.findUnique({
      where: { id: input.seniorityId },
    });
    if (!seniority) {
      throw new SecondaryAssignmentError(
        "SECONDARY_REF_NOT_FOUND",
        MSG_SECONDARY_REF_NOT_FOUND_FA,
        "seniority",
      );
    }
  }
}

/**
 * Apply (create/update) a Secondary Assignment projection after invariant checks.
 * Maps exclusion / FK violations to typed domain errors.
 */
export async function applySecondaryAssignmentProjection(
  input: ApplySecondaryAssignmentProjectionInput,
  db: PrismaClient = getPersonDb(),
): Promise<SecondaryAssignmentRecord> {
  ensureSecondaryAssignmentHooksRegistered();

  const interval = assertValidSecondaryInterval(
    input.startDate,
    input.endDateExclusive,
  );
  const reasonType = assertReasonTypeInInventory(input.reasonType);
  const organizationalRoleId = normalizeOptionalRefId(
    input.organizationalRoleId ?? null,
  );
  const jobTitleId = normalizeOptionalRefId(input.jobTitleId ?? null);
  const ladderId = normalizeOptionalRefId(input.ladderId ?? null);
  const gradeId = normalizeOptionalRefId(input.gradeId ?? null);
  const seniorityId = normalizeOptionalRefId(input.seniorityId ?? null);
  const sourceEventId = normalizeOptionalRefId(input.sourceEventId ?? null);

  if (gradeId && ladderId) {
    const grade = await db.grade.findUnique({ where: { id: gradeId } });
    if (!grade) {
      throw new SecondaryAssignmentError(
        "SECONDARY_REF_NOT_FOUND",
        MSG_SECONDARY_REF_NOT_FOUND_FA,
        "grade",
      );
    }
    if (grade.ladderId !== ladderId) {
      throw new SecondaryAssignmentError(
        "GRADE_NOT_IN_LADDER",
        MSG_GRADE_NOT_IN_LADDER_FA,
      );
    }
  }

  await assertRefsExist(
    {
      employmentId: input.employmentId,
      orgUnitId: input.orgUnitId,
      organizationalRoleId,
      jobTitleId,
      ladderId,
      gradeId,
      seniorityId,
    },
    db,
  );

  const employment = await getEmploymentById(input.employmentId, db);
  if (!employment) {
    throw new SecondaryAssignmentError(
      "EMPLOYMENT_NOT_FOUND",
      MSG_EMPLOYMENT_NOT_FOUND_FA,
    );
  }
  assertPersonMatchesEmployment(input.personId, employment.personId);
  assertSecondaryWithinEmployment(interval, employment);

  const siblings = await listSecondaryAssignmentsForPerson(input.personId, db);
  assertNoEquivalentOverlap(
    {
      personId: input.personId,
      orgUnitId: input.orgUnitId,
      reasonType,
      startDate: interval.startDate,
      endDateExclusive: interval.endDateExclusive,
    },
    siblings.map(toEquivalentSibling),
    input.id,
  );

  const data = {
    personId: input.personId,
    employmentId: input.employmentId,
    orgUnitId: input.orgUnitId,
    reasonType,
    organizationalRoleId,
    jobTitleId,
    ladderId,
    gradeId,
    seniorityId,
    startDate: dateOnlyToDb(interval.startDate),
    endDateExclusive: interval.endDateExclusive
      ? dateOnlyToDb(interval.endDateExclusive)
      : null,
    sourceEventId,
  };

  try {
    if (input.id) {
      const existing = await db.secondaryAssignment.findUnique({
        where: { id: input.id },
      });
      if (!existing || existing.personId !== input.personId) {
        throw new SecondaryAssignmentError(
          "SECONDARY_ASSIGNMENT_NOT_FOUND",
          MSG_SECONDARY_ASSIGNMENT_NOT_FOUND_FA,
        );
      }
      if (existing.endDateExclusive !== null) {
        throw new SecondaryAssignmentError(
          "SECONDARY_ALREADY_CLOSED",
          MSG_SECONDARY_ALREADY_CLOSED_FA,
        );
      }
      // Race-safe vs close: only mutate while still open.
      const updated = await db.secondaryAssignment.updateMany({
        where: { id: input.id, endDateExclusive: null },
        data: { ...data, updatedAt: new Date() },
      });
      if (updated.count === 0) {
        const again = await db.secondaryAssignment.findUnique({
          where: { id: input.id },
        });
        if (!again || again.personId !== input.personId) {
          throw new SecondaryAssignmentError(
            "SECONDARY_ASSIGNMENT_NOT_FOUND",
            MSG_SECONDARY_ASSIGNMENT_NOT_FOUND_FA,
          );
        }
        throw new SecondaryAssignmentError(
          "SECONDARY_ALREADY_CLOSED",
          MSG_SECONDARY_ALREADY_CLOSED_FA,
        );
      }
      const row = await db.secondaryAssignment.findUnique({
        where: { id: input.id },
      });
      if (!row) {
        throw new SecondaryAssignmentError(
          "SECONDARY_ASSIGNMENT_NOT_FOUND",
          MSG_SECONDARY_ASSIGNMENT_NOT_FOUND_FA,
        );
      }
      return mapSecondary(row);
    }

    const row = await db.secondaryAssignment.create({ data });
    return mapSecondary(row);
  } catch (err) {
    if (err instanceof SecondaryAssignmentError) throw err;
    if (isExclusionViolation(err)) {
      throw new SecondaryAssignmentError(
        "OVERLAPPING_EQUIVALENT_SECONDARY",
        MSG_OVERLAPPING_EQUIVALENT_SECONDARY_FA,
        "pg_exclusion_23P01",
      );
    }
    if (isFkViolation(err)) {
      throw new SecondaryAssignmentError(
        "SECONDARY_REF_NOT_FOUND",
        MSG_SECONDARY_REF_NOT_FOUND_FA,
        "fk",
      );
    }
    throw err;
  }
}

/**
 * Close an open Secondary Assignment interval.
 * Does not append events; race-safe via conditional updateMany.
 */
export async function closeSecondaryAssignmentProjection(
  id: string,
  endDateExclusive: string,
  db: PrismaClient = getPersonDb(),
): Promise<SecondaryAssignmentRecord> {
  ensureSecondaryAssignmentHooksRegistered();

  if (!endDateExclusive?.trim()) {
    throw new SecondaryAssignmentError(
      "INVALID_SECONDARY_INTERVAL",
      MSG_INVALID_SECONDARY_INTERVAL_FA,
      "close_requires_end",
    );
  }

  const existing = await db.secondaryAssignment.findUnique({ where: { id } });
  if (!existing) {
    throw new SecondaryAssignmentError(
      "SECONDARY_ASSIGNMENT_NOT_FOUND",
      MSG_SECONDARY_ASSIGNMENT_NOT_FOUND_FA,
    );
  }
  if (existing.endDateExclusive !== null) {
    throw new SecondaryAssignmentError(
      "SECONDARY_ALREADY_CLOSED",
      MSG_SECONDARY_ALREADY_CLOSED_FA,
    );
  }

  const startDate = dateOnlyFromDb(existing.startDate);
  const interval = assertValidSecondaryInterval(startDate, endDateExclusive);
  if (interval.endDateExclusive === null) {
    throw new SecondaryAssignmentError(
      "INVALID_SECONDARY_INTERVAL",
      MSG_INVALID_SECONDARY_INTERVAL_FA,
      "close_requires_end",
    );
  }

  const employment = await getEmploymentById(existing.employmentId, db);
  if (!employment) {
    throw new SecondaryAssignmentError(
      "EMPLOYMENT_NOT_FOUND",
      MSG_EMPLOYMENT_NOT_FOUND_FA,
    );
  }
  assertSecondaryWithinEmployment(interval, employment);

  const siblings = await listSecondaryAssignmentsForPerson(
    existing.personId,
    db,
  );
  assertNoEquivalentOverlap(
    {
      personId: existing.personId,
      orgUnitId: existing.orgUnitId,
      reasonType: existing.reasonType,
      startDate: interval.startDate,
      endDateExclusive: interval.endDateExclusive,
    },
    siblings.map(toEquivalentSibling),
    id,
  );

  try {
    const updated = await db.secondaryAssignment.updateMany({
      where: { id, endDateExclusive: null },
      data: {
        endDateExclusive: dateOnlyToDb(interval.endDateExclusive),
        updatedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      const again = await db.secondaryAssignment.findUnique({ where: { id } });
      if (!again) {
        throw new SecondaryAssignmentError(
          "SECONDARY_ASSIGNMENT_NOT_FOUND",
          MSG_SECONDARY_ASSIGNMENT_NOT_FOUND_FA,
        );
      }
      throw new SecondaryAssignmentError(
        "SECONDARY_ALREADY_CLOSED",
        MSG_SECONDARY_ALREADY_CLOSED_FA,
      );
    }
    const row = await db.secondaryAssignment.findUnique({ where: { id } });
    if (!row) {
      throw new SecondaryAssignmentError(
        "SECONDARY_ASSIGNMENT_NOT_FOUND",
        MSG_SECONDARY_ASSIGNMENT_NOT_FOUND_FA,
      );
    }
    return mapSecondary(row);
  } catch (err) {
    if (err instanceof SecondaryAssignmentError) throw err;
    if (isExclusionViolation(err)) {
      throw new SecondaryAssignmentError(
        "OVERLAPPING_EQUIVALENT_SECONDARY",
        MSG_OVERLAPPING_EQUIVALENT_SECONDARY_FA,
        "pg_exclusion_23P01",
      );
    }
    throw err;
  }
}

export async function getSecondaryAssignmentById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<SecondaryAssignmentRecord | null> {
  const row = await db.secondaryAssignment.findUnique({ where: { id } });
  return row ? mapSecondary(row) : null;
}

export async function listSecondaryAssignmentsForEmployment(
  employmentId: string,
  db: PrismaClient = getPersonDb(),
): Promise<SecondaryAssignmentRecord[]> {
  const rows = await db.secondaryAssignment.findMany({
    where: { employmentId },
    orderBy: { startDate: "asc" },
  });
  return rows.map(mapSecondary);
}

export async function listSecondaryAssignmentsForPerson(
  personId: string,
  db: PrismaClient = getPersonDb(),
): Promise<SecondaryAssignmentRecord[]> {
  const rows = await db.secondaryAssignment.findMany({
    where: { personId },
    orderBy: { startDate: "asc" },
  });
  return rows.map(mapSecondary);
}

export type ListActiveSecondaryAsOfScope =
  | { personId: string }
  | { employmentId: string };

/**
 * Active Secondaries as-of date. Zero OK; many OK (not exactly-one).
 */
export async function listActiveSecondaryAssignmentsAsOf(
  scope: ListActiveSecondaryAsOfScope,
  asOf: string,
  db: PrismaClient = getPersonDb(),
): Promise<SecondaryAssignmentRecord[]> {
  const rows =
    "personId" in scope
      ? await listSecondaryAssignmentsForPerson(scope.personId, db)
      : await listSecondaryAssignmentsForEmployment(scope.employmentId, db);
  return rows.filter((s) => isSecondaryActiveAsOf(s, asOf));
}

// --- Dependency hooks (AC #7) ---

let hooksRegistered = false;

/** UTC date-only midnight for “active as of today” hook queries. */
function utcTodayDateOnly(): Date {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

/**
 * Secondary still active as-of today: start ≤ today < endExclusive (null end = +∞).
 */
function activeSecondaryAsOfTodayFilter(
  extra: Record<string, string>,
): {
  startDate: { lte: Date };
  OR: Array<{ endDateExclusive: null } | { endDateExclusive: { gt: Date } }>;
  orgUnitId?: string;
  organizationalRoleId?: string;
  jobTitleId?: string;
  ladderId?: string;
  gradeId?: string;
  seniorityId?: string;
} {
  const today = utcTodayDateOnly();
  return {
    ...extra,
    startDate: { lte: today },
    OR: [{ endDateExclusive: null }, { endDateExclusive: { gt: today } }],
  };
}

/**
 * Register Secondary-active dependency checks on OrgUnit + job-ref deactivate.
 * Idempotent. Call from seed / apply / close and from OrgUnit/job-ref deactivate paths.
 * Does NOT remove Primary hooks from 3.7.
 */
export function ensureSecondaryAssignmentHooksRegistered(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;

  registerOrgUnitDependencyHook(async (unitId, db) => {
    const open = await db.secondaryAssignment.findFirst({
      where: activeSecondaryAsOfTodayFilter({ orgUnitId: unitId }),
      select: { id: true },
    });
    if (open) {
      return {
        blocked: true,
        reasons: [`open_secondary_assignment:${open.id}:org_unit`],
      };
    }
    return { blocked: false };
  });

  registerJobRefDependencyHook(async (concept, refId, db) => {
    const where = activeSecondaryWhereForJobRef(concept, refId);
    if (!where) return { blocked: false };

    const open = await db.secondaryAssignment.findFirst({
      where,
      select: { id: true },
    });
    if (open) {
      return {
        blocked: true,
        reasons: [`open_secondary_assignment:${open.id}:${concept}`],
      };
    }
    return { blocked: false };
  });
}

/** Selfcheck cleanup — clears registration flag so hooks can be re-bound after clear*ForTests. */
export function resetSecondaryAssignmentHooksRegistrationForTests(): void {
  hooksRegistered = false;
}

function activeSecondaryWhereForJobRef(
  concept: JobRefConcept,
  refId: string,
): ReturnType<typeof activeSecondaryAsOfTodayFilter> | null {
  switch (concept) {
    case "organizational_role":
      return activeSecondaryAsOfTodayFilter({ organizationalRoleId: refId });
    case "job_title":
      return activeSecondaryAsOfTodayFilter({ jobTitleId: refId });
    case "ladder":
      return activeSecondaryAsOfTodayFilter({ ladderId: refId });
    case "grade":
      return activeSecondaryAsOfTodayFilter({ gradeId: refId });
    case "seniority":
      return activeSecondaryAsOfTodayFilter({ seniorityId: refId });
    default: {
      const _exhaustive: never = concept;
      void _exhaustive;
      return null;
    }
  }
}

export {
  assertValidSecondaryInterval,
  assertNoEquivalentOverlap,
  assertPersonMatchesEmployment,
  assertSecondaryWithinEmployment,
  isSecondaryActiveAsOf,
  assertSecondaryGradeMatchesLadder,
} from "./secondary-assignment-invariants";

export type { SecondaryInterval } from "./secondary-assignment-invariants";

export {
  AR_SECONDARY_INVENTORY,
  assertReasonTypeInInventory,
  isReasonTypeInInventory,
  normalizeReasonType,
} from "./secondary-assignment-inventory";

export type { ArSecondaryReasonType } from "./secondary-assignment-inventory";
