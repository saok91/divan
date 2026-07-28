/**
 * InferenceBulkPort — small-cohort, differencing, volume/window, and bulk
 * approval hooks (Story 2.7 / FR-48 / AD-5).
 *
 * Ownership: audit-envelope owns fine-grained bulk thresholds. Call **after**
 * PopulationPort intersection (authorized subject id set only).
 *
 * Production threshold numbers are owned by AR-ACCESS (bulk/volume) and
 * AR-REPORTING (small-cohort / sequential fixtures). Code holds configurable
 * hooks + DEMO defaults only — never invent Launch Artifact freeze values.
 *
 * Fail-closed: when hooks are disabled / missing on a path that claims
 * inference protection → deny (do not silently allow).
 */

import { randomUUID } from "node:crypto";

import {
  appendAccessEvent,
  withTransaction,
  type AccessResult,
} from "@divan/event-store";
import type { Pool } from "pg";

import {
  AuthorizationError,
  MSG_ACCESS_DENIED_FA,
  MSG_AUDIT_APPEND_FAILED_FA,
} from "./authorization-error";
import { AuditTrustError } from "./audit-trust";
import {
  assertAuditTrustWriterAllowed,
  enforceClockAnomalyOrThrow,
  recordRequiredAppendFailure,
} from "./audit-trust-gate";

/** Same surface as PopulationPort RetrievalChannel + optional `list`. */
export type InferenceBulkChannel =
  | "profile"
  | "timeline"
  | "search"
  | "list"
  | "count"
  | "dashboard"
  | "report"
  | "export"
  | "audit";

/**
 * Structured retrieval outcome — suppress ≠ empty ≠ zero.
 * - `allow`: authorized set may be returned / counted
 * - `empty`: true empty authorized intersection (not suppression)
 * - `suppress`: small-cohort / differencing — UX «داده قابل نمایش نیست»
 * - `deny`: volume/window/field overrun or disabled hooks
 * - `require_bulk_approval`: bulk/sensitive needs activated `kind: bulk` grant
 */
export type InferenceBulkDecision =
  | "allow"
  | "empty"
  | "suppress"
  | "deny"
  | "require_bulk_approval";

/** Access-event outcome vocabulary (FR-51) — no HR field values. */
export type InferenceBulkAccessOutcome =
  | "allowed"
  | "empty"
  | "suppressed"
  | "denied"
  | "require_bulk_approval";

export const MSG_SUPPRESSED_COHORT_FA = "داده قابل نمایش نیست";

export type InferenceBulkHooks = {
  /**
   * When false, evaluate fail-closes (deny) on protected paths.
   * DEMO enables true; production defaults false until AR-* freeze.
   */
  enabled: boolean;
  /** Small-cell / zero-cell threshold (DEMO default — not AR-REPORTING). */
  minimumCohortSize: number;
  maxVolumePerRequest: number;
  maxVolumePerWindow: number;
  /** Sliding window length for volume + field cumulative + fingerprints. */
  windowDurationMs: number;
  /** Sensitive field pull count across the window. */
  maxFieldCumulative: number;
  /**
   * Volume at/above this (or sensitive aggregate) requires activated bulk grant
   * unless `bulkApprovalPresent` is true.
   */
  bulkApprovalVolumeThreshold: number;
};

/**
 * DEMO-only defaults (documented). Production AR-ACCESS / AR-REPORTING own
 * real numbers — do not treat these as launch baselines.
 */
export const DEMO_INFERENCE_BULK_HOOKS: InferenceBulkHooks = Object.freeze({
  enabled: true,
  minimumCohortSize: 3,
  maxVolumePerRequest: 10,
  maxVolumePerWindow: 20,
  windowDurationMs: 60_000,
  maxFieldCumulative: 8,
  bulkApprovalVolumeThreshold: 5,
});

/** Production / disabled default — fail closed until AR-* enables hooks. */
export const DISABLED_INFERENCE_BULK_HOOKS: InferenceBulkHooks = Object.freeze({
  enabled: false,
  minimumCohortSize: Number.POSITIVE_INFINITY,
  maxVolumePerRequest: 0,
  maxVolumePerWindow: 0,
  windowDurationMs: 60_000,
  maxFieldCumulative: 0,
  bulkApprovalVolumeThreshold: 0,
});

