/**
 * Job-reference master-data writers + reads (Story 3.6 / FR-10).
 *
 * Five distinct concepts: OrganizationalRole, JobTitle, Ladder, Grade, Seniority.
 * Product verbs for reference data — NOT Assignment / Personnel Event mutations.
 * AD-2: job upsert is not a substitute for Role/Title/Grade change events.
 * No Grade↔Seniority mapping APIs.
 */

import type { PrismaClient } from "@divan/db";
import { Prisma } from "@divan/db";

import { getPersonDb } from "./db";
import { toLatinDigits } from "./digits";
import {
  JobRefError,
  MSG_BLOCKED_JOB_REF_OPERATION_FA,
  MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA,
  MSG_DUPLICATE_JOB_REF_CODE_FA,
  MSG_DUPLICATE_JOB_REF_RANK_FA,
  MSG_INACTIVE_LADDER_FA,
  MSG_JOB_REF_CODE_REQUIRED_FA,
  MSG_JOB_REF_DEACTIVATE_END_REQUIRED_FA,
  MSG_JOB_REF_LADDER_REQUIRED_FA,
  MSG_JOB_REF_NAME_REQUIRED_FA,
  MSG_JOB_REF_NOT_FOUND_FA,
  MSG_LADDER_HAS_ACTIVE_GRADES_FA,
  MSG_SENTINEL_OPTIONAL_FA,
} from "./errors";
import {
  assertGradeBelongsToLadder,
  assertValidHalfGradeRank,
  assertValidJobRefInterval,
  isJobRefActiveAsOf,
  type JobRefConcept,
  type JobRefInterval,
} from "./job-reference-invariants";
import { requireNonEmpty } from "./normalize";

