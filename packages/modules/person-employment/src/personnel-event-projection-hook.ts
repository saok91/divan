/**
 * AD-6 projection refresh hook — runs inside the same DB txn as finalize / lifecycle append.
 *
 * FR-16: Scheduled events must not mutate current projections (applyToCurrentProjection=false).
 * Story 4.5: Effective Start/Return → Employment + Primary projectors (+ capacity consume).
 * Story 4.6: Effective Termination → close Assignments + Employment + capacity release.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { PoolClient } from "@divan/db";

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
   * effects (Scheduled finalize / Cancel of Scheduled).
   */
  applyToCurrentProjection?: boolean;
  /** Set by hook implementations / tests to prove invocation. */
  invoked?: { eventId: string; eventType: string };
  /** Filled when Start/Return/Termination touched an Employment. */
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
};

export type ProjectionRefreshHook = (
  ctx: ProjectionRefreshContext,
) => Promise<void>;

/**
 * Default production hook: records invocation; on Effective Start/Return / Termination
 * applies domain projectors. When `applyToCurrentProjection === false`, still records
 * invocation but performs no current-state mutation (FR-16 Scheduled discipline).
 */
export async function defaultProjectionRefreshHook(
  ctx: ProjectionRefreshContext,
): Promise<void> {
  ctx.invoked = { eventId: ctx.eventId, eventType: ctx.eventType };
  void ctx.lifecycleOp;
  void ctx.targetEventId;

  if (ctx.applyToCurrentProjection === false) {
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

  if (!START_RETURN_EVENT_TYPES.has(ctx.eventType)) {
    // Transfer / job-comp / scaffold — later stories or no-op
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

export { compensateTerminationApply };