export type QueryFingerprint = {
  /** Sorted authorized subject ids fingerprint. */
  setKey: string;
  subjectIds: readonly string[];
  channel: InferenceBulkChannel;
  cellKey?: string;
  atMs: number;
};

export type InferenceBulkEvaluateInput = {
  channel: InferenceBulkChannel;
  actorId: string;
  purpose?: string;
  /** Post-intersection authorized subject ids only. */
  authorizedSubjectIds: readonly string[];
  /** Optional aggregate / cell key for sibling secondary suppression demos. */
  cellKey?: string;
  /** Sensitive field ids pulled this request (never values). */
  fields?: readonly string[];
  /**
   * Prior query fingerprints in the window. When omitted, the in-memory
   * fixture store for `actorId` is used (demos / selfcheck).
   */
  priorQueryFingerprints?: readonly QueryFingerprint[];
  /** Treat as sensitive aggregate (may require bulk approval). */
  sensitivity?: boolean;
  /** True when an activated EntitlementGrant `kind: bulk` is present. */
  bulkApprovalPresent?: boolean;
  correlationId?: string;
  /**
   * When true (default), record this query fingerprint into the actor window
   * after evaluate (for sequential differencing demos).
   */
  recordFingerprint?: boolean;
  nowMs?: number;
};

export type InferenceBulkEvaluateResult = {
  decision: InferenceBulkDecision;
  /** API/UX structured outcome (never collapse suppress into 0). */
  outcome: InferenceBulkAccessOutcome;
  messageKey?: "suppressedCohort";
  messageFa?: string;
  /** Size of authorized set presented to thresholds. */
  volumeAuthorized: number;
  reason: string;
};

type WindowCounters = {
  volume: number;
  fieldCount: number;
  fingerprints: QueryFingerprint[];
  windowStartMs: number;
};

let activeHooks: InferenceBulkHooks = loadInferenceBulkHooks();
const actorWindows = new Map<string, WindowCounters>();

function cloneHooks(h: InferenceBulkHooks): InferenceBulkHooks {
  return { ...h };
}

/**
 * Load hooks from env / NODE_ENV.
 * - Explicit `AUDIT_INFERENCE_BULK_ENABLED=true` → DEMO hooks
 * - Production → disabled (fail closed) unless enabled flag set
 * - Non-production → DEMO hooks by default (same pattern as policy fixtures)
 */
export function loadInferenceBulkHooks(
  env: NodeJS.ProcessEnv = process.env,
): InferenceBulkHooks {
  const flag = env.AUDIT_INFERENCE_BULK_ENABLED?.trim().toLowerCase();
  if (flag === "false") return cloneHooks(DISABLED_INFERENCE_BULK_HOOKS);
  if (flag === "true") return cloneHooks(DEMO_INFERENCE_BULK_HOOKS);
  if ((env.NODE_ENV ?? "").toLowerCase() === "production") {
    return cloneHooks(DISABLED_INFERENCE_BULK_HOOKS);
  }
  return cloneHooks(DEMO_INFERENCE_BULK_HOOKS);
}

export function getInferenceBulkHooks(): InferenceBulkHooks {
  return activeHooks;
}

/** Test/selfcheck hook. Pass null to restore env-derived defaults. */
export function setInferenceBulkHooksForTests(
  hooks: InferenceBulkHooks | null,
): void {
  activeHooks = hooks ? cloneHooks(hooks) : loadInferenceBulkHooks();
}

/** Clear in-memory window counters / fingerprints (selfcheck isolation). */
export function clearInferenceBulkWindowsForTests(): void {
  actorWindows.clear();
}

export function fingerprintAuthorizedSet(
  subjectIds: readonly string[],
): string {
  return [...subjectIds].sort().join("|");
}

