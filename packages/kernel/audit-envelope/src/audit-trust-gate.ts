/**
 * Audit trust fail-safe gate + integrity runner (Story 7.4).
 * Called from authorizeOrThrow / inference-bulk / thin web routers.
 */

import type { Pool, PoolClient } from "pg";

import { withTransaction } from "@divan/event-store";

import {
  AuditTrustError,
  MSG_AUDIT_CLOCK_ANOMALY_FA,
  MSG_AUDIT_INTEGRITY_FAILED_FA,
  MSG_AUDIT_TRUST_SUSPENDED_FA,
  isNonMonotonicOccurredAt,
  loadAuditTrustProvisionalConfig,
  observeClockSkew,
  type AuditTrustIncidentKind,
} from "./audit-trust";
import {
  checkAppendOnlyTriggerPresent,
  countAccessEventsInWindow,
  getWriterState,
  insertIntegrityVerificationRun,
  listRecentAccessOccurredAt,
  openTrustIncident,
  selectDbNow,
  setWriterSuspended,
  type PgQueryable,
} from "./audit-trust-repo";

export type TrustGatePool = Pool | PoolClient;

/**
 * Permissions that may proceed while writers are suspended (read/review trust,
 * ops alert surface, investigation of gaps). New sensitive HR work remains blocked.
 */
const TRUST_CONTROL_PLANE_PERMISSIONS = new Set([
  "audit.trust.read",
  "audit.trust.review",
  "ops.health.read",
  "audit.investigate",
  "audit.evidence.review",
]);

function isTrustControlPlanePermission(permission?: string): boolean {
  return typeof permission === "string" && TRUST_CONTROL_PLANE_PERMISSIONS.has(permission);
}

function isPool(db: TrustGatePool): db is Pool {
  return typeof (db as Pool).connect === "function";
}

async function runOnQueryable<T>(
  db: TrustGatePool,
  fn: (client: PgQueryable) => Promise<T>,
): Promise<T> {
  if (isPool(db)) {
    return withTransaction(db, fn);
  }
  return fn(db);
}

async function openIncidentAndSuspend(
  db: TrustGatePool,
  input: {
    kind: AuditTrustIncidentKind;
    correlationId: string;
    subjectAccountId?: string | null;
    detail?: Record<string, string | number | boolean | null>;
    suspendReason: string;
    suspendedBy: string;
  },
): Promise<void> {
  await runOnQueryable(db, async (client) => {
    // Suspend first so a partial failure still blocks subsequent writers.
    await setWriterSuspended(client, {
      reason: input.suspendReason,
      suspendedBy: input.suspendedBy,
      correlationId: input.correlationId,
      clearRequiresReview: true,
    });
    await openTrustIncident(client, {
      kind: input.kind,
      correlationId: input.correlationId,
      subjectAccountId: input.subjectAccountId ?? null,
      detail: input.detail,
    });
  });
}

/**
 * Fail-closed pre-check before required sensitive audit writers.
 * Throws AuditTrustError when suspended or config missing under enforce.
 * Control-plane trust/ops/investigation reads may continue while suspended.
 *
 * MVP: writer_state uses ok|suspended only. Ops "degraded" is derived from
 * openIncidentCount — schema allows degraded for future AR freeze.
 */
export async function assertAuditTrustWriterAllowed(
  db: PgQueryable,
  input: { correlationId: string; permission?: string },
): Promise<void> {
  // May throw AUDIT_TRUST_CONFIG_MISSING when enforce + knobs missing
  loadAuditTrustProvisionalConfig();

  if (isTrustControlPlanePermission(input.permission)) {
    return;
  }

  const state = await getWriterState(db);
  if (state.status === "suspended") {
    throw new AuditTrustError(
      "AUDIT_TRUST_SUSPENDED",
      MSG_AUDIT_TRUST_SUSPENDED_FA,
      {
        reason: state.reason ?? "writer_suspended",
        correlationId: input.correlationId,
      },
    );
  }
}

