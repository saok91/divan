/**
 * Finalize Draft → authoritative business event (Story 4.2 / FR-15 / FR-19 / AD-6).
 * All critical steps run inside one withTransaction (append + draft mark + projection hook).
 */

import { randomUUID } from "node:crypto";

import {
  appendBusinessEvent,
  appendAccessEvent,
  BusinessEventValidationError,
  withTransaction,
  type BusinessEventStatus,
} from "@divan/event-store";
import { todayDateOnlyTehran } from "@divan/temporal-engine";
import type { Pool, PoolClient, PrismaClient } from "@divan/db";

import { getPersonDb } from "./db";
import {
  MSG_DRAFT_ALREADY_FINALIZED_FA,
  MSG_DRAFT_DELETED_FA,
  MSG_DRAFT_NOT_FOUND_FA,
  MSG_DRAFT_VERSION_CONFLICT_FA,
  MSG_FINALIZE_BLOCKED_FA,
  MSG_FINALIZE_IDEMPOTENCY_CONFLICT_FA,
  MSG_FINALIZE_OVERRIDE_REQUIRED_FA,
  MSG_FINALIZE_STALE_SNAPSHOT_FA,
  MSG_FINALIZE_WARNING_ACK_REQUIRED_FA,
  MSG_FINALIZE_LIFECYCLE_CHAIN_FORBIDDEN_FA,
  MSG_RISK_TIER_PENDING_REVIEW_FA,
  PersonnelEventError,
} from "./errors";
import {
  assertSnapshotFresh,
  buildEvaluationSnapshot,
  classifyConflicts,
  codesRequiringOverride,
  dateOnlyFromDb,
  hasBlockingConflicts,
  warningCodesRequiringAck,
  type ConflictFinding,
  type ConflictPolicy,
  type EvaluationSnapshot,
} from "./personnel-event-conflicts";
import type {
  DraftStatus,
  PersonnelEventDraftRecord,
} from "./personnel-event-draft";
import {
  getProjectionRefreshHook,
  runProjectionRefreshHook,
  runWithProjectionRefreshHook,
  type ProjectionRefreshContext,
  type ProjectionRefreshHook,
} from "./personnel-event-projection-hook";
import {
  enqueueRecalculationAfterCommit,
  isPastDatedEffective,
  scheduleHeavyRecalculation,
  type RecalcJobPayload,
} from "./personnel-event-recalc";
import { compensateOrphanStartReturnProjections } from "./personnel-event-start-return";
import { compensateTerminationApply } from "./personnel-event-termination";
import { compensateTransferApply } from "./personnel-event-transfer";

export type RiskTierKind =
  | "termination"
  | "compensation_change"
  | "retro_beyond_window"
  | "high_impact_override"
  | "production_bulk_import";

export type RiskTierConfig = {
  /**
   * Map of risk tier → whether pre-authorization is required.
   * When a tier applies and pre-auth is missing → pending_review (no append).
   * When config absent for a type → documented non-authoritative pending_review.
   */
  tiers?: Partial<Record<RiskTierKind, { requiresPreAuth: boolean }>>;
  /** Explicit pre-auth tokens supplied by caller (e.g. grant ids). */
  preAuthTokens?: string[];
};

/**
 * Minimal product authorize config for Termination finalize (Story 4.6).
 * Full AR-ACCESS termination matrix remains open — do not invent toxic combos.
 * Actors still need `personnel_event.finalize`; omit this → pending_review.
 */
export const TERMINATION_PRODUCT_RISK_TIERS: RiskTierConfig = {
  tiers: {
    termination: { requiresPreAuth: false },
  },
};

export type FinalizeAcknowledgement = {
  warningCodes: string[];
  acknowledgedAt?: string;
};

export type FinalizeOverride = {
  reason: string;
  /** HR Admin (or configured) actor — must match finalize actor for 4.2 stub. */
  approvedByAccountId: string;
};

