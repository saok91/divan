/**
 * Start / Return personnel event helpers (Story 4.5 / FR-20).
 * Product path = Draft → Finalize → projection hook — no public startEmployment verbs.
 */

import type { PoolClient, PrismaClient } from "@divan/db";
import { getBusinessEventById } from "@divan/event-store";
import {
  consumeHeadcountCapacity,
  type CapacityCheckResult,
} from "@divan/headcount";

import { getPersonDb } from "./db";
import {
  applyEmploymentProjection,
  listEmploymentsForPerson,
} from "./employment";
import {
  EmploymentError,
  PersonnelEventError,
  PrimaryAssignmentError,
} from "./errors";
import {
  getGradeById,
  getJobTitleById,
  getLadderById,
  getOrganizationalRoleById,
  getSeniorityById,
  isJobRefActiveAsOf,
} from "./job-reference";
import { getOrgUnitAsOf, getOrgUnitById } from "./org-unit";
import {
  applyPrimaryAssignmentProjection,
  listPrimaryAssignmentsForEmployment,
} from "./primary-assignment";
import type { PersonnelEventDraftRecord } from "./personnel-event-draft";
import type { ProjectionRefreshContext } from "./personnel-event-projection-hook";

/** Product Start / Return event types (PascalCase past-tense). */
export const START_RETURN_EVENT_TYPES = new Set([
  "EmploymentStarted",
  "EmploymentReturned",
]);

export const PRODUCT_START_EVENT_TYPE = "EmploymentStarted";
export const PRODUCT_RETURN_EVENT_TYPE = "EmploymentReturned";
/** Substrate scaffold — must not create Employment. */
export const SCAFFOLD_EVENT_TYPE = "ScaffoldChangeRecorded";

export type StartReturnPayloadFacts = {
  collaborationType: string;
  teamId: string;
  organizationalRoleId: string;
  jobTitleId: string;
  ladderId: string;
  gradeId: string;
  seniorityId: string | null;
  capacitySlotId: string | null;
  headcountApprovalId: string | null;
  /** When true, skip consume — covered by exemption. */
  headcountExempt?: boolean;
};

export type MissingFact = {
  code: string;
  messageFa: string;
};

