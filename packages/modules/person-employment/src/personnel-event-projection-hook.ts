/**
 * AD-6 projection refresh hook — runs inside the same DB txn as finalize / lifecycle append.
 *
 * FR-16: Scheduled events must not mutate current projections (applyToCurrentProjection=false),
 * except Transfer destination capacity reserve (reserve ≠ Primary mutation).
 * Story 4.5: Effective Start/Return → Employment + Primary projectors (+ capacity consume).
 * Story 4.6: Effective Termination → close Assignments + Employment + capacity release.
 * Story 4.7: Transfer Scheduled reserve / Effective atomic Primary move + capacity.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { PoolClient } from "@divan/db";
import { getBusinessEventById } from "@divan/event-store";

import { getPersonDb } from "./db";
import type { PersonnelEventDraftRecord } from "./personnel-event-draft";
import {
  START_RETURN_EVENT_TYPES,
  applyStartReturnProjections,
  bindEmploymentIdAfterApply,
  compensateOrphanStartReturnProjections,
} from "./personnel-event-start-return";
import {
  TERMINATION_EVENT_TYPES,
  applyTerminationProjections,
  compensateTerminationApply,
} from "./personnel-event-termination";
import {
  TRANSFER_EVENT_TYPES,
  applyTransferProjections,
  applyTransferScheduledReserve,
  compensateTransferApply,
  releaseTransferReservationOnCancel,
  undoTransferApply,
} from "./personnel-event-transfer";

export type ProjectionRefreshContext = {
  client: PoolClient;
  /** Present for Draft finalize; absent for Cancel/Reverse/Correction / recalc. */
  draft?: PersonnelEventDraftRecord | null;
  eventId: string;
  eventType: string;
  /** Lifecycle op when Cancel / Reverse / Correction (Story 4.3). */
  lifecycleOp?: "cancel" | "reverse" | "correct";
  targetEventId?: string;
  /**
   * When false, hook records invocation but must not apply current-state domain
   * effects (Scheduled finalize / Cancel of Scheduled) — except Transfer reserve.
   */
  applyToCurrentProjection?: boolean;
  /** Set by hook implementations / tests to prove invocation. */
  invoked?: { eventId: string; eventType: string };
  /** Filled when Start/Return/Termination/Transfer touched an Employment. */
  appliedEmploymentId?: string;
  /** Set when this hook invocation newly created a Primary (for orphan compensate). */
  createdStartReturnPrimaryId?: string;
  /** Set when Termination applied closes (for post-hook orphan compensate). */
  terminationApply?: {
    employmentId: string;
    endDateExclusive: string;
    closedPrimaries: Array<{ id: string; previousEnd: string | null }>;
    closedSecondaries: Array<{ id: string; previousEnd: string | null }>;
    didRelease: boolean;
    didCloseEmployment: boolean;
  };
  /** Set when Transfer applied (for post-hook orphan compensate). */
  transferApply?: {
    employmentId: string;
    endDateExclusive: string;
    sourcePrimaryId: string | null;
    previousSourceEnd: string | null;
    destinationPrimaryId: string | null;
    didCloseSource: boolean;
    didOpenDest: boolean;
    didReleaseSource: boolean;
    didMoveDestCapacity: boolean;
    reservedOnly: boolean;
  };
};

export type ProjectionRefreshHook = (
  ctx: ProjectionRefreshContext,
) => Promise<void>;

/**
 * Default production hook: records invocation; on Effective Start/Return / Termination /
 * Transfer applies domain projectors. When `applyToCurrentProjection === false`,
 * Scheduled Transfer still reserves destination capacity; Cancel of Transfer releases it.
 */