/**
 * Cheap clock skew probe (app vs DB now) + optional non-monotonic sample.
 * On anomaly: open incident, suspend, throw.
 * Skipped for trust control-plane permissions (avoid lockout).
 */
export async function enforceClockAnomalyOrThrow(
  db: TrustGatePool,
  input: {
    correlationId: string;
    actorAccountId: string;
    permission?: string;
    /** Skip when false (e.g. secondary soft paths). Default true for required writers. */
    enabled?: boolean;
  },
): Promise<void> {
  if (input.enabled === false) return;
  if (isTrustControlPlanePermission(input.permission)) return;

  const config = loadAuditTrustProvisionalConfig();
  const appNow = new Date();
  const dbNow = await selectDbNow(db);
  const observation = observeClockSkew({
    appNow,
    dbNow,
    maxSkewMs: config.maxClockSkewMs,
    correlationId: input.correlationId,
  });

  let nonMonotonic = false;
  try {
    const recent = await listRecentAccessOccurredAt(
      db,
      Math.min(config.verificationWindowHours, 6),
      5,
    );
    for (let i = 1; i < recent.length; i++) {
      if (
        isNonMonotonicOccurredAt({
          previousOccurredAt: recent[i - 1]!,
          nextOccurredAt: recent[i]!,
          toleranceMs: config.maxClockSkewMs,
        })
      ) {
        nonMonotonic = true;
        break;
      }
    }
  } catch {
    // Heuristic only — do not fail closed solely on query errors here
  }

  if (!observation.anomalous && !nonMonotonic) return;

  await openIncidentAndSuspend(db, {
    kind: "clock_anomaly",
    correlationId: input.correlationId,
    subjectAccountId: input.actorAccountId,
    detail: {
      deltaMs: observation.deltaMs,
      maxSkewMs: observation.maxSkewMs,
      nonMonotonic,
      honesty: "provisional_skew_not_ntp_sla",
    },
    suspendReason: "clock_anomaly",
    suspendedBy: "system:audit-trust",
  });
  throw new AuditTrustError(
    "AUDIT_CLOCK_ANOMALY",
    MSG_AUDIT_CLOCK_ANOMALY_FA,
    { correlationId: input.correlationId },
  );
}

/**
 * On required append failure: open incident + suspend (fail-closed: first failure).
 * Caller still throws AuthorizationError AUDIT_APPEND_FAILED.
 * Errors propagate — do not swallow; prefer suspend-first so writers stay blocked.
 */
export async function recordRequiredAppendFailure(
  db: TrustGatePool,
  input: {
    correlationId: string;
    actorAccountId?: string | null;
  },
): Promise<void> {
  try {
    await openIncidentAndSuspend(db, {
      kind: "append_fail",
      correlationId: input.correlationId,
      subjectAccountId: input.actorAccountId ?? null,
      detail: {
        policy: "suspend_on_required_append_failure",
      },
      suspendReason: "append_fail",
      suspendedBy: "system:audit-trust",
    });
  } catch (primaryErr) {
    // Last resort: suspend alone so subsequent sensitive work cannot fail-open.
    try {
      await setWriterSuspended(db, {
        reason: "append_fail",
        suspendedBy: "system:audit-trust",
        correlationId: input.correlationId,
        clearRequiresReview: true,
      });
      return;
    } catch {
      throw primaryErr;
    }
  }
}

/**
 * Integrity verification substrate (MVP — not full hash-chain).
 * Fail → incident + suspend + throw.
 * Fail conditions: missing/disabled append-only trigger, or sequence/gap
 * (non-monotonic occurred_at) anomaly in the verification sample window.
 */
