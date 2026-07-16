/**
 * Shared retrieval control plane (Story 2.7 / FR-48).
 * Pipeline: authorizeOrThrow (governedProcedure) → PopulationPort.intersect
 * → InferenceBulkPort.evaluate → access event { volume, outcome } → payload.
 *
 * Client threshold overrides are never accepted — server hooks only.
 */

import {
  AuthorizationError,
  evaluateInferenceBulk,
  recordInferenceBulkAccessEvent,
  toGovernedRetrievalPayload,
  type GovernedRetrievalPayload,
  type InferenceBulkChannel,
  type InferenceBulkEvaluateResult,
} from "@divan/audit-envelope";
import { createPgPool } from "@divan/db";
import {
  currentAsOfDate,
  drillDownPopulation,
  intersectPopulation,
  listGrants,
  type RetrievalChannel,
} from "@divan/identity-access";
import { TRPCError } from "@trpc/server";

import { operationalCopy } from "@/lib/operational-copy";

const INFERENCE_CHANNELS = new Set<string>([
  "profile",
  "timeline",
  "search",
  "list",
  "count",
  "dashboard",
  "report",
  "export",
  "audit",
]);

let evidencePool: ReturnType<typeof createPgPool> | null = null;

function getEvidencePool() {
  if (evidencePool) return evidencePool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Evidence store is not configured.",
    });
  }
  evidencePool = createPgPool(url);
  return evidencePool;
}

export function toInferenceChannel(
  channel: RetrievalChannel | string,
): InferenceBulkChannel {
  if (INFERENCE_CHANNELS.has(channel)) {
    return channel as InferenceBulkChannel;
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: operationalCopy.accessDeniedTitle,
  });
}

/** Active activated `kind: bulk` grant for the actor (demo / FR-46 reuse). */
export async function actorHasActiveBulkGrant(
  accountId: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const grants = await listGrants({
    subjectAccountId: accountId,
    status: "active",
  });
  return grants.some((g) => {
    if (g.kind !== "bulk") return false;
    if (!g.expiresAt) return true;
    const expiresMs = Date.parse(g.expiresAt);
    return Number.isFinite(expiresMs) && expiresMs > nowMs;
  });
}

export type RunGovernedRetrievalInput = {
  actorAccountId: string;
  actorScopeCodes: string[];
  channel: RetrievalChannel;
  asOfDate?: string;
  objectIds?: string[];
  dataCategory?: string;
  unreconciled?: boolean;
  correlationId: string;
  purpose?: string;
  organizationalScope?: string;
  /** Optional cell key for secondary-suppression demos. */
  cellKey?: string;
  fields?: readonly string[];
  sensitivity?: boolean;
  /** Explicit demo co-approval flag (in addition to activated bulk grant). */
  demoBulkApproval?: boolean;
  /** When true, skip DB access-event append (pure unit probes). Prefer false. */
  skipAccessEvent?: boolean;
};

export type RunGovernedRetrievalResult = {
  evaluation: InferenceBulkEvaluateResult;
  payload: GovernedRetrievalPayload;
  subjectIds: string[];
};

function safeSubjectIds(
  evaluation: InferenceBulkEvaluateResult,
  ids: readonly string[],
): string[] {
  return evaluation.decision === "allow" || evaluation.decision === "empty"
    ? [...ids]
    : [];
}

async function recordEvidence(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
  channel: InferenceBulkChannel;
  purpose?: string;
  organizationalScope?: string;
  evaluation: InferenceBulkEvaluateResult;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const pool = getEvidencePool();
  const recorded = await recordInferenceBulkAccessEvent({
    pool,
    correlationId: input.correlationId,
    actorAccountId: input.actorAccountId,
    operation: input.operation,
    channel: input.channel,
    purpose: input.purpose,
    organizationalScope: input.organizationalScope,
    evaluation: input.evaluation,
    payload: input.payload,
  });
  return recorded.decisionId;
}

function mapAuthzError(err: unknown): never {
  if (err instanceof AuthorizationError) {
    throw new TRPCError({
      code:
        err.code === "AUDIT_APPEND_FAILED"
          ? "INTERNAL_SERVER_ERROR"
          : "FORBIDDEN",
      message: err.messageFa,
    });
  }
  throw err;
}

/**
 * Intersect → evaluate → evidence. Used by count/list/search/dashboard/report/export demos.
 */