function getOrResetWindow(
  actorId: string,
  nowMs: number,
  windowDurationMs: number,
): WindowCounters {
  const existing = actorWindows.get(actorId);
  if (
    !existing ||
    nowMs - existing.windowStartMs >= windowDurationMs
  ) {
    const fresh: WindowCounters = {
      volume: 0,
      fieldCount: 0,
      fingerprints: [],
      windowStartMs: nowMs,
    };
    actorWindows.set(actorId, fresh);
    return fresh;
  }
  // Drop stale fingerprints inside the window edge
  existing.fingerprints = existing.fingerprints.filter(
    (fp) => nowMs - fp.atMs < windowDurationMs,
  );
  return existing;
}

/**
 * Identity read channels: single-subject profile/timeline are legitimate.
 * Cohort (small-cell) does not apply; volume / differencing / bulk still do.
 */
export function isIdentityRetrievalChannel(
  channel: InferenceBulkChannel,
): boolean {
  return channel === "profile" || channel === "timeline";
}

function chargeWindowUsage(
  window: WindowCounters,
  volumeAuthorized: number,
  fieldDelta: number,
): void {
  window.volume += volumeAuthorized;
  window.fieldCount += fieldDelta;
}

function setDifferenceSize(
  a: readonly string[],
  b: readonly string[],
): number {
  const bSet = new Set(b);
  let n = 0;
  for (const id of a) {
    if (!bSet.has(id)) n += 1;
  }
  return n;
}

/**
 * Symmetric isolation size: |AΔB| = |A\B| + |B\A|.
 * Used for differencing / repeated-query protection.
 */
export function symmetricDifferenceSize(
  a: readonly string[],
  b: readonly string[],
): number {
  return setDifferenceSize(a, b) + setDifferenceSize(b, a);
}

function decisionToAccessResult(
  decision: InferenceBulkDecision,
): AccessResult {
  return decision === "allow" || decision === "empty" ? "allow" : "deny";
}

function suppressResult(volumeAuthorized: number, reason: string): InferenceBulkEvaluateResult {
  return {
    decision: "suppress",
    outcome: "suppressed",
    messageKey: "suppressedCohort",
    messageFa: MSG_SUPPRESSED_COHORT_FA,
    volumeAuthorized,
    reason,
  };
}

/**
 * Evaluate inference + bulk controls on an authorized subject set.
 * Does not widen scope — callers must pass post-intersection ids only.
 */