export async function defaultProjectionRefreshHook(
  ctx: ProjectionRefreshContext,
): Promise<void> {
  ctx.invoked = { eventId: ctx.eventId, eventType: ctx.eventType };

  if (ctx.applyToCurrentProjection === false) {
    // Cancel of Scheduled Transfer → release reservation
    if (ctx.lifecycleOp === "cancel" && ctx.targetEventId) {
      const target = await getBusinessEventById(ctx.client, ctx.targetEventId);
      if (target && TRANSFER_EVENT_TYPES.has(target.eventType)) {
        await releaseTransferReservationOnCancel(ctx.client, ctx.targetEventId);
        ctx.transferApply = {
          employmentId: target.employmentId ?? "",
          endDateExclusive: target.effectiveDate,
          sourcePrimaryId: null,
          previousSourceEnd: null,
          destinationPrimaryId: null,
          didCloseSource: false,
          didOpenDest: false,
          didReleaseSource: false,
          didMoveDestCapacity: false,
          reservedOnly: true,
        };
      }
      return;
    }

    // Scheduled Transfer finalize → reserve only (no Primary mutation)
    if (TRANSFER_EVENT_TYPES.has(ctx.eventType)) {
      const result = await applyTransferScheduledReserve(ctx, getPersonDb());
      ctx.appliedEmploymentId = result.employmentId || undefined;
      ctx.transferApply = {
        employmentId: result.employmentId,
        endDateExclusive: result.endDateExclusive,
        sourcePrimaryId: null,
        previousSourceEnd: null,
        destinationPrimaryId: null,
        didCloseSource: false,
        didOpenDest: false,
        didReleaseSource: false,
        didMoveDestCapacity: false,
        reservedOnly: true,
      };
    }
    return;
  }

  // Reverse of Transfer → undo Primaries / capacity / reservation
  if (ctx.lifecycleOp === "reverse" && ctx.targetEventId) {
    const target = await getBusinessEventById(ctx.client, ctx.targetEventId);
    if (target && TRANSFER_EVENT_TYPES.has(target.eventType)) {
      await undoTransferApply(ctx.client, target, getPersonDb());
    }
    return;
  }

  if (TERMINATION_EVENT_TYPES.has(ctx.eventType)) {
    const result = await applyTerminationProjections(ctx, getPersonDb());
    ctx.appliedEmploymentId = result.employmentId;
    if (
      result.mutated ||
      result.releasedCapacity ||
      result.didCloseEmployment
    ) {
      ctx.terminationApply = {
        employmentId: result.employmentId,
        endDateExclusive: result.endDateExclusive,
        closedPrimaries: result.closedPrimaries,
        closedSecondaries: result.closedSecondaries,
        didRelease: result.releasedCapacity,
        didCloseEmployment: result.didCloseEmployment,
      };
    }
    return;
  }

  if (TRANSFER_EVENT_TYPES.has(ctx.eventType)) {
    const result = await applyTransferProjections(ctx, getPersonDb());
    ctx.appliedEmploymentId = result.employmentId;
    if (result.mutated || result.didMoveDestCapacity || result.didReleaseSource) {
      ctx.transferApply = {
        employmentId: result.employmentId,
        endDateExclusive: result.endDateExclusive,
        sourcePrimaryId: result.sourcePrimaryId,
        previousSourceEnd: result.previousSourceEnd,
        destinationPrimaryId: result.destinationPrimaryId,
        didCloseSource: result.didCloseSource,
        didOpenDest: result.didOpenDest,
        didReleaseSource: result.didReleaseSource,
        didMoveDestCapacity: result.didMoveDestCapacity,
        reservedOnly: false,
      };
    }
    return;
  }

  if (!START_RETURN_EVENT_TYPES.has(ctx.eventType)) {
    // Scaffold / job-comp — later stories or no-op
    return;
  }

  const result = await applyStartReturnProjections(ctx, getPersonDb());
  ctx.appliedEmploymentId = result.employmentId;
  if (result.created) {
    ctx.createdStartReturnPrimaryId = result.primaryId;
  }

  try {
    await bindEmploymentIdAfterApply(ctx.client, {
      draftId: ctx.draft?.id ?? null,
      eventId: ctx.eventId,
      employmentId: result.employmentId,
    });

    if (ctx.draft) {
      ctx.draft.employmentId = result.employmentId;
    }
  } catch (err) {
    if (result.created) {
      await compensateOrphanStartReturnProjections({
        employmentId: result.employmentId,
        primaryId: result.primaryId,
      });
      ctx.appliedEmploymentId = undefined;
      ctx.createdStartReturnPrimaryId = undefined;
    }
    throw err;
  }
}

/** Per-finalize capture — avoids cross-request leakage under concurrency. */
const hookAls = new AsyncLocalStorage<ProjectionRefreshHook>();

/** Test/selfcheck fallback only — prefer ALS / FinalizeDraftInput.projectionRefreshHook. */
let testHookFallback: ProjectionRefreshHook | null = null;

export function setProjectionRefreshHook(hook: ProjectionRefreshHook): void {
  testHookFallback = hook;
}

export function resetProjectionRefreshHook(): void {
  testHookFallback = null;
}

export function getProjectionRefreshHook(): ProjectionRefreshHook {
  return (
    hookAls.getStore() ?? testHookFallback ?? defaultProjectionRefreshHook
  );
}

export function runWithProjectionRefreshHook<T>(
  hook: ProjectionRefreshHook,
  fn: () => Promise<T>,
): Promise<T> {
  return hookAls.run(hook, fn);
}

export async function runProjectionRefreshHook(
  ctx: ProjectionRefreshContext,
): Promise<void> {
  const hook = getProjectionRefreshHook();
  await hook(ctx);
  // Ensure AD-6 signal even if a custom hook forgets to set ctx.invoked.
  if (!ctx.invoked) {
    ctx.invoked = { eventId: ctx.eventId, eventType: ctx.eventType };
  }
}

export { compensateTerminationApply, compensateTransferApply };
