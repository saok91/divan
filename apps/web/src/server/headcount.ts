/**
 * Headcount Approval + Exemption + Override + matching governed router (Stories 4.12–4.14).
 * Mirrors job-reference: governedProcedure + Zod + domain errors → TRPCError.
 */
import { createPgPool, type Pool } from "@divan/db";
import {
  HEADCOUNT_APPROVAL_DATA_CATEGORY,
  HEADCOUNT_APPROVAL_READ_PERMISSION,
  HEADCOUNT_APPROVAL_WRITE_PERMISSION,
  HEADCOUNT_EXEMPTION_DATA_CATEGORY,
  HEADCOUNT_EXEMPTION_READ_PERMISSION,
  HEADCOUNT_EXEMPTION_WRITE_PERMISSION,
  HEADCOUNT_OVERRIDE_DATA_CATEGORY,
  HEADCOUNT_OVERRIDE_READ_PERMISSION,
  HEADCOUNT_OVERRIDE_WRITE_PERMISSION,
  HeadcountApprovalError,
  HeadcountExemptionError,
  HeadcountOverrideError,
  activateApproval,
  activateExemption,
  assertActorHasHeadcountApprovalRead,
  assertActorHasHeadcountApprovalWrite,
  assertActorHasHeadcountExemptionRead,
  assertActorHasHeadcountExemptionWrite,
  assertActorHasHeadcountOverrideRead,
  assertActorHasHeadcountOverrideWrite,
  cancelApproval,
  createApproval,
  createExemption,
  ensureHeadcountApprovalSchema,
  ensureHeadcountCapacitySchema,
  ensureHeadcountExemptionSchema,
  ensureHeadcountOverrideSchema,
  expireApproval,
  getApproval,
  getExemption,
  getOverride,
  listApprovals,
  listCompatibleApprovalCandidates,
  listExemptions,
  listOverrides,
  revokeExemption,
  updateApproval,
  voidOverride,
  checkReservationExpiryByEventId,
  getScheduledExceptionMarker,
  ensureScheduledExceptionSchema,
} from "@divan/headcount";
import { getPersonDb } from "@divan/person-employment";
import { parseDateOnly } from "@divan/temporal-engine";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, governedProcedure } from "./trpc";

const approvalReadMeta = {
  permission: HEADCOUNT_APPROVAL_READ_PERMISSION,
  dataCategory: HEADCOUNT_APPROVAL_DATA_CATEGORY,
  action: "read" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const approvalWriteMeta = {
  permission: HEADCOUNT_APPROVAL_WRITE_PERMISSION,
  dataCategory: HEADCOUNT_APPROVAL_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const exemptionReadMeta = {
  permission: HEADCOUNT_EXEMPTION_READ_PERMISSION,
  dataCategory: HEADCOUNT_EXEMPTION_DATA_CATEGORY,
  action: "read" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const exemptionWriteMeta = {
  permission: HEADCOUNT_EXEMPTION_WRITE_PERMISSION,
  dataCategory: HEADCOUNT_EXEMPTION_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const overrideReadMeta = {
  permission: HEADCOUNT_OVERRIDE_READ_PERMISSION,
  dataCategory: HEADCOUNT_OVERRIDE_DATA_CATEGORY,
  action: "read" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const overrideWriteMeta = {
  permission: HEADCOUNT_OVERRIDE_WRITE_PERMISSION,
  dataCategory: HEADCOUNT_OVERRIDE_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

let headcountPool: Pool | null = null;

function getHeadcountPool(): Pool {
  if (headcountPool) return headcountPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "پیکربندی پایگاه داده برای مجوز ظرفیت موجود نیست.",
    });
  }
  headcountPool = createPgPool(url);
  return headcountPool;
}

const dateOnlySchema = z
  .string()
  .min(1)
  .superRefine((val, ctx) => {
    const parsed = parseDateOnly(val);
    if (!parsed.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تاریخ نامعتبر است.",
      });
    }
  });

function mapApprovalError(err: unknown): never {
  if (err instanceof HeadcountApprovalError) {
    if (err.code === "NOT_FOUND") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "DUPLICATE_CODE") {
      throw new TRPCError({
        code: "CONFLICT",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "PERMISSION_DENIED") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: err.messageFa,
        cause: err,
      });
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  throw err;
}

function mapExemptionError(err: unknown): never {
  if (err instanceof HeadcountExemptionError) {
    if (err.code === "NOT_FOUND") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "PERMISSION_DENIED") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "UNCOVER") {
      throw new TRPCError({
        code: "CONFLICT",
        message: err.messageFa,
        cause: err,
      });
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  throw err;
}

function mapOverrideError(err: unknown): never {
  if (err instanceof HeadcountOverrideError) {
    if (err.code === "NOT_FOUND") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "PERMISSION_DENIED") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: err.messageFa,
        cause: err,
      });
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  throw err;
}

