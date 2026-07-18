/**
 * Cancel / Reverse / Correction writers (Story 4.3 / FR-16 / FR-17 / AD-6).
 * Append-only neutralization — originals are never UPDATE'd.
 */

import { randomUUID } from "node:crypto";

import {
  appendBusinessEvent,
  BusinessEventValidationError,
  lockBusinessEventForUpdate,
  listChainLinksForEvent,
  withTransaction,
  type BusinessEventRecord,
} from "@divan/event-store";
import { todayDateOnlyTehran } from "@divan/temporal-engine";
import type { Pool, PrismaClient } from "@divan/db";

import { getPersonDb } from "./db";
import {
  MSG_CANCEL_AFTER_EFFECT_FA,
  MSG_CANCEL_REASON_REQUIRED_FA,
  MSG_CANCEL_WRONG_STATE_FA,
  MSG_CORRECTION_CYCLE_FA,
  MSG_CORRECTION_REASON_REQUIRED_FA,
  MSG_CORRECTION_SELF_REF_FA,
  MSG_CORRECTION_WRONG_STATE_FA,
  MSG_EVENT_NOT_FOUND_FA,
  MSG_REVERSE_REASON_REQUIRED_FA,
  MSG_REVERSE_WRONG_STATE_FA,
  MSG_BROKEN_CORRECTION_REF_FA,
  PersonnelEventError,
} from "./errors";
import {
  detectCorrectionCycle,
  evaluationStatusAsOf,
  isPreEffectAsOf,
  resolveLifecycleStatus,
} from "./personnel-event-resolve";
import {
  getProjectionRefreshHook,
  runProjectionRefreshHook,
  runWithProjectionRefreshHook,
  type ProjectionRefreshContext,
  type ProjectionRefreshHook,
} from "./personnel-event-projection-hook";
import {
  assertActorHasPersonnelEventCancel,
  assertActorHasPersonnelEventCorrect,
  assertActorHasPersonnelEventReverse,
} from "./permissions";

export type LifecycleActorInput = {
  actorId: string;
  correlationId?: string;
  reason: string;
  idempotencyKey?: string;
  /** Override as-of for tests (Asia/Tehran date-only). */
  asOfDate?: string;
  projectionRefreshHook?: ProjectionRefreshHook;
};

export type LifecycleResult = {
  neutralizingEventId: string;
  targetEventId: string;
  resolvedStatus: "Cancelled" | "Reversed" | "Effective" | "Scheduled";
  projectionHookInvoked: boolean;
  idempotentReplay: boolean;
};

function requireReason(reason: string | undefined, messageFa: string): string {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) {
    throw new PersonnelEventError("REASON_REQUIRED", messageFa);
  }
  return trimmed;
}

function mapKernelError(err: unknown): never {
  if (err instanceof BusinessEventValidationError) {
    if (err.code === "sensitive_evidence_forbidden") {
      throw new PersonnelEventError(
        "SENSITIVE_PAYLOAD",
        "شواهد یا محموله نباید حاوی دادهٔ حساس باشد.",
        err.code,
      );
    }
    throw new PersonnelEventError(
      "VALIDATION",
      "اعتبارسنجی رویداد کسب‌وکار ناموفق بود.",
      err.code,
    );
  }
  throw err;
}

async function findExistingNeutralizer(
  client: Parameters<typeof listChainLinksForEvent>[0],
  targetId: string,
  kind: "cancel" | "reverse",
): Promise<BusinessEventRecord | null> {
  const links = await listChainLinksForEvent(client, targetId);
  const list = kind === "cancel" ? links.cancellations : links.reversals;
  return list[0] ?? null;
}

async function findExistingCorrection(
  client: Parameters<typeof listChainLinksForEvent>[0],
  targetId: string,
  idempotencyKey: string | undefined,
): Promise<BusinessEventRecord | null> {
  const links = await listChainLinksForEvent(client, targetId);
  if (!idempotencyKey?.trim()) {
    return links.corrections[0] ?? null;
  }
  const key = idempotencyKey.trim();
  return (
    links.corrections.find(
      (c) =>
        typeof c.payload.idempotencyKey === "string" &&
        c.payload.idempotencyKey === key,
    ) ?? null
  );
}

/**
 * Cancel a Scheduled (pre-effect) event.
 * Atomic Cancel↔effect race: lock target → re-evaluate as-of → one winner.
 */