export async function runIntegrityVerification(
  db: TrustGatePool,
  input: {
    actorAccountId: string;
    correlationId: string;
    /** When true, throw on fail after recording (default true). */
    throwOnFail?: boolean;
  },
): Promise<{
  outcome: "pass" | "fail";
  runId: string;
  findings: Record<string, string | number | boolean | null>;
}> {
  const config = loadAuditTrustProvisionalConfig();
  const findings: Record<string, string | number | boolean | null> = {
    hashChain: "deferred_not_claimed",
    honesty: "mvp_trigger_gap_seal_only",
  };

  const trigger = await checkAppendOnlyTriggerPresent(db);
  findings.triggerPresent = trigger.present;
  findings.triggerEnabled = trigger.enabled;

  let accessCount = 0;
  try {
    accessCount = await countAccessEventsInWindow(
      db,
      config.verificationWindowHours,
    );
  } catch {
    findings.accessCountQuery = "failed";
  }
  findings.accessCountInWindow = accessCount;
  findings.windowHours = config.verificationWindowHours;
  findings.gapOracle = "heuristic_only_not_perfect_capture_proof";

  let sequenceAnomaly = false;
  try {
    const recent = await listRecentAccessOccurredAt(
      db,
      config.verificationWindowHours,
      20,
    );
    findings.sequenceSampleSize = recent.length;
    for (let i = 1; i < recent.length; i++) {
      if (
        isNonMonotonicOccurredAt({
          previousOccurredAt: recent[i - 1]!,
          nextOccurredAt: recent[i]!,
          toleranceMs: config.maxClockSkewMs,
        })
      ) {
        sequenceAnomaly = true;
        break;
      }
    }
  } catch {
    findings.sequenceQuery = "failed";
    sequenceAnomaly = true;
  }
  findings.sequenceAnomaly = sequenceAnomaly;

  const fail =
    !trigger.present || !trigger.enabled || sequenceAnomaly;

  const outcome = fail ? "fail" : "pass";
  const run = await insertIntegrityVerificationRun(db, {
    outcome,
    windowLabel: `${config.verificationWindowHours}h`,
    findings,
    actorAccountId: input.actorAccountId,
    correlationId: input.correlationId,
  });

  if (fail) {
    await openIncidentAndSuspend(db, {
      kind: "integrity_fail",
      correlationId: input.correlationId,
      subjectAccountId: input.actorAccountId,
      detail: {
        triggerPresent: trigger.present,
        triggerEnabled: trigger.enabled,
        sequenceAnomaly,
        runId: run.id,
      },
      suspendReason: "integrity_fail",
      suspendedBy: input.actorAccountId,
    });
    if (input.throwOnFail !== false) {
      throw new AuditTrustError(
        "AUDIT_INTEGRITY_FAILED",
        MSG_AUDIT_INTEGRITY_FAILED_FA,
        { runId: run.id, correlationId: input.correlationId },
      );
    }
  }

  return { outcome, runId: run.id, findings };
}

/** Open a capture-gap heuristic incident (honesty-labeled). */
export async function recordCaptureGapIncident(
  db: TrustGatePool,
  input: {
    correlationId: string;
    kind?: Extract<AuditTrustIncidentKind, "capture_gap" | "interrupted">;
    detail?: Record<string, string | number | boolean | null>;
    suspend?: boolean;
    actorAccountId?: string;
  },
): Promise<void> {
  if (input.suspend) {
    await openIncidentAndSuspend(db, {
      kind: input.kind ?? "capture_gap",
      correlationId: input.correlationId,
      subjectAccountId: input.actorAccountId ?? null,
      detail: {
        honesty: "heuristic_gap_not_perfect_oracle",
        ...(input.detail ?? {}),
      },
      suspendReason: input.kind ?? "capture_gap",
      suspendedBy: "system:audit-trust",
    });
    return;
  }
  await openTrustIncident(db, {
    kind: input.kind ?? "capture_gap",
    correlationId: input.correlationId,
    subjectAccountId: input.actorAccountId ?? null,
    detail: {
      honesty: "heuristic_gap_not_perfect_oracle",
      ...(input.detail ?? {}),
    },
  });
}
