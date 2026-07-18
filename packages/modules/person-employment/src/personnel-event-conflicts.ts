/**
 * Evaluation snapshot + conflict classification (Story 4.2 / FR-19 / FR-56).
 * Fail-closed stubs for AR-TEMPORAL / AR-HEADCOUNT — do not invent frozen matrices.
 */

import { todayDateOnlyTehran, parseDateOnly } from "@divan/temporal-engine";
import { createPgPool, type Pool, type PoolClient, type PrismaClient } from "@divan/db";
import { getBusinessEventById } from "@divan/event-store";
import { evaluateHeadcountCapacity } from "@divan/headcount";

import { getPersonDb } from "./db";
import {
  MSG_ANONYMIZED_RETURN_BLOCKED_FA,
  MSG_BASELINE_BOUNDARY_BLOCKED_FA,
  MSG_BROKEN_CORRECTION_REF_FA,
  MSG_CORRECTION_CYCLE_FA,
  MSG_CORRECTION_SELF_REF_FA,
  MSG_HEADCOUNT_CHECK_BLOCKED_FA,
  MSG_HEADCOUNT_PORT_UNAVAILABLE_FA,
  MSG_INVALID_DRAFT_EFFECTIVE_DATE_FA,
  MSG_IRRECONCILABLE_ORDERING_FA,
  MSG_MISSING_PERSONNEL_CODE_FA,
  MSG_PERSON_NOT_FOUND_FA,
  PersonnelEventError,
} from "./errors";
import type { PersonnelEventDraftRecord } from "./personnel-event-draft";
import { detectCorrectionCycle } from "./personnel-event-resolve";
import { getEmploymentById, isEmploymentActiveAsOf } from "./employment";
import { getGradeById } from "./job-reference";
import { JobRefError } from "./errors";
import { listPrimaryAssignmentsForEmployment } from "./primary-assignment";
import { listSecondaryAssignmentsForEmployment } from "./secondary-assignment";
import {
  START_RETURN_EVENT_TYPES,
  capacityResultToConflict,
  countEmploymentsForPerson,
  findInactiveRefConflicts,
  parseStartReturnPayload,
} from "./personnel-event-start-return";
import {
  TERMINATION_EVENT_TYPES,
  findIncompatibleFutureEvents,
  incompatibleFutureToConflict,
  parseTerminationPayload,
  priorDateOnly,
} from "./personnel-event-termination";

/** Lazy read pool for conflict existence checks outside a finalize txn. */
let conflictReadPool: Pool | null = null;

function getConflictReadPool(): Pool | null {
  if (conflictReadPool) return conflictReadPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  conflictReadPool = createPgPool(url);
  return conflictReadPool;
}

/**
 * PG `@db.Date` → YYYY-MM-DD.
 * Drivers may surface UTC midnight or local midnight; never use toISOString().slice.
 */