export function evaluateInferenceBulk(
  input: InferenceBulkEvaluateInput,
  hooks: InferenceBulkHooks = activeHooks,
): InferenceBulkEvaluateResult {
  const uniqueSubjectIds = [...new Set(input.authorizedSubjectIds)];
  const volumeAuthorized = uniqueSubjectIds.length;
  const nowMs = input.nowMs ?? Date.now();
  const identityChannel = isIdentityRetrievalChannel(input.channel);
  /** Charge volume/field on evaluated attempts; fingerprints only on allow. */
  const shouldChargeWindow = input.recordFingerprint !== false;

  if (!hooks.enabled) {
    return {
      decision: "deny",
      outcome: "denied",
      volumeAuthorized,
      reason: "inference_bulk_hooks_disabled",
    };
  }

  if (volumeAuthorized === 0) {
    return {
      decision: "empty",
      outcome: "empty",
      volumeAuthorized: 0,
      reason: "authorized_set_empty",
    };
  }

  if (volumeAuthorized > hooks.maxVolumePerRequest) {
    const window = getOrResetWindow(
      input.actorId,
      nowMs,
      hooks.windowDurationMs,
    );
    if (shouldChargeWindow) {
      chargeWindowUsage(window, volumeAuthorized, 0);
    }
    return {
      decision: "deny",
      outcome: "denied",
      volumeAuthorized,
      reason: "max_volume_per_request",
    };
  }

  const window = getOrResetWindow(
    input.actorId,
    nowMs,
    hooks.windowDurationMs,
  );

  if (window.volume + volumeAuthorized > hooks.maxVolumePerWindow) {
    if (shouldChargeWindow) {
      chargeWindowUsage(window, volumeAuthorized, 0);
    }
    return {
      decision: "deny",
      outcome: "denied",
      volumeAuthorized,
      reason: "max_volume_per_window",
    };
  }

  const fieldDelta = new Set(input.fields ?? []).size;
  if (window.fieldCount + fieldDelta > hooks.maxFieldCumulative) {
    // Soft gate: without bulk approval → require_bulk_approval; with approval → allow.
    // Hard volume ceilings above are never waived by approval (FR-48).
    if (!input.bulkApprovalPresent) {
      if (shouldChargeWindow) {
        chargeWindowUsage(window, volumeAuthorized, fieldDelta);
      }
      return {
        decision: "require_bulk_approval",
        outcome: "require_bulk_approval",
        volumeAuthorized,
        reason: "max_field_cumulative",
      };
    }
  }

  // Small-cohort / zero-cell on authorized set (aggregates only — not profile/timeline)
  if (
    !identityChannel &&
    volumeAuthorized < hooks.minimumCohortSize
  ) {
    if (shouldChargeWindow) {
      chargeWindowUsage(window, volumeAuthorized, fieldDelta);
    }
    return suppressResult(volumeAuthorized, "minimum_cohort_size");
  }

  // Differencing / repeated-query / comparison (MVP: fail-closed comparison surface;
  // full sibling cell algebra is AR-REPORTING — see deferred-work).
  const priors =
    input.priorQueryFingerprints ??
    window.fingerprints.filter(
      (fp) => nowMs - fp.atMs < hooks.windowDurationMs,
    );

  for (const prior of priors) {
    const priorSize = new Set(prior.subjectIds).size;
    if (!identityChannel && priorSize < hooks.minimumCohortSize) continue;
    if (!identityChannel && volumeAuthorized < hooks.minimumCohortSize) continue;
    const delta = symmetricDifferenceSize(uniqueSubjectIds, prior.subjectIds);
    if (delta > 0 && delta < hooks.minimumCohortSize) {
      if (shouldChargeWindow) {
        chargeWindowUsage(window, volumeAuthorized, fieldDelta);
      }
      return suppressResult(volumeAuthorized, "differencing_isolation");
    }
  }

  const needsBulkApproval =
    volumeAuthorized >= hooks.bulkApprovalVolumeThreshold ||
    input.sensitivity === true;

  if (needsBulkApproval && !input.bulkApprovalPresent) {
    if (shouldChargeWindow) {
      chargeWindowUsage(window, volumeAuthorized, fieldDelta);
    }
    return {
      decision: "require_bulk_approval",
      outcome: "require_bulk_approval",
      volumeAuthorized,
      reason: input.sensitivity
        ? "sensitive_aggregate_requires_bulk_approval"
        : "bulk_volume_requires_approval",
    };
  }

  if (shouldChargeWindow) {
    const fp: QueryFingerprint = {
      setKey: fingerprintAuthorizedSet(uniqueSubjectIds),
      subjectIds: uniqueSubjectIds,
      channel: input.channel,
      cellKey: input.cellKey,
      atMs: nowMs,
    };
    window.fingerprints.push(fp);
    chargeWindowUsage(window, volumeAuthorized, fieldDelta);
  }

  return {
    decision: "allow",
    outcome: "allowed",
    volumeAuthorized,
    reason: "inference_bulk_allow",
  };
}

export type RecordInferenceBulkAccessInput = {
  pool: Pool;
  correlationId: string;
  actorAccountId: string;
  operation: string;
  channel: InferenceBulkChannel;
  purpose?: string;
  organizationalScope?: string;
  evaluation: InferenceBulkEvaluateResult;
  /** Optional extra non-HR metadata. */
  payload?: Record<string, unknown>;
};

/**
 * Append attributable access evidence for inference/bulk outcomes (FR-51).
 * Records volume + outcome — never HR field values.
 * Append failure → AuthorizationError AUDIT_APPEND_FAILED (fail closed).
 */