export async function runGovernedRetrieval(
  input: RunGovernedRetrievalInput,
): Promise<RunGovernedRetrievalResult> {
  const asOf = input.asOfDate ?? currentAsOfDate();
  const channel = input.channel;
  const pop = intersectPopulation({
    actorAccountId: input.actorAccountId,
    actorScopeCodes: input.actorScopeCodes,
    asOfDate: asOf,
    channel,
    objectIds: input.objectIds,
    dataCategory: input.dataCategory,
    unreconciled: input.unreconciled === true ? true : undefined,
  });

  if (!pop.ok) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: operationalCopy.accessDeniedTitle,
    });
  }

  const bulkApprovalPresent =
    input.demoBulkApproval === true ||
    (await actorHasActiveBulkGrant(input.actorAccountId));

  const evaluation = evaluateInferenceBulk({
    channel: toInferenceChannel(channel),
    actorId: input.actorAccountId,
    purpose: input.purpose,
    authorizedSubjectIds: pop.subjectIds,
    cellKey: input.cellKey,
    fields: input.fields,
    sensitivity: input.sensitivity,
    bulkApprovalPresent,
    correlationId: input.correlationId,
  });

  let decisionId: string | undefined;
  if (!input.skipAccessEvent) {
    try {
      decisionId = await recordEvidence({
        correlationId: input.correlationId,
        actorAccountId: input.actorAccountId,
        operation: `retrieval.${channel}`,
        channel: toInferenceChannel(channel),
        purpose: input.purpose,
        organizationalScope: input.organizationalScope,
        evaluation,
      });
    } catch (err) {
      mapAuthzError(err);
    }
  }

  return {
    evaluation,
    payload: toGovernedRetrievalPayload(
      evaluation,
      pop.subjectIds,
      decisionId,
    ),
    subjectIds: safeSubjectIds(evaluation, pop.subjectIds),
  };
}

export type RunGovernedDrillDownInput = {
  actorAccountId: string;
  actorScopeCodes: string[];
  objectId: string;
  dataCategory?: string;
  correlationId: string;
  purpose?: string;
  organizationalScope?: string;
  asOfDate?: string;
  demoBulkApproval?: boolean;
  skipAccessEvent?: boolean;
};

/**
 * Drill-down: recompute parent set, child must be ⊆ parent; then inference on child.
 * Suppressed parent → fail closed (no id leak).
 */
export async function runGovernedDrillDown(
  input: RunGovernedDrillDownInput,
): Promise<RunGovernedRetrievalResult> {
  const asOf = input.asOfDate ?? currentAsOfDate();
  const parent = {
    actorAccountId: input.actorAccountId,
    actorScopeCodes: input.actorScopeCodes,
    asOfDate: asOf,
    channel: "search" as const,
    dataCategory: input.dataCategory ?? "demo.non_hr",
  };
  const parentResult = intersectPopulation(parent);
  const child = drillDownPopulation(parent, input.objectId);

  if (!parentResult.ok || !child.ok) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: operationalCopy.accessDeniedTitle,
    });
  }

  const widened = child.subjectIds.some(
    (id) => !parentResult.subjectIds.includes(id),
  );
  if (widened) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: operationalCopy.accessDeniedTitle,
    });
  }

  const bulkApprovalPresent =
    input.demoBulkApproval === true ||
    (await actorHasActiveBulkGrant(input.actorAccountId));

  const parentEval = evaluateInferenceBulk({
    channel: "search",
    actorId: input.actorAccountId,
    purpose: input.purpose,
    authorizedSubjectIds: parentResult.subjectIds,
    bulkApprovalPresent,
    correlationId: input.correlationId,
    recordFingerprint: false,
  });

  if (parentEval.decision === "suppress") {
    let decisionId: string | undefined;
    if (!input.skipAccessEvent) {
      try {
        decisionId = await recordEvidence({
          correlationId: input.correlationId,
          actorAccountId: input.actorAccountId,
          operation: "retrieval.drill_down",
          channel: "search",
          purpose: input.purpose,
          organizationalScope: input.organizationalScope,
          evaluation: parentEval,
          payload: { drillDown: "parent_suppressed" },
        });
      } catch (err) {
        mapAuthzError(err);
      }
    }
    return {
      evaluation: parentEval,
      payload: toGovernedRetrievalPayload(parentEval, [], decisionId),
      subjectIds: [],
    };
  }

  const evaluation = evaluateInferenceBulk({
    channel: "search",
    actorId: input.actorAccountId,
    purpose: input.purpose,
    authorizedSubjectIds: child.subjectIds,
    bulkApprovalPresent,
    correlationId: input.correlationId,
  });

  let decisionId: string | undefined;
  if (!input.skipAccessEvent) {
    try {
      decisionId = await recordEvidence({
        correlationId: input.correlationId,
        actorAccountId: input.actorAccountId,
        operation: "retrieval.drill_down",
        channel: "search",
        purpose: input.purpose,
        organizationalScope: input.organizationalScope,
        evaluation,
      });
    } catch (err) {
      mapAuthzError(err);
    }
  }

  return {
    evaluation,
    payload: toGovernedRetrievalPayload(
      evaluation,
      child.subjectIds,
      decisionId,
    ),
    subjectIds: safeSubjectIds(evaluation, child.subjectIds),
  };
}
