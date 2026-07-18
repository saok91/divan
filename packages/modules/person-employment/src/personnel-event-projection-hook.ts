/**
 * AD-6 projection refresh hook — runs inside the same DB txn as finalize / lifecycle append.
 * Scaffold event types may no-op domain projectors but the seam must be invoked.
 *
 * FR-16: Scheduled events must not mutate current projections (applyToCurrentProjection=false).
 * Domain Employment/Reservation effects remain stubs until Stories 4.5–4.8 / 4.14.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { PoolClient } from "@divan/db";

import type { PersonnelEventDraftRecord } from "./personnel-event-draft";

export type ProjectionRefreshContext = {
  client: PoolClient;
  /** Present for Draft finalize; absent for Cancel/Reverse/Correction. */
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
};

export type ProjectionRefreshHook = (
  ctx: ProjectionRefreshContext,
) => Promise<void>;

/**
 * Default scaffold hook: records invocation on ctx for AD-6 selfcheck proof.
 * Production domain effects = Stories 4.5–4.8.
 * When `applyToCurrentProjection === false`, still records invocation but
 * performs no current-state mutation (FR-16 Scheduled discipline).
 */
export async function defaultProjectionRefreshHook(
  ctx: ProjectionRefreshContext,
): Promise<void> {
  ctx.invoked = { eventId: ctx.eventId, eventType: ctx.eventType };
  void ctx.client;
  void ctx.draft;
  void ctx.lifecycleOp;
  void ctx.targetEventId;
  // Explicit no-op for Scheduled / Cancel-of-Scheduled — domain stubs later.
  if (ctx.applyToCurrentProjection === false) {
    return;
  }
  // Effective reverse/correct/finalize: domain projectors still absent (stub).
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