export async function cancelPersonnelEvent(
  targetEventId: string,
  input: LifecycleActorInput,
  pool: Pool,
  db: PrismaClient = getPersonDb(),
): Promise<LifecycleResult> {
  await assertActorHasPersonnelEventCancel(input.actorId, db);
  const reason = requireReason(input.reason, MSG_CANCEL_REASON_REQUIRED_FA);
  const correlationId = input.correlationId?.trim() || randomUUID();
  const asOf = input.asOfDate?.trim() || todayDateOnlyTehran();
  const hook =
    input.projectionRefreshHook ?? getProjectionRefreshHook();

  return runWithProjectionRefreshHook(hook, () =>
    withTransaction(pool, async (client) => {
      const target = await lockBusinessEventForUpdate(client, targetEventId);
      if (!target) {
        throw new PersonnelEventError("EVENT_NOT_FOUND", MSG_EVENT_NOT_FOUND_FA);
      }

      const existing = await findExistingNeutralizer(
        client,
        target.id,
        "cancel",
      );
      if (existing) {
        return {
          neutralizingEventId: existing.id,
          targetEventId: target.id,
          resolvedStatus: "Cancelled" as const,
          projectionHookInvoked: false,
          idempotentReplay: true,
        };
      }

      const alreadyReversed = await findExistingNeutralizer(
        client,
        target.id,
        "reverse",
      );
      if (alreadyReversed) {
        throw new PersonnelEventError(
          "CANCEL_WRONG_STATE",
          MSG_CANCEL_WRONG_STATE_FA,
        );
      }

      // Effect already won (evaluation-by-date) → reject Cancel; guide to Reverse
      if (!isPreEffectAsOf(target, asOf)) {
        throw new PersonnelEventError(
          "CANCEL_AFTER_EFFECT",
          MSG_CANCEL_AFTER_EFFECT_FA,
        );
      }

      // Storage must be authoritative Scheduled (or Effective token that still
      // evaluates pre-effect — only Scheduled is Cancel-eligible per Gate).
      if (target.status !== "Scheduled") {
        throw new PersonnelEventError(
          "CANCEL_WRONG_STATE",
          MSG_CANCEL_WRONG_STATE_FA,
        );
      }

      let eventId: string;
      try {
        const appended = await appendBusinessEvent(client, {
          correlationId,
          eventType: "EventCancelled",
          personId: target.personId,
          employmentId: target.employmentId,
          effectiveDate: target.effectiveDate,
          registeredBy: input.actorId,
          status: "Cancelled",
          reason,
          cancelsEventId: target.id,
          finalizedBy: input.actorId,
          finalizedAt: new Date(),
          payload: {
            targetEventId: target.id,
            targetEventType: target.eventType,
            ...(input.idempotencyKey?.trim()
              ? { idempotencyKey: input.idempotencyKey.trim() }
              : {}),
          },
          provenance: {
            source: "personnel_event_cancel",
            asOfDate: asOf,
          },
          scope: { source: "personnel_event_cancel" },
        });
        eventId = appended.id;
      } catch (err) {
        mapKernelError(err);
      }

      const hookCtx: ProjectionRefreshContext = {
        client,
        eventId: eventId!,
        eventType: "EventCancelled",
        lifecycleOp: "cancel",
        targetEventId: target.id,
        // Cancel of Scheduled: no current-projection side effect
        applyToCurrentProjection: false,
      };
      await runProjectionRefreshHook(hookCtx);

      return {
        neutralizingEventId: eventId!,
        targetEventId: target.id,
        resolvedStatus: "Cancelled" as const,
        projectionHookInvoked: Boolean(hookCtx.invoked),
        idempotentReplay: false,
      };
    }),
  );
}

/**
 * Reverse an Effective (post-effect) event.
 */