export type FinalizeDraftInput = {
  draftId: string;
  actorId: string;
  correlationId?: string;
  acknowledgement?: FinalizeAcknowledgement;
  override?: FinalizeOverride;
  idempotencyKey?: string;
  /** Client snapshot from pre-check — rejected if stale vs live rebuild. */
  clientSnapshot?: EvaluationSnapshot;
  /** Optimistic concurrency — reject if draft.version differs. */
  expectedVersion?: number;
  conflictPolicy?: ConflictPolicy;
  riskTier?: RiskTierConfig;
  /** Permission fingerprint for evaluation snapshot attribution. */
  permissionSetFingerprint?: string;
  /**
   * Actor holds Override capability — MUST be derived server-side from session
   * (never trust a client-supplied boolean).
   */
  actorMayOverride?: boolean;
  /** Optional per-call AD-6 hook (preferred over process-global test setter). */
  projectionRefreshHook?: ProjectionRefreshHook;
};

export type FinalizeDraftResult =
  | {
      outcome: "finalized";
      draft: PersonnelEventDraftRecord;
      eventId: string;
      status: BusinessEventStatus;
      conflicts: ConflictFinding[];
      snapshot: EvaluationSnapshot;
      projectionHookInvoked: boolean;
      /** Set when past-dated Effective triggered heavy historical recalc. */
      recalcScheduled?: RecalcJobPayload | null;
    }
  | {
      outcome: "pending_review";
      draft: PersonnelEventDraftRecord;
      reason: "risk_tier" | "pre_auth_missing";
      messageFa: string;
      conflicts: ConflictFinding[];
      snapshot: EvaluationSnapshot;
    }
  | {
      outcome: "rejected";
      draft: PersonnelEventDraftRecord;
      conflicts: ConflictFinding[];
      snapshot: EvaluationSnapshot;
      messageFa: string;
      code: PersonnelEventError["code"];
    };

