/**
 * Personnel Event Draft / finalize / lifecycle router (Stories 4.2–4.3).
 * Coarse role unlocks nav only — mutations require PermissionSet bindings.
 */
import { createPgPool, type Pool } from "@divan/db";
import {
  PERSONNEL_EVENT_CANCEL_PERMISSION,
  PERSONNEL_EVENT_CORRECT_PERMISSION,
  PERSONNEL_EVENT_DATA_CATEGORY,
  PERSONNEL_EVENT_DRAFT_PERMISSION,
  PERSONNEL_EVENT_FINALIZE_PERMISSION,
  PERSONNEL_EVENT_REVERSE_PERMISSION,
  PersonnelEventError,
  assertActorHasPersonnelEventCancel,
  assertActorHasPersonnelEventCorrect,
  assertActorHasPersonnelEventDraft,
  assertActorHasPersonnelEventFinalize,
  assertActorHasPersonnelEventReverse,
  cancelPersonnelEvent,
  correctPersonnelEvent,
  createDraft,
  deleteDraft,
  evaluateDraftForFinalize,
  finalizeDraft,
  getDraft,
  getPersonnelEventLifecycleCaps,
  listOpenDraftsForPerson,
  loadEventWithResolvedStatus,
  resolveLifecycleStatus,
  reversePersonnelEvent,
  updateDraft,
} from "@divan/person-employment";
import {
  BusinessEventValidationError,
  getBusinessEventById,
  listBusinessEventsForPerson,
  listChainLinksForEvents,
} from "@divan/event-store";
import { todayDateOnlyTehran } from "@divan/temporal-engine";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ensureRecalcEnqueueRegistered } from "./recalc-enqueue";
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