export async function reversePersonnelEvent(
  targetEventId: string,
  input: LifecycleActorInput,
  pool: Pool,
  db: PrismaClient = getPersonDb(),
): Promise<LifecycleResult> {
  await assertActorHasPersonnelEventReverse(input.actorId, db);
  const reason = requireReason(input.reason, MSG_REVERSE_REASON_REQUIRED_FA);
  const correlationId = input.correlationId?.trim() || randomUUID();
  const asOf = input.asOfDate?.trim() || todayDateOnlyTehran();
  const hook =
    input.projectionRefreshHook ?? getProjectionRefreshHook();

  return runWithProjectionRefreshHook(hook, () =>
    withTransaction(pool, async (client) => {
      const target = await lockBusinessEventForUpdate(client, targetEventId);
      if (!target) {
        throw new PersonnelEventError("EVENT_NOT_FOUND", MSG_EVENT_NOT_FOUND_FA);
      }

      const existing = await findExistingNeutralizer(
        client,
        target.id,
        "reverse",
      );
      if (existing) {
        return {
          neutralizingEventId: existing.id,
          targetEventId: target.id,
          resolvedStatus: "Reversed" as const,
          projectionHookInvoked: false,
          idempotentReplay: true,
        };
      }

      const alreadyCancelled = await findExistingNeutralizer(
        client,
        target.id,
        "cancel",
      );
      if (alreadyCancelled) {
        throw new PersonnelEventError(
          "REVERSE_WRONG_STATE",
          MSG_REVERSE_WRONG_STATE_FA,
        );
      }

      const evalStatus = evaluationStatusAsOf(target, asOf);
      if (evalStatus !== "Effective") {
        throw new PersonnelEventError(
          "REVERSE_WRONG_STATE",
          MSG_REVERSE_WRONG_STATE_FA,
        );
      }

      let eventId: string;
      try {
        const appended = await appendBusinessEvent(client, {
          correlationId,
          eventType: "EventReversed",
          personId: target.personId,
          employmentId: target.employmentId,
          effectiveDate: target.effectiveDate,
          registeredBy: input.actorId,
          status: "Reversed",
          reason,
          reversesEventId: target.id,
          finalizedBy: input.actorId,
          finalizedAt: new Date(),
          payload: {
            targetEventId: target.id,
            targetEventType: target.eventType,
            ...(input.idempotencyKey?.trim()
              ? { idempotencyKey: input.idempotencyKey.trim() }
              : {}),
          },
          provenance: {
            source: "personnel_event_reverse",
            asOfDate: asOf,
          },
          scope: { source: "personnel_event_reverse" },
        });
        eventId = appended.id;
      } catch (err) {
        mapKernelError(err);
      }

      const hookCtx: ProjectionRefreshContext = {
        client,
        eventId: eventId!,
        eventType: "EventReversed",
        lifecycleOp: "reverse",
        targetEventId: target.id,
        // Compensating reverse of Effective — hook invoked; domain stub until 4.5+
        applyToCurrentProjection: true,
      };
      await runProjectionRefreshHook(hookCtx);

      return {
        neutralizingEventId: eventId!,
        targetEventId: target.id,
        resolvedStatus: "Reversed" as const,
        projectionHookInvoked: Boolean(hookCtx.invoked),
        idempotentReplay: false,
      };
    }),
  );
}

export type CorrectPersonnelEventInput = LifecycleActorInput & {
  /** Optional replacement payload (structural refs only). */
  correctionPayload?: Record<string, unknown>;
  /** Optional supersedes link (replacement event id already known — rare). */
  supersedesEventId?: string | null;
  /**
   * Prospective id for cycle check when the correcting row is not yet inserted.
   * Defaults to a fresh UUID (self-ref / cycle walk uses this as fromId).
   */
  prospectiveEventId?: string;
};

/**
 * Correction: append EventCorrected linking corrects_event_id → target.
 * Originals preserved; self-ref / cycles blocked.
 */