function strField(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const v = payload[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/**
 * Parse Start/Return minimum facts from draft payload.
 * Missing required → list of blocking findings (caller maps to ConflictFinding).
 */
export function parseStartReturnPayload(
  payload: Record<string, unknown>,
): { facts: StartReturnPayloadFacts | null; missing: MissingFact[] } {
  const missing: MissingFact[] = [];

  const collaborationType = strField(payload, "collaborationType");
  if (!collaborationType) {
    missing.push({
      code: "MISSING_COLLABORATION_TYPE",
      messageFa: "نوع همکاری در پیش‌نویس الزامی است.",
    });
  }

  const teamId = strField(payload, "teamId");
  if (!teamId) {
    missing.push({
      code: "MISSING_TEAM",
      messageFa: "تیم (سازمان اولیه) در پیش‌نویس الزامی است.",
    });
  }

  const organizationalRoleId = strField(payload, "organizationalRoleId");
  if (!organizationalRoleId) {
    missing.push({
      code: "MISSING_ORGANIZATIONAL_ROLE",
      messageFa: "نقش سازمانی در پیش‌نویس الزامی است.",
    });
  }

  const jobTitleId = strField(payload, "jobTitleId");
  if (!jobTitleId) {
    missing.push({
      code: "MISSING_JOB_TITLE",
      messageFa: "عنوان شغلی در پیش‌نویس الزامی است.",
    });
  }

  const ladderId = strField(payload, "ladderId");
  if (!ladderId) {
    missing.push({
      code: "MISSING_LADDER",
      messageFa: "لدر در پیش‌نویس الزامی است.",
    });
  }

  const gradeId = strField(payload, "gradeId");
  if (!gradeId) {
    missing.push({
      code: "MISSING_GRADE",
      messageFa: "گرید در پیش‌نویس الزامی است.",
    });
  }

  if (missing.length > 0) {
    return { facts: null, missing };
  }

  return {
    facts: {
      collaborationType: collaborationType!,
      teamId: teamId!,
      organizationalRoleId: organizationalRoleId!,
      jobTitleId: jobTitleId!,
      ladderId: ladderId!,
      gradeId: gradeId!,
      seniorityId: strField(payload, "seniorityId"),
      capacitySlotId: strField(payload, "capacitySlotId"),
      headcountApprovalId: strField(payload, "headcountApprovalId"),
      headcountExempt: payload.headcountExempt === true,
    },
    missing: [],
  };
}

export type StartReturnSource = {
  personId: string;
  effectiveDate: string;
  payload: Record<string, unknown>;
  employmentId: string | null;
};

/**
 * Resolve person/date/payload from draft or authoritative event (recalc replay).
 */
export async function resolveStartReturnSource(
  ctx: ProjectionRefreshContext,
): Promise<StartReturnSource | null> {
  if (ctx.draft) {
    return {
      personId: ctx.draft.personId,
      effectiveDate: ctx.draft.effectiveDate,
      payload: ctx.draft.payload,
      employmentId: ctx.draft.employmentId,
    };
  }
  const event = await getBusinessEventById(ctx.client, ctx.eventId);
  if (!event) return null;
  return {
    personId: event.personId,
    effectiveDate: event.effectiveDate,
    payload: event.payload,
    employmentId: event.employmentId,
  };
}

/**
 * Apply Employment + Primary for Effective Start/Return.
 * Idempotent via PrimaryAssignment.sourceEventId === eventId.
 * Returns created/existing employmentId for draft binding.
 */
/**
 * Undo Prisma Employment/Primary created outside the finalize PoolClient txn
 * when a later step (consume / post-hook) fails — prevents orphan projections.
 */
export async function compensateOrphanStartReturnProjections(
  opts: {
    employmentId: string;
    primaryId?: string | null;
  },
  db: PrismaClient = getPersonDb(),
): Promise<void> {
  try {
    if (opts.primaryId) {
      await db.primaryAssignment.deleteMany({ where: { id: opts.primaryId } });
    } else {
      await db.primaryAssignment.deleteMany({
        where: { employmentId: opts.employmentId },
      });
    }
    await db.employment.deleteMany({ where: { id: opts.employmentId } });
  } catch {
    // Best-effort; original error is rethrown by caller
  }
}

export async function applyStartReturnProjections(
  ctx: ProjectionRefreshContext,
  db: PrismaClient = getPersonDb(),
): Promise<{ employmentId: string; primaryId: string; created: boolean }> {
  if (!START_RETURN_EVENT_TYPES.has(ctx.eventType)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "نوع رویداد Start/Return نیست.",
      "not_start_return",
    );
  }

  // Idempotent: already applied for this event
  const existingPrimary = await db.primaryAssignment.findFirst({
    where: { sourceEventId: ctx.eventId },
  });
  if (existingPrimary) {
    return {
      employmentId: existingPrimary.employmentId,
      primaryId: existingPrimary.id,
      created: false,
    };
  }

  const source = await resolveStartReturnSource(ctx);
  if (!source) {
    throw new PersonnelEventError(
      "VALIDATION",
      "منبع رویداد Start/Return یافت نشد.",
      "missing_source",
    );
  }

  const { facts, missing } = parseStartReturnPayload(source.payload);
  if (!facts || missing.length > 0) {
    throw new PersonnelEventError(
      "VALIDATION",
      missing[0]?.messageFa ?? "حداقل واقعیت‌های الزامی ناقص است.",
      "missing_facts",
    );
  }

  let createdEmploymentId: string | null = null;
  let createdPrimaryId: string | null = null;
  try {
    const employment = await applyEmploymentProjection(
      {
        personId: source.personId,
        startDate: source.effectiveDate,
        endDateExclusive: null,
        collaborationType: facts.collaborationType,
      },
      db,
    );
    createdEmploymentId = employment.id;

    const primary = await applyPrimaryAssignmentProjection(
      {
        employmentId: employment.id,
        teamId: facts.teamId,
        organizationalRoleId: facts.organizationalRoleId,
        jobTitleId: facts.jobTitleId,
        ladderId: facts.ladderId,
        gradeId: facts.gradeId,
        seniorityId: facts.seniorityId,
        startDate: source.effectiveDate,
        endDateExclusive: null,
        sourceEventId: ctx.eventId,
        headcountApprovalId: facts.headcountExempt
          ? null
          : facts.headcountApprovalId,
      },
      db,
    );
    createdPrimaryId = primary.id;

    // Coverage assert after both writes: exactly one open Primary on this Employment
    const primaries = await listPrimaryAssignmentsForEmployment(
      employment.id,
      db,
    );
    const openPrimaries = primaries.filter((p) => p.endDateExclusive === null);
    if (openPrimaries.length !== 1) {
      throw new PrimaryAssignmentError(
        "VALIDATION",
        "پس از اعمال Start/Return باید دقیقاً یک انتصاب اولیه باز وجود داشته باشد.",
      );
    }

    // Consume capacity when slot was resolved into payload during classify
    // (skip when exempt — FR-29)
    const slotId = facts.capacitySlotId;
    if (slotId && !facts.headcountExempt) {
      await consumeHeadcountCapacity(ctx.client, {
        slotId,
        eventId: ctx.eventId,
        personId: source.personId,
        evaluationDate: source.effectiveDate,
      });
    }

    return {
      employmentId: employment.id,
      primaryId: primary.id,
      created: true,
    };
  } catch (err) {
    if (createdEmploymentId) {
      await compensateOrphanStartReturnProjections(
        {
          employmentId: createdEmploymentId,
          primaryId: createdPrimaryId,
        },
        db,
      );
    }
    mapProjectorError(err);
  }
}

function mapProjectorError(err: unknown): never {
  if (err instanceof PersonnelEventError) throw err;
  if (err instanceof EmploymentError) {
    throw new PersonnelEventError("VALIDATION", err.messageFa, err.code);
  }
  if (err instanceof PrimaryAssignmentError) {
    throw new PersonnelEventError("VALIDATION", err.messageFa, err.code);
  }
  if (err instanceof Error && err.message.includes("مصرف ظرفیت")) {
    throw new PersonnelEventError("VALIDATION", err.message, "headcount_consume");
  }
  throw err;
}

/**
 * Bind created employmentId onto Draft after Effective apply.
 * Event store remains append-only — do not UPDATE kernel_events (aborts txn).
 */
export async function bindEmploymentIdAfterApply(
  client: PoolClient,
  opts: {
    draftId?: string | null;
    eventId: string;
    employmentId: string;
  },
): Promise<void> {
  void opts.eventId;
  if (!opts.draftId) return;
  await client.query(
    `UPDATE "PersonnelEventDraft"
     SET "employmentId" = $2,
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [opts.draftId, opts.employmentId],
  );
}

/**
 * Check Team / job refs active as-of Effective Date (AR-TEMPORAL).
 * Returns blocking findings; never silent-attach inactive refs.
 */
function isInvalidRefIdError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code =
    "code" in err && err.code != null ? String(err.code) : "";
  // Prisma P2023 = inconsistent column data (often invalid UUID)
  if (code === "P2023" || code === "22P02") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /uuid|invalid.*id/i.test(msg);
}

export async function findInactiveRefConflicts(
  facts: StartReturnPayloadFacts,
  effectiveDate: string,
  db: PrismaClient = getPersonDb(),
): Promise<Array<{ code: string; messageFa: string }>> {
  const findings: Array<{ code: string; messageFa: string }> = [];

  try {
    const teamAsOf = await getOrgUnitAsOf(facts.teamId, effectiveDate, db);
    if (!teamAsOf) {
      const team = await getOrgUnitById(facts.teamId, db);
      findings.push({
        code: "INACTIVE_TEAM_REF",
        messageFa: team
          ? "تیم انتخاب‌شده در تاریخ مؤثر غیرفعال است؛ اتصال خاموش مجاز نیست."
          : "تیم انتخاب‌شده یافت نشد.",
      });
    } else if (teamAsOf.unitType !== "TEAM") {
      findings.push({
        code: "INVALID_TEAM_REF",
        messageFa: "مرجع سازمان باید از نوع تیم باشد.",
      });
    }
  } catch (err) {
    if (isInvalidRefIdError(err)) {
      findings.push({
        code: "INACTIVE_TEAM_REF",
        messageFa: "تیم انتخاب‌شده یافت نشد.",
      });
    } else {
      throw err;
    }
  }

  try {
    const role = await getOrganizationalRoleById(
      facts.organizationalRoleId,
      db,
    );
    if (!role || !isJobRefActiveAsOf(role, effectiveDate)) {
      findings.push({
        code: "INACTIVE_ORG_ROLE_REF",
        messageFa: "نقش سازمانی در تاریخ مؤثر غیرفعال یا ناموجود است.",
      });
    }
  } catch (err) {
    if (isInvalidRefIdError(err)) {
      findings.push({
        code: "INACTIVE_ORG_ROLE_REF",
        messageFa: "نقش سازمانی در تاریخ مؤثر غیرفعال یا ناموجود است.",
      });
    } else {
      throw err;
    }
  }

  try {
    const title = await getJobTitleById(facts.jobTitleId, db);
    if (!title || !isJobRefActiveAsOf(title, effectiveDate)) {
      findings.push({
        code: "INACTIVE_JOB_TITLE_REF",
        messageFa: "عنوان شغلی در تاریخ مؤثر غیرفعال یا ناموجود است.",
      });
    }
  } catch (err) {
    if (isInvalidRefIdError(err)) {
      findings.push({
        code: "INACTIVE_JOB_TITLE_REF",
        messageFa: "عنوان شغلی در تاریخ مؤثر غیرفعال یا ناموجود است.",
      });
    } else {
      throw err;
    }
  }

  try {
    const ladder = await getLadderById(facts.ladderId, db);
    if (!ladder || !isJobRefActiveAsOf(ladder, effectiveDate)) {
      findings.push({
        code: "INACTIVE_LADDER_REF",
        messageFa: "لدر در تاریخ مؤثر غیرفعال یا ناموجود است.",
      });
    }
  } catch (err) {
    if (isInvalidRefIdError(err)) {
      findings.push({
        code: "INACTIVE_LADDER_REF",
        messageFa: "لدر در تاریخ مؤثر غیرفعال یا ناموجود است.",
      });
    } else {
      throw err;
    }
  }

  try {
    const grade = await getGradeById(facts.gradeId, db);
    if (!grade || !isJobRefActiveAsOf(grade, effectiveDate)) {
      findings.push({
        code: "INACTIVE_GRADE_REF",
        messageFa: "گرید در تاریخ مؤثر غیرفعال یا ناموجود است.",
      });
    }
  } catch (err) {
    if (isInvalidRefIdError(err)) {
      findings.push({
        code: "INACTIVE_GRADE_REF",
        messageFa: "گرید در تاریخ مؤثر غیرفعال یا ناموجود است.",
      });
    } else {
      throw err;
    }
  }

  if (facts.seniorityId) {
    try {
      const seniority = await getSeniorityById(facts.seniorityId, db);
      if (!seniority || !isJobRefActiveAsOf(seniority, effectiveDate)) {
        findings.push({
          code: "INACTIVE_SENIORITY_REF",
          messageFa: "ارشدیت در تاریخ مؤثر غیرفعال یا ناموجود است.",
        });
      }
    } catch (err) {
      if (isInvalidRefIdError(err)) {
        findings.push({
          code: "INACTIVE_SENIORITY_REF",
          messageFa: "ارشدیت در تاریخ مؤثر غیرفعال یا ناموجود است.",
        });
      } else {
        throw err;
      }
    }
  }

  return findings;
}

export function capacityResultToConflict(
  result: CapacityCheckResult,
): {
  code: string;
  severity: "blocking" | "warning";
  messageFa: string;
  requiresOverride?: boolean;
  requiresAck?: boolean;
  slotId?: string;
} | null {
  if (result.outcome === "compatible" || result.outcome === "exempt") {
    return null;
  }
  if (result.outcome === "unavailable") {
    return {
      code: "HEADCOUNT_PORT_UNAVAILABLE",
      severity: "blocking",
      messageFa: result.messageFa,
    };
  }
  // incompatible — universal coverage (FR-29); Override catalogue stays 4.14
  return {
    code: "HEADCOUNT_UNAPPROVED",
    severity: "blocking",
    messageFa: result.messageFa,
  };
}

/** Count employments for a person (Return history proof). */
export async function countEmploymentsForPerson(
  personId: string,
  db: PrismaClient = getPersonDb(),
): Promise<number> {
  const rows = await listEmploymentsForPerson(personId, db);
  return rows.length;
}

export type { PersonnelEventDraftRecord };
