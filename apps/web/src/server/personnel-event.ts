/**
 * Personnel Event Draft / finalize / lifecycle router (Stories 4.2–4.3).
 * Coarse role unlocks nav only — mutations require PermissionSet bindings.
 */
import { getSharedPgPool, type Pool } from "@divan/db";
import { readHeadcountCapacityPanel } from "@divan/headcount";
import {
  PERSONNEL_EVENT_CANCEL_PERMISSION,
  PERSONNEL_EVENT_CORRECT_PERMISSION,
  PERSONNEL_EVENT_DATA_CATEGORY,
  PERSONNEL_EVENT_DRAFT_PERMISSION,
  PERSONNEL_EVENT_FINALIZE_PERMISSION,
  PERSONNEL_EVENT_REVERSE_PERMISSION,
  PersonnelEventError,
  finalizeRejectEnvelopeMessageFa,
  PersonIdentityError,
  assertActorHasPersonnelEventCancel,
  assertActorHasPersonnelEventCorrect,
  assertActorHasPersonnelEventDraft,
  assertActorHasPersonnelEventFinalize,
  assertActorHasPersonnelEventReverse,
  assertActorHasCompensationWrite,
  cancelPersonnelEvent,
  correctPersonnelEvent,
  createDraft,
  deleteDraft,
  evaluateDraftForFinalize,
  finalizeDraft,
  getActivePrimaryAssignmentAsOf,
  getDraft,
  assertDraftEditable,
  getPersonnelEventLifecycleCaps,
  listOpenDraftsForPerson,
  loadEventWithResolvedStatus,
  resolveLifecycleStatus,
  reversePersonnelEvent,
  updateDraft,
  PERSONNEL_EVENT_PRODUCT_RISK_TIERS,
  COMPENSATION_EVENT_TYPES,
} from "@divan/person-employment";
import {
  clearDraftCompensationValues,
  putDraftCompensationValues,
} from "@divan/compensation-facts";
import {
  BusinessEventValidationError,
  getBusinessEventById,
  listBusinessEventsForPerson,
  listChainLinksForEvents,
} from "@divan/event-store";
import { todayDateOnlyTehran } from "@divan/temporal-engine";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertPersonInScopedPopulation } from "./personnel-scoped-search";
import {
  runPersonnelEventSearch,
  type PersonnelEventSearchResult,
} from "./personnel-event-search";
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
  finalizePool = getSharedPgPool(url);
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
  if (err instanceof PersonIdentityError) {
    if (err.code === "PERSON_NOT_FOUND") {
      throw new TRPCError({
        code: "NOT_FOUND",
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
        await clearDraftCompensationValues(input.draftId);
        return await deleteDraft(
          input.draftId,
          input.expectedVersion,
          { accountId: ctx.session.accountId },
        );
      } catch (err) {
        mapPersonnelEventError(err);
      }
    }),

  /** Story 4.8 — sensitive monetary values for CompensationChanged (never in draft payload). */
  putCompensationSidecar: governedProcedure
    .meta({ ...draftMeta, operation: "personnel_event.compensation_sidecar.put" })
    .input(
      z.object({
        draftId: z.string().min(1),
        amount: z
          .string()
          .min(1)
          .regex(/^-?\d+(\.\d+)?$/, "مبلغ باید عدد اعشاری معتبر باشد"),
        components: z.unknown().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        await assertActorHasCompensationWrite(ctx.session.accountId);
        const draft = await getDraft(input.draftId);
        if (!draft || draft.eventType !== "CompensationChanged") {
          throw new PersonnelEventError(
            "VALIDATION",
            "کانال حساس فقط برای CompensationChanged مجاز است.",
          );
        }
        assertDraftEditable(draft);
        await putDraftCompensationValues(input.draftId, {
          amount: input.amount,
          components: input.components ?? null,
        });
        return { ok: true as const };
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
        const draft = await getDraft(input.draftId);
        if (draft && COMPENSATION_EVENT_TYPES.has(draft.eventType)) {
          await assertActorHasCompensationWrite(ctx.session.accountId);
        }
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
            // Authorize termination + compensation_change tiers (Stories 4.6 / 4.8).
            // Omit → pending_review. Full AR-ACCESS matrix deferred.
            riskTier: PERSONNEL_EVENT_PRODUCT_RISK_TIERS,
          },
          await readyFinalizePool(),
        );
        if (result.outcome === "rejected") {
          const conflicts = result.conflicts ?? [];
          const messageFa = finalizeRejectEnvelopeMessageFa({
            code: result.code,
            messageFa: result.messageFa,
            conflicts,
          });
          throw new PersonnelEventError(
            result.code,
            messageFa,
            undefined,
            conflicts,
          );
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
        /** Align with event-store list clamp / timeline load-more (Story 5.3). */
        limit: z.number().int().positive().max(200).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        await assertActorHasPersonnelEventDraft(ctx.session.accountId);
        await assertPersonInScopedPopulation({
          personId: input.personId,
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
          channel: "timeline",
        });
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

  /**
   * Org-wide permission-safe event catalogue (Story 9.6).
   * Does not replace listForPerson (timeline SoT).
   */
  search: governedProcedure
    .meta({ ...draftReadMeta, operation: "personnel_event.search" })
    .input(
      z
        .object({
          page: z.number().int().min(1).optional(),
          pageSize: z.number().int().min(1).max(100).optional(),
          evaluationSnapshotId: z.string().min(1).optional(),
          eventTypes: z.array(z.string().min(1)).max(32).optional(),
          statuses: z
            .array(
              z.enum([
                "Draft",
                "Scheduled",
                "Effective",
                "Cancelled",
                "Reversed",
              ]),
            )
            .max(8)
            .optional(),
          effectiveFrom: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          effectiveTo: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          teamId: z.string().uuid().optional(),
          personId: z.string().uuid().optional(),
        })
        .refine(
          (v) =>
            !v.effectiveFrom ||
            !v.effectiveTo ||
            v.effectiveFrom <= v.effectiveTo,
          {
            message: "effectiveFrom must be on or before effectiveTo",
            path: ["effectiveTo"],
          },
        )
        .optional(),
    )
    .query(async ({ ctx, input }): Promise<PersonnelEventSearchResult> => {
      try {
        return await runPersonnelEventSearch({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
          page: input?.page,
          pageSize: input?.pageSize,
          evaluationSnapshotId: input?.evaluationSnapshotId,
          eventTypes: input?.eventTypes,
          statuses: input?.statuses,
          effectiveFrom: input?.effectiveFrom,
          effectiveTo: input?.effectiveTo,
          teamId: input?.teamId,
          personId: input?.personId,
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

  /** UX-DR13 — destination capacity panel for Transfer form. */
  headcountCapacity: governedProcedure
    .meta({ ...draftReadMeta, operation: "personnel_event.headcount_capacity" })
    .input(
      z.object({
        teamId: z.string().uuid(),
        effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        jobTitleId: z.string().uuid().optional(),
        seniorityId: z.string().uuid().nullable().optional(),
        ladderId: z.string().uuid().optional(),
        gradeId: z.string().uuid().optional(),
        preferredSlotId: z.string().uuid().optional(),
        preferredApprovalId: z.string().uuid().optional(),
        primaryAssignmentId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertActorHasPersonnelEventDraft(ctx.session.accountId);
      const pool = await readyFinalizePool();
      return await readHeadcountCapacityPanel(pool, {
        teamId: input.teamId,
        jobTitleId: input.jobTitleId,
        seniorityId: input.seniorityId,
        ladderId: input.ladderId,
        gradeId: input.gradeId,
        effectiveDate: input.effectiveDate,
        preferredSlotId: input.preferredSlotId,
        preferredApprovalId: input.preferredApprovalId,
        primaryAssignmentId: input.primaryAssignmentId,
      });
    }),

  /** UJ-1 — current source Primary summary for Transfer form. */
  sourcePrimarySummary: governedProcedure
    .meta({ ...draftReadMeta, operation: "personnel_event.source_primary_summary" })
    .input(
      z.object({
        employmentId: z.string().uuid(),
        asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertActorHasPersonnelEventDraft(ctx.session.accountId);
      const primary = await getActivePrimaryAssignmentAsOf(
        input.employmentId,
        input.asOfDate,
      );
      if (!primary) return null;
      return {
        id: primary.id,
        teamId: primary.teamId,
        organizationalRoleId: primary.organizationalRoleId,
        jobTitleId: primary.jobTitleId,
        ladderId: primary.ladderId,
        gradeId: primary.gradeId,
        seniorityId: primary.seniorityId,
        headcountApprovalId: primary.headcountApprovalId,
        startDate: primary.startDate,
        endDateExclusive: primary.endDateExclusive,
      };
    }),
});