export async function correctPersonnelEvent(
  targetEventId: string,
  input: CorrectPersonnelEventInput,
  pool: Pool,
  db: PrismaClient = getPersonDb(),
): Promise<LifecycleResult> {
  await assertActorHasPersonnelEventCorrect(input.actorId, db);
  const reason = requireReason(
    input.reason,
    MSG_CORRECTION_REASON_REQUIRED_FA,
  );
  const correlationId = input.correlationId?.trim() || randomUUID();
  const asOf = input.asOfDate?.trim() || todayDateOnlyTehran();
  const hook =
    input.projectionRefreshHook ?? getProjectionRefreshHook();
  const prospectiveId = input.prospectiveEventId?.trim() || randomUUID();

  return runWithProjectionRefreshHook(hook, () =>
    withTransaction(pool, async (client) => {
      const target = await lockBusinessEventForUpdate(client, targetEventId);
      if (!target) {
        throw new PersonnelEventError("EVENT_NOT_FOUND", MSG_EVENT_NOT_FOUND_FA);
      }

      const existing = await findExistingCorrection(
        client,
        target.id,
        input.idempotencyKey,
      );
      // Cardinality 1: any existing correction replays (with or without key).
      if (existing) {
        const links = await listChainLinksForEvent(client, target.id);
        return {
          neutralizingEventId: existing.id,
          targetEventId: target.id,
          resolvedStatus: resolveLifecycleStatus(target, links, asOf) as
            | "Cancelled"
            | "Reversed"
            | "Effective"
            | "Scheduled",
          projectionHookInvoked: false,
          idempotentReplay: true,
        };
      }

      // Target must be authoritative (Scheduled or Effective), not Draft /
      // already a pure neutralization row without domain substance.
      const priorLinks = await listChainLinksForEvent(client, target.id);
      if (
        priorLinks.cancellations.length > 0 ||
        priorLinks.reversals.length > 0
      ) {
        throw new PersonnelEventError(
          "CORRECTION_WRONG_STATE",
          MSG_CORRECTION_WRONG_STATE_FA,
        );
      }
      const evalStatus = evaluationStatusAsOf(target, asOf);
      if (
        target.status === "Draft" ||
        target.eventType === "EventCancelled" ||
        target.eventType === "EventReversed"
      ) {
        throw new PersonnelEventError(
          "CORRECTION_WRONG_STATE",
          MSG_CORRECTION_WRONG_STATE_FA,
        );
      }
      if (evalStatus !== "Scheduled" && evalStatus !== "Effective") {
        throw new PersonnelEventError(
          "CORRECTION_WRONG_STATE",
          MSG_CORRECTION_WRONG_STATE_FA,
        );
      }

      if (prospectiveId === target.id) {
        throw new PersonnelEventError(
          "CORRECTION_SELF_REF",
          MSG_CORRECTION_SELF_REF_FA,
        );
      }

      const cycleProblem = await detectCorrectionCycle(
        client,
        prospectiveId,
        target.id,
      );
      if (cycleProblem === "self_ref") {
        throw new PersonnelEventError(
          "CORRECTION_SELF_REF",
          MSG_CORRECTION_SELF_REF_FA,
        );
      }
      if (cycleProblem === "cycle") {
        throw new PersonnelEventError(
          "CORRECTION_CYCLE",
          MSG_CORRECTION_CYCLE_FA,
        );
      }
      if (cycleProblem === "missing_target") {
        throw new PersonnelEventError(
          "BROKEN_CORRECTION_REF",
          MSG_BROKEN_CORRECTION_REF_FA,
        );
      }

      const corrPayload = { ...(input.correctionPayload ?? {}) };
      delete corrPayload.targetEventId;
      delete corrPayload.targetEventType;
      delete corrPayload.idempotencyKey;
      let eventId: string;
      try {
        const appended = await appendBusinessEvent(client, {
          correlationId,
          eventType: "EventCorrected",
          personId: target.personId,
          employmentId: target.employmentId,
          effectiveDate: target.effectiveDate,
          registeredBy: input.actorId,
          // Correction replacement row is authoritative at same evaluation status
          status: evalStatus === "Scheduled" ? "Scheduled" : "Effective",
          reason,
          correctsEventId: target.id,
          supersedesEventId: input.supersedesEventId ?? null,
          finalizedBy: input.actorId,
          finalizedAt: new Date(),
          payload: {
            ...corrPayload,
            targetEventId: target.id,
            targetEventType: target.eventType,
            ...(input.idempotencyKey?.trim()
              ? { idempotencyKey: input.idempotencyKey.trim() }
              : {}),
          },
          provenance: {
            source: "personnel_event_correct",
            asOfDate: asOf,
          },
          scope: { source: "personnel_event_correct" },
        });
        eventId = appended.id;
      } catch (err) {
        mapKernelError(err);
      }

      const hookCtx: ProjectionRefreshContext = {
        client,
        eventId: eventId!,
        eventType: "EventCorrected",
        lifecycleOp: "correct",
        targetEventId: target.id,
        applyToCurrentProjection: evalStatus === "Effective",
      };
      await runProjectionRefreshHook(hookCtx);

      return {
        neutralizingEventId: eventId!,
        targetEventId: target.id,
        resolvedStatus: evalStatus as "Effective" | "Scheduled",
        projectionHookInvoked: Boolean(hookCtx.invoked),
        idempotentReplay: false,
      };
    }),
  );
}