type DraftRow = {
  id: string;
  personId: string;
  employmentId: string | null;
  eventType: string;
  effectiveDate: Date;
  payload: unknown;
  status: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  finalizedEventId: string | null;
  idempotencyKey: string | null;
  warningAcks: unknown;
  overrideEvidence: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function asPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapDraftRow(row: DraftRow): PersonnelEventDraftRecord {
  return {
    id: row.id,
    personId: row.personId,
    employmentId: row.employmentId,
    eventType: row.eventType,
    effectiveDate: dateOnlyFromDb(row.effectiveDate),
    payload: asPayload(row.payload),
    status: row.status as DraftStatus,
    version: row.version,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    finalizedEventId: row.finalizedEventId,
    idempotencyKey: row.idempotencyKey,
    warningAcks: row.warningAcks,
    overrideEvidence: row.overrideEvidence,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapKernelError(err: unknown): never {
  if (err instanceof BusinessEventValidationError) {
    if (err.code === "sensitive_evidence_forbidden") {
      throw new PersonnelEventError(
        "SENSITIVE_PAYLOAD",
        "پیش‌نویس یا شواهد نباید حاوی دادهٔ حساس باشد.",
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

/** Infer risk tier from event type / payload flags — stub, not AR-ACCESS matrix. */
export function inferRiskTiers(
  draft: PersonnelEventDraftRecord,
  snapshot: EvaluationSnapshot,
): RiskTierKind[] {
  const tiers: RiskTierKind[] = [];
  const t = draft.eventType;
  if (
    t === "EmploymentTerminated" ||
    t === "TerminationRecorded" ||
    draft.payload.riskTier === "termination"
  ) {
    tiers.push("termination");
  }
  if (
    t === "CompensationChanged" ||
    t === "ContractChanged" ||
    draft.payload.riskTier === "compensation_change"
  ) {
    tiers.push("compensation_change");
  }
  if (
    draft.payload.productionBulkImport === true ||
    draft.payload.riskTier === "production_bulk_import"
  ) {
    tiers.push("production_bulk_import");
  }
  if (draft.payload.highImpactOverride === true) {
    tiers.push("high_impact_override");
  }
  // Retro beyond window — if Effective Date is older than asOf by > configured days
  // Without config, treat payload flag only (do not invent day threshold).
  if (draft.payload.retroBeyondWindow === true) {
    tiers.push("retro_beyond_window");
  } else if (
    draft.effectiveDate < snapshot.asOfDate &&
    draft.payload.treatAsRetroRisk === true
  ) {
    tiers.push("retro_beyond_window");
  }
  return tiers;
}

/**
 * When tier applies and pre-auth missing → pending_review (non-authoritative).
 * When tier config absent for inferred kinds → also pending_review (documented).
 */
export function evaluateRiskTiers(
  inferred: RiskTierKind[],
  config: RiskTierConfig | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (inferred.length === 0) return { ok: true };
  const preAuth = new Set(config?.preAuthTokens ?? []);
  for (const kind of inferred) {
    const tierCfg = config?.tiers?.[kind];
    if (!tierCfg) {
      // Config absent → non-authoritative pending review (do not invent thresholds)
      return { ok: false, reason: `tier_unconfigured:${kind}` };
    }
    if (tierCfg.requiresPreAuth) {
      const token = `risk:${kind}`;
      if (!preAuth.has(token) && !preAuth.has(kind)) {
        return { ok: false, reason: `pre_auth_missing:${kind}` };
      }
    }
  }
  return { ok: true };
}

function resolveAuthoritativeStatus(
  effectiveDate: string,
  asOfDate: string,
): BusinessEventStatus {
  return effectiveDate > asOfDate ? "Scheduled" : "Effective";
}

async function lockDraftRow(
  client: PoolClient,
  draftId: string,
): Promise<DraftRow | null> {
  const result = await client.query<DraftRow>(
    `SELECT * FROM "PersonnelEventDraft" WHERE id = $1 FOR UPDATE`,
    [draftId],
  );
  return result.rows[0] ?? null;
}

/**
 * Finalize a Draft inside one DB transaction (AD-6).
 * `pool` must be the same PostgreSQL database as Prisma Draft store.
 */
export async function finalizeDraft(
  input: FinalizeDraftInput,
  pool: Pool,
  db: PrismaClient = getPersonDb(),
): Promise<FinalizeDraftResult> {
  const correlationId = input.correlationId?.trim() || randomUUID();
  const hook =
    input.projectionRefreshHook ?? getProjectionRefreshHook();

  let pendingRecalc: RecalcJobPayload | null = null;

  const result = await runWithProjectionRefreshHook(hook, () =>
    withTransaction(pool, async (client) => {
    const row = await lockDraftRow(client, input.draftId);
    if (!row) {
      throw new PersonnelEventError("DRAFT_NOT_FOUND", MSG_DRAFT_NOT_FOUND_FA);
    }
    let draft = mapDraftRow(row);

    // Idempotent retry: already finalized → return same event id + stored status
    if (draft.status === "finalized") {
      if (!draft.finalizedEventId) {
        throw new PersonnelEventError(
          "VALIDATION",
          "پیش‌نویس نهایی‌شده بدون شناسه رویداد است؛ وضعیت ناقص است.",
          "finalized_without_event_id",
        );
      }
      if (
        input.idempotencyKey &&
        draft.idempotencyKey &&
        input.idempotencyKey !== draft.idempotencyKey
      ) {
        throw new PersonnelEventError(
          "FINALIZE_IDEMPOTENCY_CONFLICT",
          MSG_FINALIZE_IDEMPOTENCY_CONFLICT_FA,
        );
      }
      const stored = await client.query<{ status: string }>(
        `SELECT status FROM kernel_events WHERE id = $1::uuid`,
        [draft.finalizedEventId],
      );
      const storedStatus = stored.rows[0]?.status;
      const status: BusinessEventStatus =
        storedStatus === "Scheduled" || storedStatus === "Effective"
          ? storedStatus
          : resolveAuthoritativeStatus(
              draft.effectiveDate,
              todayDateOnlyTehran(),
            );
      const snapshot = await buildEvaluationSnapshot(
        {
          draft,
          actorAccountId: input.actorId,
          correlationId,
          permissionSetFingerprint: input.permissionSetFingerprint,
        },
        db,
        { client },
      );
      return {
        outcome: "finalized" as const,
        draft,
        eventId: draft.finalizedEventId,
        status,
        conflicts: [],
        snapshot,
        projectionHookInvoked: false,
      };
    }

    if (draft.status === "deleted") {
      throw new PersonnelEventError("DRAFT_DELETED", MSG_DRAFT_DELETED_FA);
    }

    if (draft.status !== "open" && draft.status !== "pending_review") {
      throw new PersonnelEventError(
        "DRAFT_ALREADY_FINALIZED",
        MSG_DRAFT_ALREADY_FINALIZED_FA,
      );
    }

    if (
      input.expectedVersion !== undefined &&
      draft.version !== input.expectedVersion
    ) {
      throw new PersonnelEventError(
        "DRAFT_VERSION_CONFLICT",
        MSG_DRAFT_VERSION_CONFLICT_FA,
      );
    }

    // Bind idempotency key on first finalize attempt
    if (input.idempotencyKey?.trim()) {
      const key = input.idempotencyKey.trim();
      if (draft.idempotencyKey && draft.idempotencyKey !== key) {
        throw new PersonnelEventError(
          "FINALIZE_IDEMPOTENCY_CONFLICT",
          MSG_FINALIZE_IDEMPOTENCY_CONFLICT_FA,
        );
      }
      // Check unique collision with another draft
      const clash = await client.query<{ id: string }>(
        `SELECT id FROM "PersonnelEventDraft"
         WHERE "idempotencyKey" = $1 AND id <> $2`,
        [key, draft.id],
      );
      if (clash.rows.length > 0) {
        throw new PersonnelEventError(
          "FINALIZE_IDEMPOTENCY_CONFLICT",
          MSG_FINALIZE_IDEMPOTENCY_CONFLICT_FA,
        );
      }
    }

    const liveSnapshot = await buildEvaluationSnapshot(
      {
        draft,
        actorAccountId: input.actorId,
        correlationId,
        permissionSetFingerprint: input.permissionSetFingerprint,
      },
      db,
      { client },
    );

    if (input.clientSnapshot) {
      const stale = assertSnapshotFresh(input.clientSnapshot, liveSnapshot);
      if (stale) {
        return {
          outcome: "rejected" as const,
          draft,
          conflicts: [stale],
          snapshot: liveSnapshot,
          messageFa: MSG_FINALIZE_STALE_SNAPSHOT_FA,
          code: "FINALIZE_STALE_SNAPSHOT",
        };
      }
    }

    const conflicts = await classifyConflicts(
      draft,
      liveSnapshot,
      input.conflictPolicy ?? {},
      db,
      { client },
    );

    if (hasBlockingConflicts(conflicts)) {
      return {
        outcome: "rejected" as const,
        draft,
        conflicts,
        snapshot: liveSnapshot,
        messageFa: MSG_FINALIZE_BLOCKED_FA,
        code: "FINALIZE_BLOCKED",
      };
    }

    const needAck = warningCodesRequiringAck(conflicts);
    if (needAck.length > 0) {
      const acked = new Set(input.acknowledgement?.warningCodes ?? []);
      const missing = needAck.filter((c) => !acked.has(c));
      if (missing.length > 0) {
        return {
          outcome: "rejected" as const,
          draft,
          conflicts,
          snapshot: liveSnapshot,
          messageFa: MSG_FINALIZE_WARNING_ACK_REQUIRED_FA,
          code: "FINALIZE_WARNING_ACK_REQUIRED",
        };
      }
    }

    const needOverride = codesRequiringOverride(conflicts);
    if (needOverride.length > 0) {
      if (!input.actorMayOverride) {
        return {
          outcome: "rejected" as const,
          draft,
          conflicts,
          snapshot: liveSnapshot,
          messageFa: MSG_FINALIZE_OVERRIDE_REQUIRED_FA,
          code: "FINALIZE_OVERRIDE_REQUIRED",
        };
      }
      const reason = input.override?.reason?.trim() ?? "";
      if (!reason || input.override?.approvedByAccountId !== input.actorId) {
        return {
          outcome: "rejected" as const,
          draft,
          conflicts,
          snapshot: liveSnapshot,
          messageFa: MSG_FINALIZE_OVERRIDE_REQUIRED_FA,
          code: "FINALIZE_OVERRIDE_REQUIRED",
        };
      }
    }

    // Risk tiers — leave non-authoritative when configured/unconfigured requires review
    const inferred = inferRiskTiers(draft, liveSnapshot);
    const risk = evaluateRiskTiers(inferred, input.riskTier);
    if (!risk.ok) {
      await client.query(
        `UPDATE "PersonnelEventDraft"
         SET status = 'pending_review',
             "updatedBy" = $2,
             "updatedAt" = CURRENT_TIMESTAMP,
             version = version + 1
         WHERE id = $1`,
        [draft.id, input.actorId],
      );
      const refreshed = await lockDraftRow(client, draft.id);
      draft = mapDraftRow(refreshed!);
      const reason = risk.reason.startsWith("pre_auth_missing")
        ? ("pre_auth_missing" as const)
        : ("risk_tier" as const);
      return {
        outcome: "pending_review" as const,
        draft,
        reason,
        messageFa: MSG_RISK_TIER_PENDING_REVIEW_FA,
        conflicts,
        snapshot: liveSnapshot,
      };
    }

    const finalizedAt = new Date();
    const status = resolveAuthoritativeStatus(
      draft.effectiveDate,
      liveSnapshot.asOfDate,
    );

    let eventId: string;
    try {
      const correctsEventId =
        typeof draft.payload.correctsEventId === "string"
          ? draft.payload.correctsEventId
          : null;
      // Cancel / Reverse must go through lifecycle writers — never finalize.
      if (
        (typeof draft.payload.cancelsEventId === "string" &&
          draft.payload.cancelsEventId.trim()) ||
        (typeof draft.payload.reversesEventId === "string" &&
          draft.payload.reversesEventId.trim())
      ) {
        throw new PersonnelEventError(
          "FINALIZE_BLOCKED",
          MSG_FINALIZE_LIFECYCLE_CHAIN_FORBIDDEN_FA,
        );
      }
      const supersedesEventId =
        typeof draft.payload.supersedesEventId === "string"
          ? draft.payload.supersedesEventId
          : null;

      const appended = await appendBusinessEvent(client, {
        correlationId,
        eventType: draft.eventType,
        personId: draft.personId,
        employmentId: draft.employmentId,
        effectiveDate: draft.effectiveDate,
        registeredBy: draft.createdBy,
        registeredAt: draft.createdAt,
        status,
        finalizedBy: input.actorId,
        finalizedAt,
        correctsEventId,
        cancelsEventId: null,
        reversesEventId: null,
        supersedesEventId,
        payload: {
          ...draft.payload,
          draftId: draft.id,
        },
        provenance: {
          draftId: draft.id,
          evaluationAsOf: liveSnapshot.asOfDate,
          permissionSetFingerprint: liveSnapshot.permissionSetFingerprint,
        },
        afterEvidence: {
          draftVersion: draft.version,
          personUpdatedAt: liveSnapshot.person.updatedAt,
        },
        scope: {
          source: "personnel_event_finalize",
        },
      });
      eventId = appended.id;
    } catch (err) {
      mapKernelError(err);
    }

    const warningAcksJson =
      needAck.length > 0
        ? JSON.stringify({
            codes: needAck,
            acknowledgedAt:
              input.acknowledgement?.acknowledgedAt ??
              finalizedAt.toISOString(),
            actorId: input.actorId,
          })
        : null;
    const overrideJson =
      needOverride.length > 0 && input.override
        ? JSON.stringify({
            codes: needOverride,
            reason: input.override.reason,
            approvedByAccountId: input.override.approvedByAccountId,
            at: finalizedAt.toISOString(),
          })
        : null;

    const idemKey = input.idempotencyKey?.trim() || draft.idempotencyKey;

    let mark;
    try {
      mark = await client.query(
        `UPDATE "PersonnelEventDraft"
         SET status = 'finalized',
             "finalizedEventId" = $2,
             "idempotencyKey" = COALESCE($3, "idempotencyKey"),
             "warningAcks" = COALESCE($4::jsonb, "warningAcks"),
             "overrideEvidence" = COALESCE($5::jsonb, "overrideEvidence"),
             "updatedBy" = $6,
             "updatedAt" = CURRENT_TIMESTAMP,
             version = version + 1
         WHERE id = $1 AND status IN ('open', 'pending_review')`,
        [
          draft.id,
          eventId!,
          idemKey,
          warningAcksJson,
          overrideJson,
          input.actorId,
        ],
      );
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code === "23505") {
        throw new PersonnelEventError(
          "FINALIZE_IDEMPOTENCY_CONFLICT",
          MSG_FINALIZE_IDEMPOTENCY_CONFLICT_FA,
        );
      }
      throw err;
    }

    if (mark.rowCount === 0) {
      // Should not happen under FOR UPDATE — treat as conflict
      throw new PersonnelEventError(
        "DRAFT_VERSION_CONFLICT",
        MSG_DRAFT_VERSION_CONFLICT_FA,
      );
    }

    const hookCtx: ProjectionRefreshContext = {
      client,
      draft,
      eventId: eventId!,
      eventType: draft.eventType,
      // FR-16: Scheduled must not alter current projections
      applyToCurrentProjection: status === "Effective",
    };
    await runProjectionRefreshHook(hookCtx);

    try {
      // Override + ack → access-event audit evidence (pre-Baseline / capacity)
      if (needOverride.length > 0 && input.override) {
        const wantsCapacity = needOverride.includes(
          "HEADCOUNT_CAPACITY_MISSING",
        );
        const wantsBaseline = needOverride.includes(
          "PRE_BASELINE_EFFECTIVE_DATE",
        );
        if (wantsCapacity) {
          await appendAccessEvent(client, {
            correlationId,
            actorAccountId: input.actorId,
            operation: "personnel_event.headcount_capacity_override",
            scope: {
              draftId: draft.id,
              personId: draft.personId,
              overrideCodes: needOverride,
              warningCodes: needAck,
              effectiveDate: draft.effectiveDate,
            },
            result: "allow",
            reason: input.override.reason,
            entityType: "PersonnelEventDraft",
            entityId: draft.id,
            payload: {
              baselineOverride: wantsBaseline,
              capacityOverride: true,
              acknowledgedWarningCodes: needAck,
            },
          });
        }
        if (wantsBaseline) {
          await appendAccessEvent(client, {
            correlationId,
            actorAccountId: input.actorId,
            operation: "personnel_event.pre_baseline_override",
            scope: {
              draftId: draft.id,
              personId: draft.personId,
              overrideCodes: needOverride,
              warningCodes: needAck,
              effectiveDate: draft.effectiveDate,
            },
            result: "allow",
            reason: input.override.reason,
            entityType: "PersonnelEventDraft",
            entityId: draft.id,
            payload: {
              baselineOverride: true,
              capacityOverride: wantsCapacity,
              acknowledgedWarningCodes: needAck,
            },
          });
        }
      }

      // Manual rematch for anonymized Return — independent access-event evidence
      if (
        draft.eventType === "EmploymentReturned" &&
        draft.payload.manualRematchVerified === true &&
        typeof draft.payload.manualRematchEvidence === "string" &&
        draft.payload.manualRematchEvidence.trim()
      ) {
        await appendAccessEvent(client, {
          correlationId,
          actorAccountId: input.actorId,
          operation: "personnel_event.manual_rematch",
          scope: {
            draftId: draft.id,
            personId: draft.personId,
            effectiveDate: draft.effectiveDate,
          },
          result: "allow",
          reason: draft.payload.manualRematchEvidence.trim(),
          entityType: "PersonnelEventDraft",
          entityId: draft.id,
          payload: {
            manualRematchVerified: true,
            eventId: eventId!,
          },
        });
      }

      // AD-6 heavy path: past-dated Effective → durable pending + post-commit enqueue
      if (
        status === "Effective" &&
        isPastDatedEffective(draft.effectiveDate, liveSnapshot.asOfDate)
      ) {
        pendingRecalc = await scheduleHeavyRecalculation(
          client,
          draft.personId,
          draft.effectiveDate,
        );
      }

      const finalRow = await lockDraftRow(client, draft.id);
      draft = mapDraftRow(finalRow!);

      return {
        outcome: "finalized" as const,
        draft,
        eventId: eventId!,
        status,
        conflicts,
        snapshot: liveSnapshot,
        projectionHookInvoked: Boolean(hookCtx.invoked),
        recalcScheduled: pendingRecalc,
      };
    } catch (err) {
      // Only compensate newly created / applied projections — never undo idempotent re-apply
      if (hookCtx.createdStartReturnPrimaryId && hookCtx.appliedEmploymentId) {
        await compensateOrphanStartReturnProjections({
          employmentId: hookCtx.appliedEmploymentId,
          primaryId: hookCtx.createdStartReturnPrimaryId,
        });
      }
      if (hookCtx.terminationApply) {
        await compensateTerminationApply({
          client,
          employmentId: hookCtx.terminationApply.employmentId,
          endDateExclusive: hookCtx.terminationApply.endDateExclusive,
          closedPrimaries: hookCtx.terminationApply.closedPrimaries,
          closedSecondaries: hookCtx.terminationApply.closedSecondaries,
          releaseEventId: eventId!,
          didRelease: hookCtx.terminationApply.didRelease,
          didCloseEmployment: hookCtx.terminationApply.didCloseEmployment,
        });
      }
      if (hookCtx.transferApply && !hookCtx.transferApply.reservedOnly) {
        await compensateTransferApply({
          client,
          employmentId: hookCtx.transferApply.employmentId,
          endDateExclusive: hookCtx.transferApply.endDateExclusive,
          sourcePrimaryId: hookCtx.transferApply.sourcePrimaryId,
          previousSourceEnd: hookCtx.transferApply.previousSourceEnd,
          destinationPrimaryId: hookCtx.transferApply.destinationPrimaryId,
          transferEventId: eventId!,
          didCloseSource: hookCtx.transferApply.didCloseSource,
          didOpenDest: hookCtx.transferApply.didOpenDest,
          didReleaseSource: hookCtx.transferApply.didReleaseSource,
          didMoveDestCapacity: hookCtx.transferApply.didMoveDestCapacity,
        });
      }
      throw err;
    }
  }),
  );

  if (pendingRecalc) {
    await enqueueRecalculationAfterCommit(pendingRecalc);
  }
  return result as FinalizeDraftResult;
}

/**
 * Convenience: evaluate conflicts without finalizing (UI pre-check).
 */
export async function evaluateDraftForFinalize(
  draftId: string,
  actorId: string,
  opts: {
    correlationId?: string;
    conflictPolicy?: ConflictPolicy;
    permissionSetFingerprint?: string;
  } = {},
  db: PrismaClient = getPersonDb(),
): Promise<{
  draft: PersonnelEventDraftRecord;
  snapshot: EvaluationSnapshot;
  conflicts: ConflictFinding[];
  asOfDate: string;
}> {
  const row = await db.personnelEventDraft.findUnique({
    where: { id: draftId },
  });
  if (!row) {
    throw new PersonnelEventError("DRAFT_NOT_FOUND", MSG_DRAFT_NOT_FOUND_FA);
  }
  const draft = mapDraftRow(row as DraftRow);
  if (draft.status === "deleted") {
    throw new PersonnelEventError("DRAFT_DELETED", MSG_DRAFT_DELETED_FA);
  }
  if (draft.status === "finalized") {
    throw new PersonnelEventError(
      "DRAFT_ALREADY_FINALIZED",
      MSG_DRAFT_ALREADY_FINALIZED_FA,
    );
  }
  const snapshot = await buildEvaluationSnapshot(
    {
      draft,
      actorAccountId: actorId,
      correlationId: opts.correlationId ?? randomUUID(),
      permissionSetFingerprint: opts.permissionSetFingerprint,
    },
    db,
  );
  const conflicts = await classifyConflicts(
    draft,
    snapshot,
    opts.conflictPolicy ?? {},
    db,
  );
  return {
    draft,
    snapshot,
    conflicts,
    asOfDate: snapshot.asOfDate || todayDateOnlyTehran(),
  };
}