export function dateOnlyFromDb(d: Date): string {
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

export type ConflictSeverity = "blocking" | "warning";

export type ConflictFinding = {
  code: string;
  severity: ConflictSeverity;
  messageFa: string;
  /** When true, warning may proceed only with recorded acknowledgement. */
  requiresAck?: boolean;
  /** When true, only Override path (HR Admin / configured) may proceed. */
  requiresOverride?: boolean;
};

export type EvaluationSnapshot = {
  /** Asia/Tehran date-only as-of for checks (FR-56). */
  asOfDate: string;
  actorAccountId: string;
  /** PermissionSet fingerprint or joined permission keys for attribution. */
  permissionSetFingerprint: string;
  correlationId: string;
  /** Frozen Person stamp. */
  person: { id: string; updatedAt: string };
  /** Frozen Employment stamp when bound. */
  employment: {
    id: string;
    updatedAt: string;
    startDate: string;
    endDateExclusive: string | null;
  } | null;
  /** Optional org/job refs from draft payload (structural ids only). */
  refs: {
    ladderId?: string;
    gradeId?: string;
    teamId?: string;
    organizationalRoleId?: string;
    jobTitleId?: string;
  };
  builtAt: string;
};

export type BuildSnapshotInput = {
  draft: PersonnelEventDraftRecord;
  actorAccountId: string;
  correlationId: string;
  permissionSetFingerprint?: string;
  asOfDate?: string;
};

/**
 * Event types that consume headcount.
 * Start/Return use the narrow capacity port (4.5); Transfer stubs remain fail-closed.
 */
export const HEADCOUNT_CONSUMING_EVENT_TYPES = new Set([
  "EmploymentStarted",
  "EmploymentReturned",
  "TransferRecorded",
  "TeamTransferRecorded",
  "HeadcountConsumed",
]);

/** Start/Return — capacity evaluated via @divan/headcount port (not unconditional stub). */
export const HEADCOUNT_CAPACITY_PORT_EVENT_TYPES = START_RETURN_EVENT_TYPES;

/**
 * Warning allow-list — only these codes may proceed with acknowledgement.
 * Everything else that is a warning without policy stays blocking.
 */
export const WARNING_ACK_ALLOW_LIST = new Set([
  "PRE_BASELINE_EFFECTIVE_DATE",
  "HEADCOUNT_CAPACITY_MISSING",
]);

export type ConflictPolicy = {
  /** When set, Effective Date before this boundary needs Override (+ ack). */
  baselineBoundaryDate?: string | null;
  /** When true, PRE_BASELINE can be Override'd by HR Admin path. */
  allowPreBaselineOverride?: boolean;
  /** Codes that may proceed with warning acknowledgement. */
  warningAckAllowList?: Set<string>;
};

export type SnapshotReadOptions = {
  /**
   * When set (finalize txn), Person/Employment stamps are read on this connection
   * so they share the same transactional view as Draft `FOR UPDATE` + append.
   */
  client?: PoolClient;
};

export async function buildEvaluationSnapshot(
  input: BuildSnapshotInput,
  db: PrismaClient = getPersonDb(),
  opts: SnapshotReadOptions = {},
): Promise<EvaluationSnapshot> {
  const asOf =
    input.asOfDate != null
      ? (() => {
          const p = parseDateOnly(input.asOfDate);
          if (!p.ok) {
            throw new PersonnelEventError(
              "VALIDATION",
              MSG_INVALID_DRAFT_EFFECTIVE_DATE_FA,
              `invalid_as_of:${p.reason}`,
            );
          }
          return p.value;
        })()
      : todayDateOnlyTehran();

  let personId: string;
  let personUpdatedAt: string;
  let employment: EvaluationSnapshot["employment"] = null;

  if (opts.client) {
    const personRes = await opts.client.query<{
      id: string;
      updatedAt: Date;
    }>(`SELECT id, "updatedAt" FROM "Person" WHERE id = $1`, [
      input.draft.personId,
    ]);
    const person = personRes.rows[0];
    if (!person) {
      throw new PersonnelEventError("PERSON_NOT_FOUND", MSG_PERSON_NOT_FOUND_FA);
    }
    personId = person.id;
    personUpdatedAt = person.updatedAt.toISOString();

    if (input.draft.employmentId) {
      const empRes = await opts.client.query<{
        id: string;
        personId: string;
        updatedAt: Date;
        startDate: Date;
        endDateExclusive: Date | null;
      }>(
        `SELECT id, "personId", "updatedAt", "startDate", "endDateExclusive"
         FROM "Employment" WHERE id = $1`,
        [input.draft.employmentId],
      );
      const emp = empRes.rows[0];
      if (emp && emp.personId === input.draft.personId) {
        employment = {
          id: emp.id,
          updatedAt: emp.updatedAt.toISOString(),
          startDate: dateOnlyFromDb(emp.startDate),
          endDateExclusive: emp.endDateExclusive
            ? dateOnlyFromDb(emp.endDateExclusive)
            : null,
        };
      }
    }
  } else {
    const person = await db.person.findUnique({
      where: { id: input.draft.personId },
    });
    if (!person) {
      throw new PersonnelEventError("PERSON_NOT_FOUND", MSG_PERSON_NOT_FOUND_FA);
    }
    personId = person.id;
    personUpdatedAt = person.updatedAt.toISOString();

    if (input.draft.employmentId) {
      const emp = await db.employment.findUnique({
        where: { id: input.draft.employmentId },
      });
      if (emp && emp.personId === input.draft.personId) {
        employment = {
          id: emp.id,
          updatedAt: emp.updatedAt.toISOString(),
          startDate: dateOnlyFromDb(emp.startDate),
          endDateExclusive: emp.endDateExclusive
            ? dateOnlyFromDb(emp.endDateExclusive)
            : null,
        };
      }
    }
  }

  const payload = input.draft.payload;
  const refs: EvaluationSnapshot["refs"] = {};
  for (const key of [
    "ladderId",
    "gradeId",
    "teamId",
    "organizationalRoleId",
    "jobTitleId",
  ] as const) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) {
      refs[key] = v.trim();
    }
  }

  return {
    asOfDate: asOf,
    actorAccountId: input.actorAccountId,
    permissionSetFingerprint:
      input.permissionSetFingerprint?.trim() || "unspecified",
    correlationId: input.correlationId,
    person: {
      id: personId,
      updatedAt: personUpdatedAt,
    },
    employment,
    refs,
    builtAt: new Date().toISOString(),
  };
}