const cancelMeta = {
  permission: PERSONNEL_EVENT_CANCEL_PERMISSION,
  dataCategory: PERSONNEL_EVENT_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const reverseMeta = {
  permission: PERSONNEL_EVENT_REVERSE_PERMISSION,
  dataCategory: PERSONNEL_EVENT_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const correctMeta = {
  permission: PERSONNEL_EVENT_CORRECT_PERMISSION,
  dataCategory: PERSONNEL_EVENT_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

let finalizePool: Pool | null = null;
let enqueueReady: Promise<void> | null = null;

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

/** Pool + send port ready before any heavy-recalc mutation. */
async function readyFinalizePool(): Promise<Pool> {
  const pool = getFinalizePool();
  if (!enqueueReady) {
    enqueueReady = ensureRecalcEnqueueRegistered().catch((err) => {
      enqueueReady = null;
      throw err;
    });
  }
  await enqueueReady;
  return pool;
}

function mapPersonnelEventError(err: unknown): never {
  if (err instanceof PersonnelEventError) {
    if (
      err.code === "DRAFT_NOT_FOUND" ||
      err.code === "PERSON_NOT_FOUND" ||
      err.code === "EVENT_NOT_FOUND"
    ) {
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
  if (err instanceof BusinessEventValidationError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "شناسه رویداد نامعتبر است.",
      cause: err,
    });
  }
  throw err;
}

const payloadSchema = z.record(z.string(), z.unknown()).optional();
const reasonSchema = z
  .string()
  .min(1, "دلیل الزامی است")
  .max(2000, "دلیل نباید بیش از ۲۰۰۰ نویسه باشد");

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
            /** Ignored — server binds to session account. */
            approvedByAccountId: z.string().optional(),
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
            override: input.override
              ? {
                  reason: input.override.reason,
                  // Never trust client account id — bind to session actor.
                  approvedByAccountId: ctx.session.accountId,
                }
              : undefined,
            // Never trust client Override flag — session role only.
            actorMayOverride: ctx.session.coarseRole === "hr_admin",
          },
          await readyFinalizePool(),
        );
        if (result.outcome === "rejected") {
          throw new PersonnelEventError(result.code, result.messageFa);
        }
        return result;
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  get: governedProcedure
    .meta({ ...draftReadMeta, operation: "personnel_event.get" })
    .input(z.object({ eventId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        const event = await getBusinessEventById(
          getFinalizePool(),
          input.eventId,
        );
        if (!event) {
          throw new PersonnelEventError(
            "EVENT_NOT_FOUND",
            "رویداد پرسنلی یافت نشد.",
          );
        }
        return event;
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  resolve: governedProcedure
    .meta({ ...draftReadMeta, operation: "personnel_event.resolve" })
    .input(z.object({ eventId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        const resolved = await loadEventWithResolvedStatus(
          getFinalizePool(),
          input.eventId,
        );
        if (!resolved) {
          throw new PersonnelEventError(
            "EVENT_NOT_FOUND",
            "رویداد پرسنلی یافت نشد.",
          );
        }
        return {
          event: resolved.event,
          resolvedStatus: resolved.resolvedStatus,
          links: {
            cancellations: resolved.links.cancellations.map((e) => e.id),
            reversals: resolved.links.reversals.map((e) => e.id),
            corrections: resolved.links.corrections.map((e) => e.id),
          },
        };
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  listForPerson: governedProcedure
    .meta({ ...draftReadMeta, operation: "personnel_event.list_for_person" })
    .input(
      z.object({
        personId: z.string().min(1),
        limit: z.number().int().positive().max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        const asOf = todayDateOnlyTehran();
        const pool = getFinalizePool();
        const events = await listBusinessEventsForPerson(
          pool,
          input.personId,
          { limit: input.limit },
        );
        const linksByTarget = await listChainLinksForEvents(
          pool,
          events.map((e) => e.id),
        );
        return events.map((event) => {
          const links = linksByTarget.get(event.id) ?? {
            cancellations: [],
            reversals: [],
            corrections: [],
          };
          return {
            event,
            resolvedStatus: resolveLifecycleStatus(event, links, asOf),
            links: {
              cancellations: links.cancellations.map((e) => e.id),
              reversals: links.reversals.map((e) => e.id),
              corrections: links.corrections.map((e) => e.id),
            },
          };
        });
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  lifecycleCaps: governedProcedure
    .meta({ ...draftReadMeta, operation: "personnel_event.lifecycle_caps" })
    .query(async ({ ctx }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        return await getPersonnelEventLifecycleCaps(ctx.session.accountId);
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  cancel: governedProcedure
    .meta({ ...cancelMeta, operation: "personnel_event.cancel" })
    .input(
      z.object({
        eventId: z.string().min(1),
        reason: reasonSchema,
        idempotencyKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventCancel(ctx.session.accountId);
        return await cancelPersonnelEvent(
          input.eventId,
          {
            actorId: ctx.session.accountId,
            correlationId: ctx.correlationId,
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
          },
          getFinalizePool(),
        );
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  reverse: governedProcedure
    .meta({ ...reverseMeta, operation: "personnel_event.reverse" })
    .input(
      z.object({
        eventId: z.string().min(1),
        reason: reasonSchema,
        idempotencyKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventReverse(ctx.session.accountId);
        return await reversePersonnelEvent(
          input.eventId,
          {
            actorId: ctx.session.accountId,
            correlationId: ctx.correlationId,
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
          },
          await readyFinalizePool(),
        );
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  correct: governedProcedure
    .meta({ ...correctMeta, operation: "personnel_event.correct" })
    .input(
      z.object({
        eventId: z.string().min(1),
        reason: reasonSchema,
        idempotencyKey: z.string().optional(),
        correctionPayload: payloadSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventCorrect(ctx.session.accountId);
        return await correctPersonnelEvent(
          input.eventId,
          {
            actorId: ctx.session.accountId,
            correlationId: ctx.correlationId,
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
            correctionPayload: input.correctionPayload,
          },
          await readyFinalizePool(),
        );
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),
});
