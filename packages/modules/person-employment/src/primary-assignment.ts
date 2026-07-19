/**
 * Primary Assignment projection writers + reads (Story 3.7 / FR-11).
 *
 * Internal / seed / Epic-4-ready surface — NOT operator Start/Transfer/job-change.
 * AD-2: upserting projections is not a substitute for event-store append.
 *
 * Do NOT export createPrimaryAssignment / transferPrimary / assignPersonToTeam.
 */

import type { PrismaClient } from "@divan/db";

import { getPersonDb } from "./db";
import {
  getActiveEmploymentAsOf,
  getEmploymentById,
} from "./employment";
import {
  MSG_EMPLOYMENT_NOT_FOUND_FA,
  MSG_OVERLAPPING_PRIMARY_ASSIGNMENT_FA,
  MSG_PRIMARY_ALREADY_CLOSED_FA,
  MSG_PRIMARY_ASSIGNMENT_NOT_FOUND_FA,
  MSG_PRIMARY_REF_NOT_FOUND_FA,
  MSG_INVALID_PRIMARY_INTERVAL_FA,
  MSG_SENTINEL_OPTIONAL_FA,
  PersonIdentityError,
  PrimaryAssignmentError,
} from "./errors";
import {
  registerJobRefDependencyHook,
  type JobRefConcept,
} from "./job-reference";
import { normalizeOptionalString } from "./normalize";
import { registerOrgUnitDependencyHook } from "./org-unit";
import {
  assertGradeMatchesLadder,
  assertNoOverlapWithExistingPrimaries,
  assertPrimaryWithinEmployment,
  assertTeamUnitIsTeam,
  assertValidPrimaryInterval,
  isPrimaryActiveAsOf,
  type PrimaryInterval,
} from "./primary-assignment-invariants";