async function withSchema<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = getHeadcountPool();
  await ensureHeadcountCapacitySchema(pool);
  await ensureHeadcountApprovalSchema(pool);
  await ensureHeadcountExemptionSchema(pool);
  await ensureHeadcountOverrideSchema(pool);
  await ensureScheduledExceptionSchema(pool);
  return fn(pool);
}

export const headcountRouter = createTRPCRouter({
  listApprovals: governedProcedure
    .meta({ ...approvalReadMeta, operation: "headcount.approval.list" })
    .input(
      z
        .object({
          status: z
            .enum(["draft", "active", "cancelled", "expired"])
            .optional(),
          teamId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await assertActorHasHeadcountApprovalRead(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) =>
          listApprovals(pool, {
            status: input?.status,
            teamId: input?.teamId,
          }),
        );
      } catch (err) {
        mapApprovalError(err);
      }
    }),

  listCompatibleApprovals: governedProcedure
    .meta({
      ...approvalReadMeta,
      operation: "headcount.approval.list_compatible",
    })
    .input(
      z.object({
        teamId: z.string().uuid(),
        jobTitleId: z.string().uuid(),
        seniorityId: z.string().uuid().nullable().optional(),
        evaluationDate: dateOnlySchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertActorHasHeadcountApprovalRead(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) =>
          listCompatibleApprovalCandidates(pool, {
            teamId: input.teamId,
            jobTitleId: input.jobTitleId,
            seniorityId: input.seniorityId,
            evaluationDate: input.evaluationDate,
          }),
        );
      } catch (err) {
        mapApprovalError(err);
      }
    }),

  getApproval: governedProcedure
    .meta({ ...approvalReadMeta, operation: "headcount.approval.get" })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertActorHasHeadcountApprovalRead(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        const row = await withSchema((pool) => getApproval(pool, input.id));
        if (!row) {
          throw new HeadcountApprovalError(
            "NOT_FOUND",
            "مجوز ظرفیت یافت نشد.",
          );
        }
        return row;
      } catch (err) {
        mapApprovalError(err);
      }
    }),

  createApproval: governedProcedure
    .meta({ ...approvalWriteMeta, operation: "headcount.approval.create" })
    .input(
      z.object({
        requirementCode: z.string().min(1),
        teamId: z.string().uuid(),
        jobTitleId: z.string().uuid(),
        seniorityId: z.string().uuid().nullable().optional(),
        allowedCount: z.number().int().min(0),
        validityStart: dateOnlySchema,
        validityEndExclusive: dateOnlySchema,
        approvalReference: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActorHasHeadcountApprovalWrite(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) =>
          createApproval(pool, {
            ...input,
            actorId: ctx.session.accountId,
          }),
        );
      } catch (err) {
        mapApprovalError(err);
      }
    }),

  activateApproval: governedProcedure
    .meta({ ...approvalWriteMeta, operation: "headcount.approval.activate" })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasHeadcountApprovalWrite(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) =>
          activateApproval(pool, {
            id: input.id,
            actorId: ctx.session.accountId,
          }),
        );
      } catch (err) {
        mapApprovalError(err);
      }
    }),

  updateApproval: governedProcedure
    .meta({ ...approvalWriteMeta, operation: "headcount.approval.update" })
    .input(
      z.object({
        id: z.string().uuid(),
        requirementCode: z.string().min(1).optional(),
        teamId: z.string().uuid().optional(),
        jobTitleId: z.string().uuid().optional(),
        seniorityId: z.string().uuid().nullable().optional(),
        allowedCount: z.number().int().min(0).optional(),
        validityStart: dateOnlySchema.optional(),
        validityEndExclusive: dateOnlySchema.optional(),
        approvalReference: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActorHasHeadcountApprovalWrite(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        const { id, ...rest } = input;
        return await withSchema((pool) =>
          updateApproval(pool, {
            id,
            ...rest,
            actorId: ctx.session.accountId,
          }),
        );
      } catch (err) {
        mapApprovalError(err);
      }
    }),

  cancelApproval: governedProcedure
    .meta({ ...approvalWriteMeta, operation: "headcount.approval.cancel" })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasHeadcountApprovalWrite(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) =>
          cancelApproval(pool, {
            id: input.id,
            actorId: ctx.session.accountId,
          }),
        );
      } catch (err) {
        mapApprovalError(err);
      }
    }),

  expireApproval: governedProcedure
    .meta({ ...approvalWriteMeta, operation: "headcount.approval.expire" })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasHeadcountApprovalWrite(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) =>
          expireApproval(pool, {
            id: input.id,
            actorId: ctx.session.accountId,
          }),
        );
      } catch (err) {
        mapApprovalError(err);
      }
    }),

  listExemptions: governedProcedure
    .meta({ ...exemptionReadMeta, operation: "headcount.exemption.list" })
    .input(
      z
        .object({
          status: z
            .enum(["draft", "active", "revoked", "expired"])
            .optional(),
          primaryAssignmentId: z.string().min(1).optional(),
          personId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await assertActorHasHeadcountExemptionRead(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) =>
          listExemptions(pool, {
            status: input?.status,
            primaryAssignmentId: input?.primaryAssignmentId,
            personId: input?.personId,
          }),
        );
      } catch (err) {
        mapExemptionError(err);
      }
    }),

  getExemption: governedProcedure
    .meta({ ...exemptionReadMeta, operation: "headcount.exemption.get" })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertActorHasHeadcountExemptionRead(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) => getExemption(pool, input.id));
      } catch (err) {
        mapExemptionError(err);
      }
    }),

  createExemption: governedProcedure
    .meta({ ...exemptionWriteMeta, operation: "headcount.exemption.create" })
    .input(
      z.object({
        policyCode: z.string().min(1),
        primaryAssignmentId: z.string().min(1),
        personId: z.string().uuid(),
        approverAccountId: z.string().uuid().optional(),
        reason: z.string().min(1),
        validityStart: dateOnlySchema,
        validityEndExclusive: dateOnlySchema,
        reportingTreatment: z.enum([
          "exclude_from_used",
          "count_as_used_exempt",
          "other",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActorHasHeadcountExemptionWrite(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        const db = getPersonDb();
        const primary = await db.primaryAssignment.findUnique({
          where: { id: input.primaryAssignmentId },
          include: { employment: { select: { personId: true } } },
        });
        if (!primary || primary.employment.personId !== input.personId) {
          throw new HeadcountExemptionError(
            "VALIDATION",
            "انتصاب اصلی به این فرد تعلق ندارد یا یافت نشد.",
            "primary_person_mismatch",
          );
        }
        return await withSchema((pool) =>
          createExemption(pool, {
            policyCode: input.policyCode,
            primaryAssignmentId: input.primaryAssignmentId,
            personId: input.personId,
            actorAccountId: ctx.session.accountId,
            approverAccountId:
              input.approverAccountId ?? ctx.session.accountId,
            reason: input.reason,
            validityStart: input.validityStart,
            validityEndExclusive: input.validityEndExclusive,
            reportingTreatment: input.reportingTreatment,
            actorId: ctx.session.accountId,
          }),
        );
      } catch (err) {
        mapExemptionError(err);
      }
    }),

  activateExemption: governedProcedure
    .meta({ ...exemptionWriteMeta, operation: "headcount.exemption.activate" })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasHeadcountExemptionWrite(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) =>
          activateExemption(pool, {
            id: input.id,
            actorId: ctx.session.accountId,
          }),
        );
      } catch (err) {
        mapExemptionError(err);
      }
    }),

  revokeExemption: governedProcedure
    .meta({ ...exemptionWriteMeta, operation: "headcount.exemption.revoke" })
    .input(
      z.object({
        id: z.string().uuid(),
        /** Only meaningful for draft cancel; ignored for active. */
        allowUncover: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActorHasHeadcountExemptionWrite(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema(async (pool) => {
          const existing = await getExemption(pool, input.id);
          if (!existing) {
            throw new HeadcountExemptionError(
              "NOT_FOUND",
              "معافیت ظرفیت یافت نشد.",
            );
          }
          let hasApprovalRebind = false;
          let allowUncover = false;
          if (existing.status === "draft") {
            allowUncover = true;
          } else if (existing.status === "active") {
            const primary = await getPersonDb().primaryAssignment.findUnique({
              where: { id: existing.primaryAssignmentId },
              select: { headcountApprovalId: true },
            });
            hasApprovalRebind = Boolean(primary?.headcountApprovalId?.trim());
            if (!hasApprovalRebind) {
              throw new HeadcountExemptionError(
                "UNCOVER",
                "لغو معافیت انتصاب را بدون مجوز ظرفیت پوشش‌نداده رها می‌کند؛ تا تعیین تکلیف مسدود است.",
              );
            }
          }
          return revokeExemption(pool, {
            id: input.id,
            actorId: ctx.session.accountId,
            allowUncover,
            hasApprovalRebind,
          });
        });
      } catch (err) {
        mapExemptionError(err);
      }
    }),

  listOverrides: governedProcedure
    .meta({ ...overrideReadMeta, operation: "headcount.override.list" })
    .input(
      z
        .object({
          status: z.enum(["active", "superseded", "voided"]).optional(),
          violatedRule: z
            .enum(["shortage", "validity", "job_title", "seniority"])
            .optional(),
          teamId: z.string().optional(),
          slotId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await assertActorHasHeadcountOverrideRead(
        ctx.session.accountId,
        getPersonDb(),
      );
      return withSchema((pool) =>
        listOverrides(pool, {
          status: input?.status,
          violatedRule: input?.violatedRule,
          teamId: input?.teamId,
          slotId: input?.slotId,
        }),
      );
    }),

  getOverride: governedProcedure
    .meta({ ...overrideReadMeta, operation: "headcount.override.get" })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertActorHasHeadcountOverrideRead(
        ctx.session.accountId,
        getPersonDb(),
      );
      const row = await withSchema((pool) => getOverride(pool, input.id));
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "لغو محدودیت ظرفیت یافت نشد.",
        });
      }
      return row;
    }),

  voidOverride: governedProcedure
    .meta({ ...overrideWriteMeta, operation: "headcount.override.void" })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasHeadcountOverrideWrite(
        ctx.session.accountId,
        getPersonDb(),
      );
      try {
        return await withSchema((pool) =>
          voidOverride(pool, {
            id: input.id,
            actorId: ctx.session.accountId,
          }),
        );
      } catch (err) {
        mapOverrideError(err);
      }
    }),

  reservationExpiryForEvent: governedProcedure
    .meta({
      ...overrideReadMeta,
      operation: "headcount.reservation.expiry_for_event",
    })
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertActorHasHeadcountOverrideRead(
        ctx.session.accountId,
        getPersonDb(),
      );
      return withSchema(async (pool) => {
        await ensureScheduledExceptionSchema(pool);
        return checkReservationExpiryByEventId(pool, input.eventId);
      });
    }),

  scheduledExceptionForEvent: governedProcedure
    .meta({
      ...overrideReadMeta,
      operation: "headcount.scheduled_exception.get",
    })
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertActorHasHeadcountOverrideRead(
        ctx.session.accountId,
        getPersonDb(),
      );
      return withSchema((pool) =>
        getScheduledExceptionMarker(pool, input.eventId),
      );
    }),
});