/**
 * Re-validate client-supplied snapshot against live stamps.
 * Stale refs → block (FR-56).
 */
export function assertSnapshotFresh(
  snapshot: EvaluationSnapshot,
  live: EvaluationSnapshot,
): ConflictFinding | null {
  if (snapshot.person.id !== live.person.id) {
    return {
      code: "STALE_PERSON_REF",
      severity: "blocking",
      messageFa:
        "مرجع فرد در اسنپ‌شات ارزیابی با وضعیت فعلی هم‌خوان نیست؛ نهایی‌سازی مسدود است.",
    };
  }
  if (snapshot.asOfDate !== live.asOfDate) {
    return {
      code: "STALE_AS_OF",
      severity: "blocking",
      messageFa:
        "تاریخ ارزیابی اسنپ‌شات با روز جاری هم‌خوان نیست؛ دوباره بررسی کنید.",
    };
  }
  if (
    snapshot.permissionSetFingerprint !== live.permissionSetFingerprint
  ) {
    return {
      code: "STALE_PERMISSION_FINGERPRINT",
      severity: "blocking",
      messageFa:
        "مجوزهای ارزیابی پس از ساخت اسنپ‌شات تغییر کرده است؛ نهایی‌سازی مسدود است.",
    };
  }
  if (snapshot.person.updatedAt !== live.person.updatedAt) {
    return {
      code: "STALE_PERSON_REF",
      severity: "blocking",
      messageFa:
        "فرد پس از ساخت اسنپ‌شات تغییر کرده است؛ دوباره بررسی کنید.",
    };
  }
  if (
    (snapshot.employment?.id ?? null) !== (live.employment?.id ?? null) ||
    (snapshot.employment?.updatedAt ?? null) !==
      (live.employment?.updatedAt ?? null)
  ) {
    return {
      code: "STALE_EMPLOYMENT_REF",
      severity: "blocking",
      messageFa:
        "سابقه همکاری پس از ساخت اسنپ‌شات تغییر کرده است؛ نهایی‌سازی مسدود است.",
    };
  }
  return null;
}