export type PrimaryAssignmentRecord = {
  id: string;
  employmentId: string;
  teamId: string;
  organizationalRoleId: string;
  jobTitleId: string;
  ladderId: string;
  gradeId: string;
  seniorityId: string | null;
  startDate: string;
  endDateExclusive: string | null;
  sourceEventId: string | null;
  /** Linked Approval id; null when exempt or legacy. */
  headcountApprovalId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApplyPrimaryAssignmentProjectionInput = {
  /** When set, updates that projection row; otherwise creates. */
  id?: string;
  employmentId: string;
  teamId: string;
  organizationalRoleId: string;
  jobTitleId: string;
  ladderId: string;
  gradeId: string;
  seniorityId?: string | null;
  startDate: string;
  endDateExclusive?: string | null;
  sourceEventId?: string | null;
  headcountApprovalId?: string | null;
};

export type TeamMembershipAsOf = {
  personId: string;
  employmentId: string;
  primaryAssignmentId: string;
  teamId: string;
  asOf: string;
};

function dateOnlyToDb(dateOnly: string): Date {
  // Noon UTC — avoids PG DATE session-TZ off-by-one for Asia/Tehran midnights.
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

function dateOnlyFromDb(d: Date): string {
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mapPrimary(row: {
  id: string;
  employmentId: string;
  teamId: string;
  organizationalRoleId: string;
  jobTitleId: string;
  ladderId: string;
  gradeId: string;
  seniorityId: string | null;
  startDate: Date;
  endDateExclusive: Date | null;
  sourceEventId: string | null;
  headcountApprovalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PrimaryAssignmentRecord {
  return {
    id: row.id,
    employmentId: row.employmentId,
    teamId: row.teamId,
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
    headcountApprovalId: row.headcountApprovalId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toInterval(
  row: PrimaryAssignmentRecord,
): PrimaryInterval & { id: string } {
  return {
    id: row.id,
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
      throw new PrimaryAssignmentError("SENTINEL_VALUE", MSG_SENTINEL_OPTIONAL_FA);
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
      e.message.includes("PrimaryAssignment_employment_effective_excl") ||
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
    teamId: string;
    organizationalRoleId: string;
    jobTitleId: string;
    ladderId: string;
    gradeId: string;
    seniorityId: string | null;
  },
  db: PrismaClient,
): Promise<void> {
  const employment = await getEmploymentById(input.employmentId, db);
  if (!employment) {
    throw new PrimaryAssignmentError(
      "EMPLOYMENT_NOT_FOUND",
      MSG_EMPLOYMENT_NOT_FOUND_FA,
    );
  }

  const team = await db.organizationalUnit.findUnique({
    where: { id: input.teamId },
  });
  if (!team) {
    throw new PrimaryAssignmentError(
      "REF_NOT_FOUND",
      MSG_PRIMARY_REF_NOT_FOUND_FA,
      "team",
    );
  }
  assertTeamUnitIsTeam(team);

  const [role, title, ladder, grade] = await Promise.all([
    db.organizationalRole.findUnique({
      where: { id: input.organizationalRoleId },
    }),
    db.jobTitle.findUnique({ where: { id: input.jobTitleId } }),
    db.ladder.findUnique({ where: { id: input.ladderId } }),
    db.grade.findUnique({ where: { id: input.gradeId } }),
  ]);

  if (!role) {
    throw new PrimaryAssignmentError(
      "REF_NOT_FOUND",
      MSG_PRIMARY_REF_NOT_FOUND_FA,
      "organizational_role",
    );
  }
  if (!title) {
    throw new PrimaryAssignmentError(
      "REF_NOT_FOUND",
      MSG_PRIMARY_REF_NOT_FOUND_FA,
      "job_title",
    );
  }
  if (!ladder) {
    throw new PrimaryAssignmentError(
      "REF_NOT_FOUND",
      MSG_PRIMARY_REF_NOT_FOUND_FA,
      "ladder",
    );
  }
  if (!grade) {
    throw new PrimaryAssignmentError(
      "REF_NOT_FOUND",
      MSG_PRIMARY_REF_NOT_FOUND_FA,
      "grade",
    );
  }
  assertGradeMatchesLadder(grade, input.ladderId);

  if (input.seniorityId) {
    const seniority = await db.seniority.findUnique({
      where: { id: input.seniorityId },
    });
    if (!seniority) {
      throw new PrimaryAssignmentError(
        "REF_NOT_FOUND",
        MSG_PRIMARY_REF_NOT_FOUND_FA,
        "seniority",
      );
    }
  }
}

/**
 * Apply (create/update) a Primary Assignment projection after invariant checks.
 * Maps exclusion / FK violations to typed domain errors.
 */
export async function applyPrimaryAssignmentProjection(
  input: ApplyPrimaryAssignmentProjectionInput,
  db: PrismaClient = getPersonDb(),
): Promise<PrimaryAssignmentRecord> {
  ensurePrimaryAssignmentHooksRegistered();

  const interval = assertValidPrimaryInterval(
    input.startDate,
    input.endDateExclusive,
  );
  const seniorityId = normalizeOptionalRefId(input.seniorityId ?? null);
  const sourceEventId = normalizeOptionalRefId(input.sourceEventId ?? null);
  const headcountApprovalId = normalizeOptionalRefId(
    input.headcountApprovalId ?? null,
  );

  await assertRefsExist(
    {
      employmentId: input.employmentId,
      teamId: input.teamId,
      organizationalRoleId: input.organizationalRoleId,
      jobTitleId: input.jobTitleId,
      ladderId: input.ladderId,
      gradeId: input.gradeId,
      seniorityId,
    },
    db,
  );

  const employment = await getEmploymentById(input.employmentId, db);
  if (!employment) {
    throw new PrimaryAssignmentError(
      "EMPLOYMENT_NOT_FOUND",
      MSG_EMPLOYMENT_NOT_FOUND_FA,
    );
  }
  assertPrimaryWithinEmployment(interval, employment);

  const siblings = await listPrimaryAssignmentsForEmployment(
    input.employmentId,
    db,
  );
  assertNoOverlapWithExistingPrimaries(
    interval,
    siblings.map(toInterval),
    input.id,
  );

  const data = {
    employmentId: input.employmentId,
    teamId: input.teamId,
    organizationalRoleId: input.organizationalRoleId,
    jobTitleId: input.jobTitleId,
    ladderId: input.ladderId,
    gradeId: input.gradeId,
    seniorityId,
    startDate: dateOnlyToDb(interval.startDate),
    endDateExclusive: interval.endDateExclusive
      ? dateOnlyToDb(interval.endDateExclusive)
      : null,
    sourceEventId,
    headcountApprovalId,
  };

  try {
    if (input.id) {
      const existing = await db.primaryAssignment.findUnique({
        where: { id: input.id },
      });
      if (!existing || existing.employmentId !== input.employmentId) {
        throw new PrimaryAssignmentError(
          "PRIMARY_ASSIGNMENT_NOT_FOUND",
          MSG_PRIMARY_ASSIGNMENT_NOT_FOUND_FA,
        );
      }
      if (existing.endDateExclusive !== null) {
        throw new PrimaryAssignmentError(
          "PRIMARY_ALREADY_CLOSED",
          MSG_PRIMARY_ALREADY_CLOSED_FA,
        );
      }
      const row = await db.primaryAssignment.update({
        where: { id: input.id },
        data,
      });
      return mapPrimary(row);
    }

    const row = await db.primaryAssignment.create({ data });
    return mapPrimary(row);
  } catch (err) {
    if (err instanceof PrimaryAssignmentError) throw err;
    if (isExclusionViolation(err)) {
      throw new PrimaryAssignmentError(
        "OVERLAPPING_PRIMARY_ASSIGNMENT",
        MSG_OVERLAPPING_PRIMARY_ASSIGNMENT_FA,
        "pg_exclusion_23P01",
      );
    }
    if (isFkViolation(err)) {
      throw new PrimaryAssignmentError(
        "REF_NOT_FOUND",
        MSG_PRIMARY_REF_NOT_FOUND_FA,
        "fk",
      );
    }
    throw err;
  }
}

/**
 * Close an open Primary Assignment interval.
 * Does not append events; race-safe via conditional updateMany.
 */
export async function closePrimaryAssignmentProjection(
  id: string,
  endDateExclusive: string,
  db: PrismaClient = getPersonDb(),
): Promise<PrimaryAssignmentRecord> {
  ensurePrimaryAssignmentHooksRegistered();

  if (!endDateExclusive?.trim()) {
    throw new PrimaryAssignmentError(
      "INVALID_PRIMARY_INTERVAL",
      MSG_INVALID_PRIMARY_INTERVAL_FA,
      "close_requires_end",
    );
  }

  const existing = await db.primaryAssignment.findUnique({ where: { id } });
  if (!existing) {
    throw new PrimaryAssignmentError(
      "PRIMARY_ASSIGNMENT_NOT_FOUND",
      MSG_PRIMARY_ASSIGNMENT_NOT_FOUND_FA,
    );
  }
  if (existing.endDateExclusive !== null) {
    throw new PrimaryAssignmentError(
      "PRIMARY_ALREADY_CLOSED",
      MSG_PRIMARY_ALREADY_CLOSED_FA,
    );
  }

  const startDate = dateOnlyFromDb(existing.startDate);
  const interval = assertValidPrimaryInterval(startDate, endDateExclusive);
  if (interval.endDateExclusive === null) {
    throw new PrimaryAssignmentError(
      "INVALID_PRIMARY_INTERVAL",
      MSG_INVALID_PRIMARY_INTERVAL_FA,
      "close_requires_end",
    );
  }

  const employment = await getEmploymentById(existing.employmentId, db);
  if (!employment) {
    throw new PrimaryAssignmentError(
      "EMPLOYMENT_NOT_FOUND",
      MSG_EMPLOYMENT_NOT_FOUND_FA,
    );
  }
  assertPrimaryWithinEmployment(interval, employment);

  const siblings = await listPrimaryAssignmentsForEmployment(
    existing.employmentId,
    db,
  );
  assertNoOverlapWithExistingPrimaries(interval, siblings.map(toInterval), id);

  try {
    const updated = await db.primaryAssignment.updateMany({
      where: { id, endDateExclusive: null },
      data: {
        endDateExclusive: dateOnlyToDb(interval.endDateExclusive),
      },
    });
    if (updated.count === 0) {
      const again = await db.primaryAssignment.findUnique({ where: { id } });
      if (!again) {
        throw new PrimaryAssignmentError(
          "PRIMARY_ASSIGNMENT_NOT_FOUND",
          MSG_PRIMARY_ASSIGNMENT_NOT_FOUND_FA,
        );
      }
      throw new PrimaryAssignmentError(
        "PRIMARY_ALREADY_CLOSED",
        MSG_PRIMARY_ALREADY_CLOSED_FA,
      );
    }
    const row = await db.primaryAssignment.findUnique({ where: { id } });
    if (!row) {
      throw new PrimaryAssignmentError(
        "PRIMARY_ASSIGNMENT_NOT_FOUND",
        MSG_PRIMARY_ASSIGNMENT_NOT_FOUND_FA,
      );
    }
    return mapPrimary(row);
  } catch (err) {
    if (err instanceof PrimaryAssignmentError) throw err;
    if (isExclusionViolation(err)) {
      throw new PrimaryAssignmentError(
        "OVERLAPPING_PRIMARY_ASSIGNMENT",
        MSG_OVERLAPPING_PRIMARY_ASSIGNMENT_FA,
        "pg_exclusion_23P01",
      );
    }
    throw err;
  }
}

export async function listPrimaryAssignmentsForEmployment(
  employmentId: string,
  db: PrismaClient = getPersonDb(),
): Promise<PrimaryAssignmentRecord[]> {
  const rows = await db.primaryAssignment.findMany({
    where: { employmentId },
    orderBy: { startDate: "asc" },
  });
  return rows.map(mapPrimary);
}

export async function getPrimaryAssignmentById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<PrimaryAssignmentRecord | null> {
  const row = await db.primaryAssignment.findUnique({ where: { id } });
  return row ? mapPrimary(row) : null;
}

export async function getActivePrimaryAssignmentAsOf(
  employmentId: string,
  asOf: string,
  db: PrismaClient = getPersonDb(),
): Promise<PrimaryAssignmentRecord | null> {
  const rows = await listPrimaryAssignmentsForEmployment(employmentId, db);
  const active = rows.filter((p) => isPrimaryActiveAsOf(p, asOf));
  // Multiple actives are always an integrity fault (even if Employment inactive).
  if (active.length > 1) {
    throw new PrimaryAssignmentError(
      "OVERLAPPING_PRIMARY_ASSIGNMENT",
      MSG_OVERLAPPING_PRIMARY_ASSIGNMENT_FA,
      "multiple_active_as_of",
    );
  }
  // Zero under active Employment → null for read models (use assertExactlyOne* to throw).
  return active[0] ?? null;
}

/**
 * FR-11 Team membership read model: active Employment → active Primary → Team.
 * Incomplete Primary projection returns null (does not throw REQUIRED).
 */
export async function resolveTeamMembershipAsOf(
  personId: string,
  asOf: string,
  db: PrismaClient = getPersonDb(),
): Promise<TeamMembershipAsOf | null> {
  const employment = await getActiveEmploymentAsOf(personId, asOf, db);
  if (!employment) return null;

  const primary = await getActivePrimaryAssignmentAsOf(
    employment.id,
    asOf,
    db,
  );
  if (!primary) return null;

  return {
    personId,
    employmentId: employment.id,
    primaryAssignmentId: primary.id,
    teamId: primary.teamId,
    asOf,
  };
}

// --- Dependency hooks (AC #6) ---

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
 * Primary still active as-of today: start ≤ today < endExclusive (null end = +∞).
 * Hook registry has no deactivate-as-of yet — approximate with UTC today.
 */
function activePrimaryAsOfTodayFilter(
  extra: Record<string, string>,
): {
  startDate: { lte: Date };
  OR: Array<{ endDateExclusive: null } | { endDateExclusive: { gt: Date } }>;
  teamId?: string;
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
 * Register Primary-active dependency checks on OrgUnit + job-ref deactivate.
 * Idempotent. Call from seed / selfcheck / module consumers so hooks are live.
 * Documented call site: seedDemoPrimaryAssignments + ensure on apply/close;
 * also invoked from OrgUnit/job-ref deactivation asserts (dynamic import).
 */
export function ensurePrimaryAssignmentHooksRegistered(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;

  registerOrgUnitDependencyHook(async (unitId, db) => {
    const open = await db.primaryAssignment.findFirst({
      where: activePrimaryAsOfTodayFilter({ teamId: unitId }),
      select: { id: true },
    });
    if (open) {
      return {
        blocked: true,
        reasons: [`open_primary_assignment:${open.id}:team`],
      };
    }
    return { blocked: false };
  });

  registerJobRefDependencyHook(async (concept, refId, db) => {
    const where = activePrimaryWhereForJobRef(concept, refId);
    if (!where) return { blocked: false };

    const open = await db.primaryAssignment.findFirst({
      where,
      select: { id: true },
    });
    if (open) {
      return {
        blocked: true,
        reasons: [`open_primary_assignment:${open.id}:${concept}`],
      };
    }
    return { blocked: false };
  });
}

/** Selfcheck cleanup — clears registration flag so hooks can be re-bound after clear*ForTests. */
export function resetPrimaryAssignmentHooksRegistrationForTests(): void {
  hooksRegistered = false;
}

function activePrimaryWhereForJobRef(
  concept: JobRefConcept,
  refId: string,
): ReturnType<typeof activePrimaryAsOfTodayFilter> | null {
  switch (concept) {
    case "organizational_role":
      return activePrimaryAsOfTodayFilter({ organizationalRoleId: refId });
    case "job_title":
      return activePrimaryAsOfTodayFilter({ jobTitleId: refId });
    case "ladder":
      return activePrimaryAsOfTodayFilter({ ladderId: refId });
    case "grade":
      return activePrimaryAsOfTodayFilter({ gradeId: refId });
    case "seniority":
      return activePrimaryAsOfTodayFilter({ seniorityId: refId });
    default: {
      const _exhaustive: never = concept;
      void _exhaustive;
      return null;
    }
  }
}

export {
  assertValidPrimaryInterval,
  assertNoOverlapWithExistingPrimaries,
  isPrimaryActiveAsOf,
  assertExactlyOneActivePrimaryAsOf,
  assertPrimaryWithinEmployment,
  assertPrimaryCoverageForActiveEmployment,
  assertTeamUnitIsTeam,
  assertGradeMatchesLadder,
} from "./primary-assignment-invariants";
