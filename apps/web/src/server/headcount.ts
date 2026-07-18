/**
 * Headcount Approval governed router (Story 4.12 / FR-28).
 * Mirrors job-reference: governedProcedure + Zod + domain errors → TRPCError.
 */
import { createPgPool, type Pool } from "@divan/db";
import {
  HEADCOUNT_APPROVAL_DATA_CATEGORY,
  HEADCOUNT_APPROVAL_READ_PERMISSION,
  HEADCOUNT_APPROVAL_WRITE_PERMISSION,
  HeadcountApprovalError,
  activateApproval,
  assertActorHasHeadcountApprovalRead,
  assertActorHasHeadcountApprovalWrite,
  cancelApproval,
  createApproval,
  ensureHeadcountApprovalSchema,
  ensureHeadcountCapacitySchema,
  expireApproval,
  getApproval,
  listApprovals,
  updateApproval,
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

async function withSchema<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = getHeadcountPool();
  await ensureHeadcountCapacitySchema(pool);
  await ensureHeadcountApprovalSchema(pool);
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
});
