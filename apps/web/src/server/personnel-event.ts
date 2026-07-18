/**
 * Personnel Event Draft / finalize router (Story 4.2 / FR-15 / FR-19).
 * Coarse role unlocks nav only — mutations require PermissionSet bindings.
 */
import { createPgPool, type Pool } from "@divan/db";
import {
  PERSONNEL_EVENT_DATA_CATEGORY,
  PERSONNEL_EVENT_DRAFT_PERMISSION,
  PERSONNEL_EVENT_FINALIZE_PERMISSION,
  PersonnelEventError,
  assertActorHasPersonnelEventDraft,
  assertActorHasPersonnelEventFinalize,
  createDraft,
  deleteDraft,
  evaluateDraftForFinalize,
  finalizeDraft,
  getDraft,
  listOpenDraftsForPerson,
  updateDraft,
} from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, governedProcedure } from "./trpc";

const draftMeta = {
  permission: PERSONNEL_EVENT_DRAFT_PERMISSION,
  dataCategory: PERSONNEL_EVENT_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const draftReadMeta = {
  permission: PERSONNEL_EVENT_DRAFT_PERMISSION,
  dataCategory: PERSONNEL_EVENT_DATA_CATEGORY,
  action: "read" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const finalizeMeta = {
  permission: PERSONNEL_EVENT_FINALIZE_PERMISSION,
  dataCategory: PERSONNEL_EVENT_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

let finalizePool: Pool | null = null;

function getFinalizePool(): Pool {
  if (finalizePool) return finalizePool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "پیکربندی پایگاه‌داده در دسترس نیست.",
    });
  }
  finalizePool = createPgPool(url);
  return finalizePool;
}

function mapPersonnelEventError(err: unknown): never {
  if (err instanceof PersonnelEventError) {
    if (err.code === "DRAFT_NOT_FOUND" || err.code === "PERSON_NOT_FOUND") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: err.messageFa,
        cause: err,
      });
    }
    if (
      err.code === "DRAFT_VERSION_CONFLICT" ||
      err.code === "FINALIZE_IDEMPOTENCY_CONFLICT" ||
      err.code === "DRAFT_ALREADY_FINALIZED"
    ) {
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

const payloadSchema = z.record(z.string(), z.unknown()).optional();

export const personnelEventRouter = createTRPCRouter({
  draftCreate: governedProcedure
    .meta({ ...draftMeta, operation: "personnel_event.draft.create" })
    .input(
      z.object({
        personId: z.string().min(1),
        employmentId: z.string().optional().nullable(),
        eventType: z.string().min(1),
        effectiveDate: z.string().min(1),
        payload: payloadSchema,
        idempotencyKey: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        return await createDraft(input, { accountId: ctx.session.accountId });
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  draftUpdate: governedProcedure
    .meta({ ...draftMeta, operation: "personnel_event.draft.update" })
    .input(
      z.object({
        draftId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        employmentId: z.string().optional().nullable(),
        eventType: z.string().optional(),
        effectiveDate: z.string().optional(),
        payload: payloadSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        return await updateDraft(input, { accountId: ctx.session.accountId });
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  draftDelete: governedProcedure
    .meta({ ...draftMeta, operation: "personnel_event.draft.delete" })
    .input(
      z.object({
        draftId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        return await deleteDraft(
          input.draftId,
          input.expectedVersion,
          { accountId: ctx.session.accountId },
        );
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  draftGet: governedProcedure
    .meta({ ...draftReadMeta, operation: "personnel_event.draft.get" })
    .input(z.object({ draftId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        return await getDraft(input.draftId);
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  draftListOpen: governedProcedure
    .meta({ ...draftReadMeta, operation: "personnel_event.draft.list_open" })
    .input(z.object({ personId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        return await listOpenDraftsForPerson(input.personId);
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  evaluate: governedProcedure
    .meta({ ...finalizeMeta, operation: "personnel_event.evaluate" })
    .input(z.object({ draftId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventFinalize(ctx.session.accountId);
        return await evaluateDraftForFinalize(
          input.draftId,
          ctx.session.accountId,
          { correlationId: ctx.correlationId },
        );
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  finalize: governedProcedure
    .meta({ ...finalizeMeta, operation: "personnel_event.finalize" })
    .input(
      z.object({
        draftId: z.string().min(1),
        expectedVersion: z.number().int().positive().optional(),
        idempotencyKey: z.string().optional(),
        acknowledgement: z
          .object({
            warningCodes: z.array(z.string()),
            acknowledgedAt: z.string().optional(),
          })
          .optional(),
        override: z
          .object({
            reason: z.string().min(1),
            approvedByAccountId: z.string().min(1),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventFinalize(ctx.session.accountId);
        const result = await finalizeDraft(
          {
            draftId: input.draftId,
            actorId: ctx.session.accountId,
            correlationId: ctx.correlationId,
            expectedVersion: input.expectedVersion,
            idempotencyKey: input.idempotencyKey,
            acknowledgement: input.acknowledgement,
            override: input.override,
            // Never trust client Override flag — session role only (4.2 stub).
            actorMayOverride: ctx.session.coarseRole === "hr_admin",
          },
          getFinalizePool(),
        );
        if (result.outcome === "rejected") {
          throw new PersonnelEventError(result.code, result.messageFa);
        }
        return result;
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),
});