export type JobRefBaseRecord = {
  id: string;
  code: string;
  nameFa: string;
  startDate: string;
  endDateExclusive: string | null;
  active: boolean;
  sourceEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationalRoleRecord = JobRefBaseRecord;
export type JobTitleRecord = JobRefBaseRecord;
export type LadderRecord = JobRefBaseRecord;
export type SeniorityRecord = JobRefBaseRecord;

export type GradeRecord = JobRefBaseRecord & {
  ladderId: string;
  /** Decimal(4,1) as string for JSON-safe transport (e.g. "12.5"). */
  rank: string;
};

export type CreateJobRefInput = {
  code: string;
  nameFa: string;
  startDate: string;
  endDateExclusive?: string | null;
};

export type CreateGradeInput = CreateJobRefInput & {
  ladderId: string;
  rank: string | number;
};

export type UpdateJobRefIdentityInput = {
  code?: string;
  nameFa?: string;
};

export type UpdateGradeIdentityInput = UpdateJobRefIdentityInput & {
  rank?: string | number;
  /** Only when no deps and uniqueness holds — otherwise fail-closed. */
  ladderId?: string;
};

/**
 * Named deactivation / structural-change dependency probe.
 * Full Assignment / Personnel Event checks land in 3.7+ / Epic 4 /
 * AR-TEMPORAL — do not invent disposition workflows here.
 * Returns OK when no hooks report blockers.
 */
export type JobRefDependencyCheckResult = {
  blocked: boolean;
  /** Stable reason codes for logs; Persian message is on JobRefError. */
  reasons?: string[];
};

export type JobRefDependencyHook = (
  concept: JobRefConcept,
  refId: string,
  db: PrismaClient,
) => Promise<JobRefDependencyCheckResult>;

const dependencyHooks: JobRefDependencyHook[] = [];

/** Test / future Assignment hooks — fail-closed when any hook reports blocked. */
export function registerJobRefDependencyHook(
  hook: JobRefDependencyHook,
): void {
  dependencyHooks.push(hook);
}

/** Selfcheck / test cleanup only. */
export function clearJobRefDependencyHooksForTests(): void {
  dependencyHooks.length = 0;
}

function dateOnlyToDb(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function dateOnlyFromDb(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapBase(row: {
  id: string;
  code: string;
  nameFa: string;
  startDate: Date;
  endDateExclusive: Date | null;
  active: boolean;
  sourceEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): JobRefBaseRecord {
  return {
    id: row.id,
    code: row.code,
    nameFa: row.nameFa,
    startDate: dateOnlyFromDb(row.startDate),
    endDateExclusive: row.endDateExclusive
      ? dateOnlyFromDb(row.endDateExclusive)
      : null,
    active: row.active,
    sourceEventId: row.sourceEventId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapGrade(row: {
  id: string;
  code: string;
  nameFa: string;
  ladderId: string;
  rank: Prisma.Decimal;
  startDate: Date;
  endDateExclusive: Date | null;
  active: boolean;
  sourceEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): GradeRecord {
  return {
    ...mapBase(row),
    ladderId: row.ladderId,
    rank: row.rank.toFixed(1),
  };
}

function requireJobRefName(value: string | null | undefined): string {
  try {
    return requireNonEmpty(value, MSG_JOB_REF_NAME_REQUIRED_FA);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "SENTINEL_VALUE"
    ) {
      throw new JobRefError("SENTINEL_VALUE", MSG_SENTINEL_OPTIONAL_FA);
    }
    if (
      err &&
      typeof err === "object" &&
      "messageFa" in err &&
      typeof (err as { messageFa: unknown }).messageFa === "string"
    ) {
      throw new JobRefError(
        "VALIDATION",
        (err as { messageFa: string }).messageFa,
      );
    }
    throw err;
  }
}

function requireJobRefCode(value: string | null | undefined): string {
  try {
    const raw = requireNonEmpty(value, MSG_JOB_REF_CODE_REQUIRED_FA);
    return toLatinDigits(raw).trim();
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "SENTINEL_VALUE"
    ) {
      throw new JobRefError("SENTINEL_VALUE", MSG_SENTINEL_OPTIONAL_FA);
    }
    if (
      err &&
      typeof err === "object" &&
      "messageFa" in err &&
      typeof (err as { messageFa: unknown }).messageFa === "string"
    ) {
      throw new JobRefError(
        "VALIDATION",
        (err as { messageFa: string }).messageFa,
      );
    }
    throw err;
  }
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

function prismaUniqueTargetsRank(err: unknown): boolean {
  if (!isPrismaUniqueViolation(err)) return false;
  const meta = (err as { meta?: { target?: string[] | string } }).meta;
  const target = meta?.target;
  if (Array.isArray(target)) {
    return target.includes("rank") || target.includes("ladderId_rank");
  }
  if (typeof target === "string") {
    return target.includes("rank");
  }
  return false;
}

function mapGradeUniqueViolation(err: unknown): never {
  if (prismaUniqueTargetsRank(err)) {
    throw new JobRefError(
      "DUPLICATE_JOB_REF_RANK",
      MSG_DUPLICATE_JOB_REF_RANK_FA,
    );
  }
  throw new JobRefError(
    "DUPLICATE_JOB_REF_CODE",
    MSG_DUPLICATE_JOB_REF_CODE_FA,
  );
}

function isPrismaFkViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2003"
  );
}

async function runDependencyHooks(
  concept: JobRefConcept,
  refId: string,
  db: PrismaClient,
): Promise<void> {
  for (const hook of dependencyHooks) {
    let result: JobRefDependencyCheckResult;
    try {
      result = await hook(concept, refId, db);
    } catch (err) {
      throw new JobRefError(
        "DEACTIVATION_BLOCKED_DEPENDENCIES",
        MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA,
        err instanceof Error ? err.message : "hook_threw",
      );
    }
    if (result.blocked) {
      throw new JobRefError(
        "DEACTIVATION_BLOCKED_DEPENDENCIES",
        MSG_DEACTIVATION_BLOCKED_DEPENDENCIES_FA,
        result.reasons?.join(",") ?? "hook_blocked",
      );
    }
  }
}

/**
 * Built-in structural gate + future Assignment/Event hooks.
 * Ladder: active Grades block deactivation (recommended policy).
 */
export async function assertJobRefDeactivationAllowed(
  concept: JobRefConcept,
  refId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  if (concept === "ladder") {
    const activeGrades = await db.grade.findMany({
      where: { ladderId: refId, active: true },
      select: { id: true, code: true },
    });
    if (activeGrades.length > 0) {
      throw new JobRefError(
        "LADDER_HAS_ACTIVE_GRADES",
        MSG_LADDER_HAS_ACTIVE_GRADES_FA,
        `active_grades:${activeGrades.map((g) => g.code).join(",")}`,
      );
    }
  }

  await runDependencyHooks(concept, refId, db);
}

/**
 * Structural change gate (e.g. Grade.ladderId move).
 * Same hook registry — fail-closed when deps exist.
 */
export async function assertJobRefChangeAllowed(
  concept: JobRefConcept,
  refId: string,
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  await runDependencyHooks(concept, refId, db);
}

type SimpleDelegate = {
  findUnique: (args: {
    where: { id?: string; code?: string };
  }) => Promise<{
    id: string;
    code: string;
    nameFa: string;
    startDate: Date;
    endDateExclusive: Date | null;
    active: boolean;
    sourceEventId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
  findMany: (args: {
    where?: { active?: boolean };
    orderBy?: { code: "asc" };
  }) => Promise<
    Array<{
      id: string;
      code: string;
      nameFa: string;
      startDate: Date;
      endDateExclusive: Date | null;
      active: boolean;
      sourceEventId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >;
  create: (args: {
    data: {
      code: string;
      nameFa: string;
      startDate: Date;
      endDateExclusive: Date | null;
      active: boolean;
      sourceEventId: null;
    };
  }) => Promise<{
    id: string;
    code: string;
    nameFa: string;
    startDate: Date;
    endDateExclusive: Date | null;
    active: boolean;
    sourceEventId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  update: (args: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => Promise<{
    id: string;
    code: string;
    nameFa: string;
    startDate: Date;
    endDateExclusive: Date | null;
    active: boolean;
    sourceEventId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

async function createSimpleRef(
  concept: Exclude<JobRefConcept, "grade">,
  delegate: SimpleDelegate,
  input: CreateJobRefInput,
): Promise<JobRefBaseRecord> {
  const code = requireJobRefCode(input.code);
  const nameFa = requireJobRefName(input.nameFa);
  const interval = assertValidJobRefInterval(
    input.startDate,
    input.endDateExclusive,
  );
  const active = interval.endDateExclusive === null;

  const existing = await delegate.findUnique({ where: { code } });
  if (existing) {
    throw new JobRefError(
      "DUPLICATE_JOB_REF_CODE",
      MSG_DUPLICATE_JOB_REF_CODE_FA,
      `${concept}:${code}`,
    );
  }

  try {
    const row = await delegate.create({
      data: {
        code,
        nameFa,
        startDate: dateOnlyToDb(interval.startDate),
        endDateExclusive: interval.endDateExclusive
          ? dateOnlyToDb(interval.endDateExclusive)
          : null,
        active,
        sourceEventId: null,
      },
    });
    return mapBase(row);
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      throw new JobRefError(
        "DUPLICATE_JOB_REF_CODE",
        MSG_DUPLICATE_JOB_REF_CODE_FA,
      );
    }
    throw err;
  }
}

async function activateSimpleRef(
  concept: Exclude<JobRefConcept, "grade">,
  delegate: SimpleDelegate,
  id: string,
): Promise<JobRefBaseRecord> {
  const existing = await delegate.findUnique({ where: { id } });
  if (!existing) {
    throw new JobRefError(
      "JOB_REF_NOT_FOUND",
      MSG_JOB_REF_NOT_FOUND_FA,
      concept,
    );
  }
  const row = await delegate.update({
    where: { id },
    data: { active: true, endDateExclusive: null },
  });
  return mapBase(row);
}

async function deactivateSimpleRef(
  concept: Exclude<JobRefConcept, "grade">,
  delegate: SimpleDelegate,
  id: string,
  endDateExclusive: string | null | undefined,
  db: PrismaClient,
): Promise<JobRefBaseRecord> {
  const existing = await delegate.findUnique({ where: { id } });
  if (!existing) {
    throw new JobRefError(
      "JOB_REF_NOT_FOUND",
      MSG_JOB_REF_NOT_FOUND_FA,
      concept,
    );
  }
  const mapped = mapBase(existing);
  if (!mapped.active) {
    return mapped;
  }
  await assertJobRefDeactivationAllowed(concept, id, db);

  let nextEnd = mapped.endDateExclusive;
  if (endDateExclusive !== undefined && endDateExclusive !== null) {
    if (
      typeof endDateExclusive === "string" &&
      endDateExclusive.trim() === ""
    ) {
      throw new JobRefError(
        "INVALID_JOB_REF_INTERVAL",
        MSG_JOB_REF_DEACTIVATE_END_REQUIRED_FA,
        "deactivate_end_empty",
      );
    }
    const closed = assertValidJobRefInterval(
      mapped.startDate,
      endDateExclusive,
    );
    nextEnd = closed.endDateExclusive;
  } else if (mapped.endDateExclusive === null) {
    throw new JobRefError(
      "INVALID_JOB_REF_INTERVAL",
      MSG_JOB_REF_DEACTIVATE_END_REQUIRED_FA,
      "deactivate_end_required",
    );
  }

  const row = await delegate.update({
    where: { id },
    data: {
      active: false,
      endDateExclusive: nextEnd ? dateOnlyToDb(nextEnd) : null,
    },
  });
  return mapBase(row);
}

async function updateSimpleIdentity(
  concept: Exclude<JobRefConcept, "grade">,
  delegate: SimpleDelegate,
  id: string,
  input: UpdateJobRefIdentityInput,
  db: PrismaClient,
): Promise<JobRefBaseRecord> {
  const existing = await delegate.findUnique({ where: { id } });
  if (!existing) {
    throw new JobRefError(
      "JOB_REF_NOT_FOUND",
      MSG_JOB_REF_NOT_FOUND_FA,
      concept,
    );
  }
  const data: { code?: string; nameFa?: string } = {};
  if (input.code !== undefined) {
    data.code = requireJobRefCode(input.code);
  }
  if (input.nameFa !== undefined) {
    data.nameFa = requireJobRefName(input.nameFa);
  }
  if (Object.keys(data).length === 0) {
    return mapBase(existing);
  }
  await assertJobRefChangeAllowed(concept, id, db);
  try {
    const row = await delegate.update({ where: { id }, data });
    return mapBase(row);
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      throw new JobRefError(
        "DUPLICATE_JOB_REF_CODE",
        MSG_DUPLICATE_JOB_REF_CODE_FA,
      );
    }
    throw err;
  }
}

async function listSimple(
  delegate: SimpleDelegate,
  options: { includeInactive?: boolean } = {},
): Promise<JobRefBaseRecord[]> {
  const rows = await delegate.findMany({
    where: options.includeInactive ? undefined : { active: true },
    orderBy: { code: "asc" },
  });
  return rows.map(mapBase);
}

// ── Organizational Role ─────────────────────────────────────────────

export async function createOrganizationalRole(
  input: CreateJobRefInput,
  db: PrismaClient = getPersonDb(),
): Promise<OrganizationalRoleRecord> {
  return createSimpleRef(
    "organizational_role",
    db.organizationalRole as unknown as SimpleDelegate,
    input,
  );
}

export async function activateOrganizationalRole(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<OrganizationalRoleRecord> {
  return activateSimpleRef(
    "organizational_role",
    db.organizationalRole as unknown as SimpleDelegate,
    id,
  );
}

export async function deactivateOrganizationalRole(
  id: string,
  endDateExclusive?: string | null,
  db: PrismaClient = getPersonDb(),
): Promise<OrganizationalRoleRecord> {
  return deactivateSimpleRef(
    "organizational_role",
    db.organizationalRole as unknown as SimpleDelegate,
    id,
    endDateExclusive,
    db,
  );
}

export async function updateOrganizationalRoleIdentity(
  id: string,
  input: UpdateJobRefIdentityInput,
  db: PrismaClient = getPersonDb(),
): Promise<OrganizationalRoleRecord> {
  return updateSimpleIdentity(
    "organizational_role",
    db.organizationalRole as unknown as SimpleDelegate,
    id,
    input,
    db,
  );
}

export async function getOrganizationalRoleById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<OrganizationalRoleRecord | null> {
  const row = await db.organizationalRole.findUnique({ where: { id } });
  return row ? mapBase(row) : null;
}

export async function listOrganizationalRoles(
  options: { includeInactive?: boolean } = {},
  db: PrismaClient = getPersonDb(),
): Promise<OrganizationalRoleRecord[]> {
  return listSimple(
    db.organizationalRole as unknown as SimpleDelegate,
    options,
  );
}

// ── Job Title ───────────────────────────────────────────────────────

export async function createJobTitle(
  input: CreateJobRefInput,
  db: PrismaClient = getPersonDb(),
): Promise<JobTitleRecord> {
  return createSimpleRef(
    "job_title",
    db.jobTitle as unknown as SimpleDelegate,
    input,
  );
}

export async function activateJobTitle(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<JobTitleRecord> {
  return activateSimpleRef(
    "job_title",
    db.jobTitle as unknown as SimpleDelegate,
    id,
  );
}

export async function deactivateJobTitle(
  id: string,
  endDateExclusive?: string | null,
  db: PrismaClient = getPersonDb(),
): Promise<JobTitleRecord> {
  return deactivateSimpleRef(
    "job_title",
    db.jobTitle as unknown as SimpleDelegate,
    id,
    endDateExclusive,
    db,
  );
}

export async function updateJobTitleIdentity(
  id: string,
  input: UpdateJobRefIdentityInput,
  db: PrismaClient = getPersonDb(),
): Promise<JobTitleRecord> {
  return updateSimpleIdentity(
    "job_title",
    db.jobTitle as unknown as SimpleDelegate,
    id,
    input,
    db,
  );
}

export async function getJobTitleById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<JobTitleRecord | null> {
  const row = await db.jobTitle.findUnique({ where: { id } });
  return row ? mapBase(row) : null;
}

export async function listJobTitles(
  options: { includeInactive?: boolean } = {},
  db: PrismaClient = getPersonDb(),
): Promise<JobTitleRecord[]> {
  return listSimple(db.jobTitle as unknown as SimpleDelegate, options);
}

// ── Ladder ──────────────────────────────────────────────────────────

export async function createLadder(
  input: CreateJobRefInput,
  db: PrismaClient = getPersonDb(),
): Promise<LadderRecord> {
  return createSimpleRef(
    "ladder",
    db.ladder as unknown as SimpleDelegate,
    input,
  );
}

export async function activateLadder(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<LadderRecord> {
  return activateSimpleRef(
    "ladder",
    db.ladder as unknown as SimpleDelegate,
    id,
  );
}

export async function deactivateLadder(
  id: string,
  endDateExclusive?: string | null,
  db: PrismaClient = getPersonDb(),
): Promise<LadderRecord> {
  return deactivateSimpleRef(
    "ladder",
    db.ladder as unknown as SimpleDelegate,
    id,
    endDateExclusive,
    db,
  );
}

export async function updateLadderIdentity(
  id: string,
  input: UpdateJobRefIdentityInput,
  db: PrismaClient = getPersonDb(),
): Promise<LadderRecord> {
  return updateSimpleIdentity(
    "ladder",
    db.ladder as unknown as SimpleDelegate,
    id,
    input,
    db,
  );
}

export async function getLadderById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<LadderRecord | null> {
  const row = await db.ladder.findUnique({ where: { id } });
  return row ? mapBase(row) : null;
}

export async function listLadders(
  options: { includeInactive?: boolean } = {},
  db: PrismaClient = getPersonDb(),
): Promise<LadderRecord[]> {
  return listSimple(db.ladder as unknown as SimpleDelegate, options);
}

// ── Grade ───────────────────────────────────────────────────────────

export async function createGrade(
  input: CreateGradeInput,
  db: PrismaClient = getPersonDb(),
): Promise<GradeRecord> {
  const code = requireJobRefCode(input.code);
  const nameFa = requireJobRefName(input.nameFa);
  const ladderId =
    typeof input.ladderId === "string" ? input.ladderId.trim() : "";
  if (!ladderId) {
    throw new JobRefError(
      "VALIDATION",
      MSG_JOB_REF_LADDER_REQUIRED_FA,
      "ladder_required",
    );
  }
  const rank = assertValidHalfGradeRank(input.rank);
  const interval = assertValidJobRefInterval(
    input.startDate,
    input.endDateExclusive,
  );
  const active = interval.endDateExclusive === null;

  const ladder = await db.ladder.findUnique({ where: { id: ladderId } });
  if (!ladder) {
    throw new JobRefError(
      "JOB_REF_NOT_FOUND",
      MSG_JOB_REF_NOT_FOUND_FA,
      "ladder_not_found",
    );
  }
  if (!ladder.active) {
    throw new JobRefError(
      "BLOCKED_JOB_REF_OPERATION",
      MSG_INACTIVE_LADDER_FA,
      "ladder_inactive",
    );
  }

  const dupCode = await db.grade.findUnique({
    where: { ladderId_code: { ladderId, code } },
  });
  if (dupCode) {
    throw new JobRefError(
      "DUPLICATE_JOB_REF_CODE",
      MSG_DUPLICATE_JOB_REF_CODE_FA,
      `grade_code:${code}`,
    );
  }

  const dupRank = await db.grade.findFirst({
    where: { ladderId, rank },
  });
  if (dupRank) {
    throw new JobRefError(
      "DUPLICATE_JOB_REF_RANK",
      MSG_DUPLICATE_JOB_REF_RANK_FA,
      `grade_rank:${rank.toString()}`,
    );
  }

  try {
    const row = await db.grade.create({
      data: {
        code,
        nameFa,
        ladderId,
        rank,
        startDate: dateOnlyToDb(interval.startDate),
        endDateExclusive: interval.endDateExclusive
          ? dateOnlyToDb(interval.endDateExclusive)
          : null,
        active,
        sourceEventId: null,
      },
    });
    return mapGrade(row);
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      mapGradeUniqueViolation(err);
    }
    if (isPrismaFkViolation(err)) {
      throw new JobRefError(
        "JOB_REF_NOT_FOUND",
        MSG_JOB_REF_NOT_FOUND_FA,
        "fk_ladder",
      );
    }
    throw err;
  }
}

export async function activateGrade(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<GradeRecord> {
  const existing = await getGradeById(id, db);
  if (!existing) {
    throw new JobRefError("JOB_REF_NOT_FOUND", MSG_JOB_REF_NOT_FOUND_FA);
  }
  const ladder = await db.ladder.findUnique({
    where: { id: existing.ladderId },
  });
  if (!ladder || !ladder.active) {
    throw new JobRefError(
      "BLOCKED_JOB_REF_OPERATION",
      MSG_INACTIVE_LADDER_FA,
      "ladder_inactive",
    );
  }
  const row = await db.grade.update({
    where: { id },
    data: { active: true, endDateExclusive: null },
  });
  return mapGrade(row);
}

export async function deactivateGrade(
  id: string,
  endDateExclusive?: string | null,
  db: PrismaClient = getPersonDb(),
): Promise<GradeRecord> {
  const existing = await getGradeById(id, db);
  if (!existing) {
    throw new JobRefError("JOB_REF_NOT_FOUND", MSG_JOB_REF_NOT_FOUND_FA);
  }
  if (!existing.active) {
    return existing;
  }
  await assertJobRefDeactivationAllowed("grade", id, db);

  let nextEnd = existing.endDateExclusive;
  if (endDateExclusive !== undefined && endDateExclusive !== null) {
    if (
      typeof endDateExclusive === "string" &&
      endDateExclusive.trim() === ""
    ) {
      throw new JobRefError(
        "INVALID_JOB_REF_INTERVAL",
        MSG_JOB_REF_DEACTIVATE_END_REQUIRED_FA,
        "deactivate_end_empty",
      );
    }
    const closed = assertValidJobRefInterval(
      existing.startDate,
      endDateExclusive,
    );
    nextEnd = closed.endDateExclusive;
  } else if (existing.endDateExclusive === null) {
    throw new JobRefError(
      "INVALID_JOB_REF_INTERVAL",
      MSG_JOB_REF_DEACTIVATE_END_REQUIRED_FA,
      "deactivate_end_required",
    );
  }

  const row = await db.grade.update({
    where: { id },
    data: {
      active: false,
      endDateExclusive: nextEnd ? dateOnlyToDb(nextEnd) : null,
    },
  });
  return mapGrade(row);
}

export async function updateGradeIdentity(
  id: string,
  input: UpdateGradeIdentityInput,
  db: PrismaClient = getPersonDb(),
): Promise<GradeRecord> {
  const existing = await getGradeById(id, db);
  if (!existing) {
    throw new JobRefError("JOB_REF_NOT_FOUND", MSG_JOB_REF_NOT_FOUND_FA);
  }

  const data: {
    code?: string;
    nameFa?: string;
    rank?: Prisma.Decimal;
    ladderId?: string;
  } = {};

  if (input.code !== undefined) {
    data.code = requireJobRefCode(input.code);
  }
  if (input.nameFa !== undefined) {
    data.nameFa = requireJobRefName(input.nameFa);
  }
  if (input.rank !== undefined) {
    data.rank = assertValidHalfGradeRank(input.rank);
  }

  if (input.ladderId !== undefined && input.ladderId !== existing.ladderId) {
    const nextLadderId = input.ladderId.trim();
    if (!nextLadderId) {
      throw new JobRefError(
        "VALIDATION",
        MSG_JOB_REF_LADDER_REQUIRED_FA,
        "ladder_required",
      );
    }
    const ladder = await db.ladder.findUnique({
      where: { id: nextLadderId },
    });
    if (!ladder) {
      throw new JobRefError(
        "JOB_REF_NOT_FOUND",
        MSG_JOB_REF_NOT_FOUND_FA,
        "ladder_not_found",
      );
    }
    if (!ladder.active) {
      throw new JobRefError(
        "BLOCKED_JOB_REF_OPERATION",
        MSG_INACTIVE_LADDER_FA,
        "ladder_inactive",
      );
    }
    data.ladderId = nextLadderId;
  }

  if (Object.keys(data).length === 0) {
    return existing;
  }

  await assertJobRefChangeAllowed("grade", id, db);

  try {
    const row = await db.grade.update({ where: { id }, data });
    return mapGrade(row);
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      mapGradeUniqueViolation(err);
    }
    if (isPrismaFkViolation(err)) {
      throw new JobRefError(
        "JOB_REF_NOT_FOUND",
        MSG_JOB_REF_NOT_FOUND_FA,
        "fk_ladder",
      );
    }
    throw err;
  }
}

export async function getGradeById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<GradeRecord | null> {
  const row = await db.grade.findUnique({ where: { id } });
  return row ? mapGrade(row) : null;
}

/**
 * Grades for a ladder only (incl. half-grades). Empty if ladder missing/inactive
 * when `requireActiveLadder` (default true for picker use).
 */
export async function listGradesForLadder(
  ladderId: string,
  options: {
    asOf?: string;
    includeInactive?: boolean;
    /** When true (default), missing/inactive ladder → []. */
    requireActiveLadder?: boolean;
  } = {},
  db: PrismaClient = getPersonDb(),
): Promise<GradeRecord[]> {
  const requireActive = options.requireActiveLadder !== false;
  const ladder = await db.ladder.findUnique({ where: { id: ladderId } });
  if (!ladder) {
    return [];
  }
  if (requireActive && !ladder.active) {
    return [];
  }

  const rows = await db.grade.findMany({
    where: {
      ladderId,
      ...(options.includeInactive ? {} : { active: true }),
    },
    orderBy: { rank: "asc" },
  });

  let grades = rows.map(mapGrade);
  if (options.asOf) {
    grades = grades.filter((g) => isJobRefActiveAsOf(g, options.asOf!));
  }
  // Prove membership invariant for callers
  for (const g of grades) {
    assertGradeBelongsToLadder(g, ladderId);
  }
  return grades;
}

// ── Seniority ───────────────────────────────────────────────────────

export async function createSeniority(
  input: CreateJobRefInput,
  db: PrismaClient = getPersonDb(),
): Promise<SeniorityRecord> {
  return createSimpleRef(
    "seniority",
    db.seniority as unknown as SimpleDelegate,
    input,
  );
}

export async function activateSeniority(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<SeniorityRecord> {
  return activateSimpleRef(
    "seniority",
    db.seniority as unknown as SimpleDelegate,
    id,
  );
}

export async function deactivateSeniority(
  id: string,
  endDateExclusive?: string | null,
  db: PrismaClient = getPersonDb(),
): Promise<SeniorityRecord> {
  return deactivateSimpleRef(
    "seniority",
    db.seniority as unknown as SimpleDelegate,
    id,
    endDateExclusive,
    db,
  );
}

export async function updateSeniorityIdentity(
  id: string,
  input: UpdateJobRefIdentityInput,
  db: PrismaClient = getPersonDb(),
): Promise<SeniorityRecord> {
  return updateSimpleIdentity(
    "seniority",
    db.seniority as unknown as SimpleDelegate,
    id,
    input,
    db,
  );
}

export async function getSeniorityById(
  id: string,
  db: PrismaClient = getPersonDb(),
): Promise<SeniorityRecord | null> {
  const row = await db.seniority.findUnique({ where: { id } });
  return row ? mapBase(row) : null;
}

export async function listSeniorities(
  options: { includeInactive?: boolean } = {},
  db: PrismaClient = getPersonDb(),
): Promise<SeniorityRecord[]> {
  return listSimple(db.seniority as unknown as SimpleDelegate, options);
}

export {
  assertValidJobRefInterval,
  assertGradeBelongsToLadder,
  assertValidHalfGradeRank,
  isJobRefActiveAsOf,
} from "./job-reference-invariants";

export type { JobRefInterval, JobRefConcept } from "./job-reference-invariants";

/** Explicit non-API — do not implement Grade↔Seniority mapping. */
export const JOB_REF_NO_GRADE_SENIORITY_MAPPING = true as const;