export async function classifyConflicts(
  draft: PersonnelEventDraftRecord,
  snapshot: EvaluationSnapshot,
  policy: ConflictPolicy = {},
  db: PrismaClient = getPersonDb(),
  opts: SnapshotReadOptions = {},
): Promise<ConflictFinding[]> {
  const findings: ConflictFinding[] = [];
  const warningAllow =
    policy.warningAckAllowList ?? WARNING_ACK_ALLOW_LIST;

  const dateParsed = parseDateOnly(draft.effectiveDate);
  if (!dateParsed.ok) {
    findings.push({
      code: "INVALID_EFFECTIVE_DATE",
      severity: "blocking",
      messageFa: MSG_INVALID_DRAFT_EFFECTIVE_DATE_FA,
    });
    return findings;
  }

  // Broken correction / chain refs — existence + cycle/self-ref (Story 4.3)
  for (const key of [
    "correctsEventId",
    "cancelsEventId",
    "reversesEventId",
  ] as const) {
    const ref = draft.payload[key];
    if (typeof ref === "string" && ref.trim()) {
      const targetId = ref.trim();
      const uuidOk =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          targetId,
        );
      if (!uuidOk) {
        findings.push({
          code: "BROKEN_CORRECTION_REF",
          severity: "blocking",
          messageFa: MSG_BROKEN_CORRECTION_REF_FA,
        });
        continue;
      }

      const reader = opts.client ?? getConflictReadPool();
      if (!reader) {
        // Fail-closed: cannot prove target exists without a DB reader.
        findings.push({
          code: "BROKEN_CORRECTION_REF",
          severity: "blocking",
          messageFa: MSG_BROKEN_CORRECTION_REF_FA,
        });
        continue;
      }

      const target = await getBusinessEventById(reader, targetId);
      if (!target) {
        findings.push({
          code: "BROKEN_CORRECTION_REF",
          severity: "blocking",
          messageFa: MSG_BROKEN_CORRECTION_REF_FA,
        });
        continue;
      }

      if (key === "correctsEventId") {
        // Self-ref: draft cannot correct itself via payload id equal to a
        // known finalizedEventId, or target correcting back to draft id.
        if (
          draft.finalizedEventId &&
          targetId === draft.finalizedEventId
        ) {
          findings.push({
            code: "CORRECTION_SELF_REF",
            severity: "blocking",
            messageFa: MSG_CORRECTION_SELF_REF_FA,
          });
          continue;
        }
        const fromId = draft.finalizedEventId ?? draft.id;
        if (fromId === targetId) {
          findings.push({
            code: "CORRECTION_SELF_REF",
            severity: "blocking",
            messageFa: MSG_CORRECTION_SELF_REF_FA,
          });
          continue;
        }
        const cycle = await detectCorrectionCycle(reader, fromId, targetId);
        if (cycle === "self_ref") {
          findings.push({
            code: "CORRECTION_SELF_REF",
            severity: "blocking",
            messageFa: MSG_CORRECTION_SELF_REF_FA,
          });
        } else if (cycle === "cycle") {
          findings.push({
            code: "CORRECTION_CYCLE",
            severity: "blocking",
            messageFa: MSG_CORRECTION_CYCLE_FA,
          });
        } else if (cycle === "missing_target") {
          findings.push({
            code: "BROKEN_CORRECTION_REF",
            severity: "blocking",
            messageFa: MSG_BROKEN_CORRECTION_REF_FA,
          });
        }
      }
    }
  }

  // Inactive Employment mutation — check against Effective Date (not evaluation as-of alone)
  // Termination is allowed on open Employment (still active as-of ED while endExclusive unset);
  // already-closed / missing employment is handled in the Termination block below.
  if (
    draft.employmentId &&
    snapshot.employment &&
    !TERMINATION_EVENT_TYPES.has(draft.eventType)
  ) {
    const active = isEmploymentActiveAsOf(
      {
        startDate: snapshot.employment.startDate,
        endDateExclusive: snapshot.employment.endDateExclusive,
      },
      draft.effectiveDate,
    );
    if (!active) {
      findings.push({
        code: "INACTIVE_EMPLOYMENT_MUTATION",
        severity: "blocking",
        messageFa:
          "تغییر روی همکاری غیرفعال در تاریخ مؤثر مجاز نیست؛ نهایی‌سازی مسدود است.",
      });
    }
  } else if (
    draft.employmentId &&
    !snapshot.employment &&
    !TERMINATION_EVENT_TYPES.has(draft.eventType)
  ) {
    findings.push({
      code: "EMPLOYMENT_REF_MISSING",
      severity: "blocking",
      messageFa:
        "سابقه همکاری پیوست‌شده یافت نشد؛ نهایی‌سازی مسدود است.",
    });
  }

  // Overlapping Employments — as-of draft Effective Date (date-only, not timestamptz UTC)
  // Start and Return both create a new open Employment — prior must already be closed.
  if (START_RETURN_EVENT_TYPES.has(draft.eventType)) {
    let activeCount = 0;
    if (opts.client) {
      const active = await opts.client.query<{ id: string }>(
        `SELECT id FROM "Employment"
         WHERE "personId" = $1
           AND "startDate" <= $2::date
           AND ("endDateExclusive" IS NULL OR "endDateExclusive" > $2::date)`,
        [draft.personId, draft.effectiveDate],
      );
      activeCount = active.rows.length;
    } else {
      const active = await db.employment.findMany({
        where: {
          personId: draft.personId,
          startDate: { lte: new Date(`${draft.effectiveDate}T12:00:00.000Z`) },
          OR: [
            { endDateExclusive: null },
            {
              endDateExclusive: {
                gt: new Date(`${draft.effectiveDate}T12:00:00.000Z`),
              },
            },
          ],
        },
      });
      activeCount = active.length;
    }
    if (activeCount > 0) {
      findings.push({
        code: "OVERLAPPING_EMPLOYMENT",
        severity: "blocking",
        messageFa:
          "هم‌پوشانی همکاری فعال وجود دارد؛ شروع/بازگشت همکاری جدید بدون بستن قبلی مسدود است.",
      });
    }
  }

  // Start/Return — stable Person + Personnel Code + minimum facts + AR-TEMPORAL refs
  if (START_RETURN_EVENT_TYPES.has(draft.eventType)) {
    const personRow = await db.person.findUnique({
      where: { id: draft.personId },
      select: { personnelCode: true, givenName: true, familyName: true },
    });
    if (!personRow?.personnelCode?.trim()) {
      findings.push({
        code: "MISSING_PERSONNEL_CODE",
        severity: "blocking",
        messageFa: MSG_MISSING_PERSONNEL_CODE_FA,
      });
    }

    // Anonymized return — fail-closed; do not invent AR-DATA rehire-token acceptance
    if (draft.eventType === "EmploymentReturned") {
      const givenBlank =
        !personRow?.givenName?.trim() || personRow.givenName === "[REDACTED]";
      const familyBlank =
        !personRow?.familyName?.trim() || personRow.familyName === "[REDACTED]";
      const forceAnonymized = draft.payload.anonymizedPerson === true;
      // Partial redaction also requires rematch — either name blank/redacted
      if (forceAnonymized || givenBlank || familyBlank) {
        // Ignore client rehireToken until AR-DATA schema exists — never silent bypass
        const manualRematch =
          draft.payload.manualRematchVerified === true &&
          typeof draft.payload.manualRematchEvidence === "string" &&
          draft.payload.manualRematchEvidence.trim().length > 0;
        if (!manualRematch) {
          findings.push({
            code: "ANONYMIZED_RETURN_BLOCKED",
            severity: "blocking",
            messageFa: MSG_ANONYMIZED_RETURN_BLOCKED_FA,
          });
        }
      }

      const priorCount = await countEmploymentsForPerson(draft.personId, db);
      if (priorCount === 0) {
        findings.push({
          code: "RETURN_WITHOUT_PRIOR_EMPLOYMENT",
          severity: "blocking",
          messageFa:
            "بازگشت همکاری بدون سابقه همکاری قبلی مجاز نیست؛ از شروع همکاری استفاده کنید.",
        });
      }
    }

    const { facts, missing } = parseStartReturnPayload(draft.payload);
    for (const m of missing) {
      findings.push({
        code: m.code,
        severity: "blocking",
        messageFa: m.messageFa,
      });
    }

    if (facts) {
      const inactive = await findInactiveRefConflicts(
        facts,
        draft.effectiveDate,
        db,
      );
      for (const f of inactive) {
        findings.push({
          code: f.code,
          severity: "blocking",
          messageFa: f.messageFa,
        });
      }
    }

    // Exclusive-key / same-day Start collision — fail closed when detectable
    {
      const reader = opts.client ?? getConflictReadPool();
      if (!reader) {
        findings.push({
          code: "IRRECONCILABLE_ORDERING",
          severity: "blocking",
          messageFa: MSG_IRRECONCILABLE_ORDERING_FA,
        });
      } else {
        const peers = await reader.query<{ id: string }>(
          `SELECT id FROM kernel_events
           WHERE event_class = 'business'
             AND person_id = $1::uuid
             AND event_type = ANY($2::text[])
             AND status NOT IN ('Cancelled', 'Reversed')
             AND effective_date = $3::date
             AND ($4::uuid IS NULL OR id <> $4::uuid)`,
          [
            draft.personId,
            [...START_RETURN_EVENT_TYPES],
            draft.effectiveDate,
            draft.finalizedEventId ?? null,
          ],
        );
        if (peers.rows.length > 0) {
          findings.push({
            code: "IRRECONCILABLE_ORDERING",
            severity: "blocking",
            messageFa: MSG_IRRECONCILABLE_ORDERING_FA,
          });
        }
      }
    }
  }

  // Termination — open Employment + reason + incompatible future dispose (FR-21)
  if (TERMINATION_EVENT_TYPES.has(draft.eventType)) {
    const { facts, missing } = parseTerminationPayload(draft.payload);
    for (const m of missing) {
      findings.push({
        code: m.code,
        severity: "blocking",
        messageFa: m.messageFa,
      });
    }

    const targetEmpId =
      draft.employmentId?.trim() ||
      facts?.employmentId?.trim() ||
      null;

    if (!targetEmpId) {
      findings.push({
        code: "MISSING_EMPLOYMENT",
        severity: "blocking",
        messageFa:
          "شناسه همکاری باز برای خاتمه الزامی است؛ نهایی‌سازی مسدود است.",
      });
    } else {
      const emp = await getEmploymentById(targetEmpId, db);
      if (!emp) {
        findings.push({
          code: "EMPLOYMENT_REF_MISSING",
          severity: "blocking",
          messageFa:
            "سابقه همکاری پیوست‌شده یافت نشد؛ نهایی‌سازی مسدود است.",
        });
      } else if (emp.personId !== draft.personId) {
        findings.push({
          code: "EMPLOYMENT_PERSON_MISMATCH",
          severity: "blocking",
          messageFa:
            "همکاری هدف متعلق به این فرد نیست؛ نهایی‌سازی مسدود است.",
        });
      } else if (emp.endDateExclusive !== null) {
        findings.push({
          code: "EMPLOYMENT_ALREADY_CLOSED",
          severity: "blocking",
          messageFa:
            "همکاری هدف قبلاً بسته شده است؛ خاتمه مجدد مسدود است.",
        });
      } else {
        // Must cover prior day (half-open: active on last day before ED)
        const prior = priorDateOnly(draft.effectiveDate);
        const activePrior = isEmploymentActiveAsOf(emp, prior);
        if (!activePrior) {
          findings.push({
            code: "EMPLOYMENT_NOT_ACTIVE_BEFORE_TERMINATION",
            severity: "blocking",
            messageFa:
              "همکاری در روز قبل از تاریخ مؤثر خاتمه فعال نیست؛ نهایی‌سازی مسدود است.",
          });
        }
        // endExclusive = ED ⇒ end must be strictly after start
        if (draft.effectiveDate <= emp.startDate) {
          findings.push({
            code: "INVALID_TERMINATION_DATE",
            severity: "blocking",
            messageFa:
              "تاریخ مؤثر خاتمه باید بعد از تاریخ شروع همکاری باشد.",
          });
        }

        // Assignments that would start on/after Termination ED cannot close cleanly
        const [primaries, secondaries] = await Promise.all([
          listPrimaryAssignmentsForEmployment(targetEmpId, db),
          listSecondaryAssignmentsForEmployment(targetEmpId, db),
        ]);
        const badStart = [...primaries, ...secondaries].some(
          (a) =>
            (a.endDateExclusive === null ||
              a.endDateExclusive > draft.effectiveDate) &&
            a.startDate >= draft.effectiveDate,
        );
        if (badStart) {
          findings.push({
            code: "ASSIGNMENT_START_AFTER_TERMINATION",
            severity: "blocking",
            messageFa:
              "انتصاب باز با تاریخ شروع بزرگ‌تر یا مساوی تاریخ مؤثر خاتمه وجود دارد؛ نهایی‌سازی مسدود است.",
          });
        }
      }

      // Incompatible future Scheduled events — explicit Cancel dispose required
      const reader = opts.client ?? getConflictReadPool();
      if (!reader) {
        findings.push({
          code: "INCOMPATIBLE_FUTURE_EVENTS",
          severity: "blocking",
          messageFa:
            "امکان بررسی رویدادهای آینده ناسازگار وجود ندارد؛ نهایی‌سازی مسدود است.",
        });
      } else {
        const future = await findIncompatibleFutureEvents(reader, {
          personId: draft.personId,
          employmentId: targetEmpId,
          terminationEffectiveDate: draft.effectiveDate,
          excludeEventId: draft.finalizedEventId,
        });
        const conflict = incompatibleFutureToConflict(future);
        if (conflict) {
          findings.push(conflict);
        }
      }
    }
  }

  // Ladder–Grade invalid
  if (snapshot.refs.ladderId && snapshot.refs.gradeId) {
    try {
      const grade = await getGradeById(snapshot.refs.gradeId, db);
      if (!grade || grade.ladderId !== snapshot.refs.ladderId) {
        findings.push({
          code: "LADDER_GRADE_INVALID",
          severity: "blocking",
          messageFa: "گرید به لدر انتخاب‌شده تعلق ندارد.",
        });
      }
    } catch (err) {
      if (err instanceof JobRefError) {
        findings.push({
          code: "LADDER_GRADE_INVALID",
          severity: "blocking",
          messageFa: err.messageFa,
        });
      } else {
        findings.push({
          code: "LADDER_GRADE_INVALID",
          severity: "blocking",
          messageFa: "گرید به لدر انتخاب‌شده تعلق ندارد.",
        });
      }
    }
  }

  // Headcount — Start/Return use capacity port; other consuming types stay stub-blocked
  if (HEADCOUNT_CAPACITY_PORT_EVENT_TYPES.has(draft.eventType)) {
    const { facts } = parseStartReturnPayload(draft.payload);
    if (facts) {
      const reader = opts.client ?? getConflictReadPool();
      if (!reader) {
        findings.push({
          code: "HEADCOUNT_PORT_UNAVAILABLE",
          severity: "blocking",
          messageFa: MSG_HEADCOUNT_PORT_UNAVAILABLE_FA,
        });
      } else {
        const capacity = await evaluateHeadcountCapacity(reader, {
          teamId: facts.teamId,
          jobTitleId: facts.jobTitleId,
          ladderId: facts.ladderId,
          gradeId: facts.gradeId,
          effectiveDate: draft.effectiveDate,
          preferredSlotId: facts.capacitySlotId,
        });
        const conflict = capacityResultToConflict(capacity);
        if (conflict) {
          findings.push({
            code: conflict.code,
            severity: conflict.severity,
            messageFa: conflict.messageFa,
            requiresOverride: conflict.requiresOverride,
            requiresAck: conflict.requiresAck,
          });
        } else if (capacity.outcome === "compatible") {
          // Stash resolved slot into payload for consume on Effective apply
          draft.payload = {
            ...draft.payload,
            capacitySlotId: capacity.slotId,
          };
        }
      }
    }
  } else if (HEADCOUNT_CONSUMING_EVENT_TYPES.has(draft.eventType)) {
    findings.push({
      code: "HEADCOUNT_UNAPPROVED",
      severity: "blocking",
      messageFa: MSG_HEADCOUNT_CHECK_BLOCKED_FA,
    });
  }

  // Irreconcilable same-day ordering (Story 4.4) — conservative detectable stub.
  // Full dependent-graph detection lands with domain Start/Transfer (4.5+).
  // Detectable now: shared non-empty payload.orderingExclusiveKey on the same
  // person without neutralizing the earlier event (fail-closed).
  // Date equality is intentionally not required here — PG DATE ↔ JS Date TZ
  // shifts can skew equality; exclusive-key collision is sufficient for the stub.
  {
    const exclusiveKey = draft.payload.orderingExclusiveKey;
    if (typeof exclusiveKey === "string" && exclusiveKey.trim()) {
      const key = exclusiveKey.trim();
      const reader = opts.client ?? getConflictReadPool();
      if (!reader) {
        findings.push({
          code: "IRRECONCILABLE_ORDERING",
          severity: "blocking",
          messageFa: MSG_IRRECONCILABLE_ORDERING_FA,
        });
      } else {
        const existing = await reader.query<{
          id: string;
          cancels_event_id: string | null;
          reverses_event_id: string | null;
          payload: Record<string, unknown>;
        }>(
          `SELECT id, cancels_event_id, reverses_event_id, payload
           FROM kernel_events
           WHERE event_class = 'business'
             AND person_id = $1::uuid
             AND status NOT IN ('Cancelled', 'Reversed')
             AND payload->>'orderingExclusiveKey' = $2
             AND ($3::uuid IS NULL OR id <> $3::uuid)`,
          [draft.personId, key, draft.finalizedEventId ?? null],
        );
        const neutralizedTargets = new Set<string>();
        for (const row of existing.rows) {
          if (row.cancels_event_id) neutralizedTargets.add(row.cancels_event_id);
          if (row.reverses_event_id) neutralizedTargets.add(row.reverses_event_id);
        }
        const draftNeutralizes = new Set<string>();
        for (const k of [
          "correctsEventId",
          "cancelsEventId",
          "reversesEventId",
        ] as const) {
          const ref = draft.payload[k];
          if (typeof ref === "string" && ref.trim()) {
            draftNeutralizes.add(ref.trim());
          }
        }
        for (const row of existing.rows) {
          if (neutralizedTargets.has(row.id)) continue;
          if (draftNeutralizes.has(row.id)) continue;
          findings.push({
            code: "IRRECONCILABLE_ORDERING",
            severity: "blocking",
            messageFa: MSG_IRRECONCILABLE_ORDERING_FA,
          });
          break;
        }
      }
    }
  }

  // Pre-Baseline boundary (AR-TEMPORAL partial freeze).
  // Disposition when baselineBoundaryDate unset: gate inactive until configured
  // (documented fail-closed — do not invent a default epoch). Drafts may set
  // payload.requireBaselineCheck=true to force block while config is absent.
  const baseline = policy.baselineBoundaryDate?.trim() || null;
  if (baseline) {
    const b = parseDateOnly(baseline);
    if (!b.ok) {
      findings.push({
        code: "BASELINE_BOUNDARY_INVALID",
        severity: "blocking",
        messageFa:
          "مرز Baseline نامعتبر است؛ نهایی‌سازی تا اصلاح پیکربندی مسدود است.",
      });
    } else if (draft.effectiveDate < b.value) {
      if (policy.allowPreBaselineOverride) {
        findings.push({
          code: "PRE_BASELINE_EFFECTIVE_DATE",
          severity: "warning",
          messageFa: MSG_BASELINE_BOUNDARY_BLOCKED_FA,
          requiresAck: true,
          requiresOverride: true,
        });
      } else {
        findings.push({
          code: "PRE_BASELINE_EFFECTIVE_DATE",
          severity: "blocking",
          messageFa: MSG_BASELINE_BOUNDARY_BLOCKED_FA,
        });
      }
    }
  } else if (draft.payload.requireBaselineCheck === true) {
    // Baseline not configured but draft demanded check — fail-closed
    findings.push({
      code: "BASELINE_NOT_CONFIGURED",
      severity: "blocking",
      messageFa:
        "مرز Baseline پیکربندی نشده است؛ پذیرش خاموش تاریخ پیش از Baseline مجاز نیست.",
    });
  }

  // Downgrade unknown warnings that are not on allow-list to blocking
  for (const f of findings) {
    if (
      f.severity === "warning" &&
      f.requiresAck &&
      !warningAllow.has(f.code)
    ) {
      f.severity = "blocking";
      delete f.requiresAck;
    }
  }

  return findings;
}

export function hasBlockingConflicts(findings: ConflictFinding[]): boolean {
  return findings.some((f) => f.severity === "blocking");
}

export function warningCodesRequiringAck(
  findings: ConflictFinding[],
): string[] {
  return findings
    .filter((f) => f.severity === "warning" && f.requiresAck)
    .map((f) => f.code);
}

export function codesRequiringOverride(
  findings: ConflictFinding[],
): string[] {
  return findings.filter((f) => f.requiresOverride).map((f) => f.code);
}
