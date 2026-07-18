/**
 * AD-6 projection refresh hook — runs inside the same DB txn as finalize append.
 * Scaffold event types may no-op domain projectors but the seam must be invoked.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { PoolClient } from "@divan/db";

import type { PersonnelEventDraftRecord } from "./personnel-event-draft";

export type ProjectionRefreshContext = {
  client: PoolClient;
  draft: PersonnelEventDraftRecord;
  eventId: string;
  eventType: string;
  /** Set by hook implementations / tests to prove invocation. */
  invoked?: { eventId: string; eventType: string };
};

export type ProjectionRefreshHook = (
  ctx: ProjectionRefreshContext,
) => Promise<void>;

/**
 * Default scaffold hook: records invocation on ctx for AD-6 selfcheck proof.
 * Production domain effects = Stories 4.5–4.8.
 */
export async function defaultProjectionRefreshHook(
  ctx: ProjectionRefreshContext,
): Promise<void> {
  ctx.invoked = { eventId: ctx.eventId, eventType: ctx.eventType };
  void ctx.client;
  void ctx.draft;
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