export async function recordInferenceBulkAccessEvent(
  input: RecordInferenceBulkAccessInput,
): Promise<{ decisionId: string }> {
  const accessResult = decisionToAccessResult(input.evaluation.decision);
  try {
    await assertAuditTrustWriterAllowed(input.pool, {
      correlationId: input.correlationId,
    });
    await enforceClockAnomalyOrThrow(input.pool, {
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId,
    });
  } catch (err) {
    if (err instanceof AuditTrustError) throw err;
    if (err instanceof AuthorizationError) throw err;
    await recordRequiredAppendFailure(input.pool, {
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId,
    });
    throw new AuthorizationError(
      "AUDIT_APPEND_FAILED",
      MSG_AUDIT_APPEND_FAILED_FA,
      input.correlationId,
      null,
      "audit_trust_gate_failed",
    );
  }
  try {
    const decisionId = await withTransaction(input.pool, async (client) => {
      const { id } = await appendAccessEvent(client, {
        correlationId: input.correlationId,
        actorAccountId: input.actorAccountId,
        operation: input.operation,
        scope: {
          channel: input.channel,
          purpose: input.purpose ?? null,
          organizationalScope: input.organizationalScope ?? null,
          volumeAuthorized: input.evaluation.volumeAuthorized,
          inferenceOutcome: input.evaluation.outcome,
        },
        result: accessResult,
        reason: input.evaluation.reason,
        payload: {
          volume: input.evaluation.volumeAuthorized,
          outcome: input.evaluation.outcome,
          decision: input.evaluation.decision,
          messageKey: input.evaluation.messageKey ?? null,
          ...(input.payload ?? {}),
        },
      });
      return id;
    });
    return { decisionId };
  } catch (err) {
    if (err instanceof AuthorizationError) throw err;
    if (err instanceof AuditTrustError) throw err;
    await recordRequiredAppendFailure(input.pool, {
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId,
    });
    throw new AuthorizationError(
      "AUDIT_APPEND_FAILED",
      MSG_AUDIT_APPEND_FAILED_FA,
      input.correlationId,
      null,
      "audit_append_failed",
    );
  }
}

/**
 * Shared retrieval control-plane result shape for demos / Epic 5 consumers.
 * Distinguishes suppress vs empty vs allow — never returns count: 0 on suppress.
 */
export type GovernedRetrievalPayload =
  | {
      outcome: "allowed";
      subjectIds: string[];
      volume: number;
      decisionId?: string;
    }
  | {
      outcome: "empty";
      subjectIds: [];
      volume: 0;
      decisionId?: string;
    }
  | {
      outcome: "suppressed";
      messageKey: "suppressedCohort";
      messageFa: string;
      /** Intentionally omitted — never expose suppressed count as 0. */
      volume: null;
      subjectIds: null;
      decisionId?: string;
    }
  | {
      outcome: "denied" | "require_bulk_approval";
      messageFa: string;
      volume: null;
      subjectIds: null;
      decisionId?: string;
      reason?: string;
    };

export function toGovernedRetrievalPayload(
  evaluation: InferenceBulkEvaluateResult,
  subjectIds: readonly string[],
  decisionId?: string,
): GovernedRetrievalPayload {
  switch (evaluation.decision) {
    case "allow":
      return {
        outcome: "allowed",
        subjectIds: [...subjectIds],
        volume: subjectIds.length,
        decisionId,
      };
    case "empty":
      return {
        outcome: "empty",
        subjectIds: [],
        volume: 0,
        decisionId,
      };
    case "suppress":
      return {
        outcome: "suppressed",
        messageKey: "suppressedCohort",
        messageFa: evaluation.messageFa ?? MSG_SUPPRESSED_COHORT_FA,
        volume: null,
        subjectIds: null,
        decisionId,
      };
    case "require_bulk_approval":
      return {
        outcome: "require_bulk_approval",
        messageFa: MSG_ACCESS_DENIED_FA,
        volume: null,
        subjectIds: null,
        decisionId,
        reason: evaluation.reason,
      };
    case "deny":
    default:
      return {
        outcome: "denied",
        messageFa: MSG_ACCESS_DENIED_FA,
        volume: null,
        subjectIds: null,
        decisionId,
        reason: evaluation.reason,
      };
  }
}

/** Stable demo correlation helper when caller has none. */
export function newInferenceCorrelationId(): string {
  return randomUUID();
}
