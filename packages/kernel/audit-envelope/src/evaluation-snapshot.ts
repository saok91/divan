/**
 * Authoritative evaluation snapshot orchestration (Story 7.8 / FR-56).
 * One attributable validated snapshot/version per authoritative op — or fail.
 * Bind is system-side after domain authorize; not a substitute for domain perms.
 */

import { randomUUID } from "node:crypto";

import { appendAccessEvent, withTransaction } from "@divan/event-store";
import type { Pool, PoolClient } from "pg";

import {
  assertAuditTrustWriterAllowed,
  enforceClockAnomalyOrThrow,
} from "./audit-trust-gate";
import { computeContentFingerprint } from "./evaluation-snapshot-hash";
import {
  EvaluationSnapshotError,
  MSG_EVAL_SNAPSHOT_EXPIRED_FA,
  MSG_EVAL_SNAPSHOT_MISMATCH_FA,
  MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
  MSG_EVAL_SNAPSHOT_PERMISSION_CHANGED_FA,
  MSG_EVAL_SNAPSHOT_REF_CHANGED_FA,
  MSG_EVAL_SNAPSHOT_STALE_FA,
  MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
} from "./evaluation-snapshot-errors";
import type {
  AuthoritativeEvaluationSnapshot,
  BeginEvaluationSnapshotInput,
  BindOperationToSnapshotInput,
  EvaluationSnapshotBindResult,
  EvaluationSnapshotConflict,
  EvaluationSnapshotStatus,
} from "./evaluation-snapshot-permissions";
import * as repo from "./evaluation-snapshot-repo";

export * from "./evaluation-snapshot-errors";
export * from "./evaluation-snapshot-permissions";
export {
  computeContentFingerprint,
  stableStringify,
} from "./evaluation-snapshot-hash";
export type { PgQueryable } from "./evaluation-snapshot-repo";

export type EvaluationSnapshotDb = repo.PgQueryable;

function isExpired(
  snap: AuthoritativeEvaluationSnapshot,
  nowMs: number = Date.now(),
): boolean {
  if (snap.status === "expired") return true;
  if (!snap.expiresAt) return false;
  const t = Date.parse(snap.expiresAt);
  if (Number.isNaN(t)) return true;
  return t < nowMs;
}

function isPool(db: EvaluationSnapshotDb): db is Pool {
  return typeof (db as Pool).connect === "function";
}

async function runOnQueryable<T>(
  db: EvaluationSnapshotDb,
  fn: (client: EvaluationSnapshotDb) => Promise<T>,
): Promise<T> {
  if (isPool(db)) {
    return withTransaction(db, fn);
  }
  return fn(db);
}

/**
 * Begin an attributable evaluation snapshot.
 * Fingerprint = contentFingerprint override OR SHA-256(stableStringify(payload)).
 * Finalize may set persist:false (TX-local + audit metadata).
 * Required bind paths honor audit-trust suspend (fail-closed).
 */
export async function beginEvaluationSnapshot(
  db: EvaluationSnapshotDb | null,
  input: BeginEvaluationSnapshotInput,
): Promise<AuthoritativeEvaluationSnapshot> {
  const persist = input.persist !== false;
  const contentFingerprint =
    input.contentFingerprint?.trim() ||
    computeContentFingerprint(input.payload);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const snap: AuthoritativeEvaluationSnapshot = {
    id,
    kind: input.kind,
    contentFingerprint,
    attribution: {
      actorAccountId: input.attribution.actorAccountId,
      permissionFingerprint:
        input.attribution.permissionFingerprint ?? null,
      asOf: input.attribution.asOf ?? null,
      buildRef: input.attribution.buildRef ?? null,
    },
    boundRefs: input.boundRefs ?? null,
    createdAt,
    correlationId: input.correlationId,
    status: "active",
    expiresAt: input.expiresAt ?? null,
    operationRef: null,
  };

  if (!persist) {
    return snap;
  }
  if (!db) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_NOT_FOUND",
      MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
      { reason: "db_required_for_persist" },
    );
  }

  await assertAuditTrustWriterAllowed(db as Pool | PoolClient, {
    correlationId: input.correlationId,
    permission: "evaluation.snapshot.bind",
  });
  await enforceClockAnomalyOrThrow(db as Pool | PoolClient, {
    correlationId: input.correlationId,
    actorAccountId: input.attribution.actorAccountId,
    permission: "evaluation.snapshot.bind",
  });

  // Insert + required access event must be atomic — no orphan active row
  // without evidence when append fails.
  return runOnQueryable(db, async (client) => {
    const inserted = await repo.insertEvaluationSnapshot(client, {
      id,
      kind: input.kind,
      contentFingerprint,
      attribution: snap.attribution,
      boundRefs: snap.boundRefs,
      correlationId: input.correlationId,
      status: "active",
      expiresAt: input.expiresAt ?? null,
    });

    await appendAccessEvent(client, {
      correlationId: input.correlationId,
      actorAccountId: input.attribution.actorAccountId,
      operation: "evaluation.snapshot.bind",
      scope: {
        kind: input.kind,
        snapshotId: inserted.id,
        contentFingerprint: inserted.contentFingerprint,
      },
      result: "allow",
      entityType: "evaluation_snapshot",
      entityId: inserted.id,
      payload: {
        kind: input.kind,
        status: inserted.status,
      },
    });

    return inserted;
  });
}

/**
 * Assert two snapshots share the same content fingerprint (and optionally id).
 * Throws EVAL_SNAPSHOT_MISMATCH / VERSION_MIX — adapters may bridge to domain codes.
 */
export function assertSameEvaluationSnapshot(
  expected: Pick<AuthoritativeEvaluationSnapshot, "contentFingerprint" | "id" | "kind">,
  liveOrRecomputed: Pick<
    AuthoritativeEvaluationSnapshot,
    "contentFingerprint" | "id" | "kind"
  > & { id?: string },
): void {
  if (
    expected.kind &&
    liveOrRecomputed.kind &&
    expected.kind !== liveOrRecomputed.kind
  ) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_VERSION_MIX",
      MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
      {
        expectedKind: String(expected.kind),
        liveKind: String(liveOrRecomputed.kind),
      },
    );
  }
  if (expected.contentFingerprint !== liveOrRecomputed.contentFingerprint) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_MISMATCH",
      MSG_EVAL_SNAPSHOT_MISMATCH_FA,
      {
        expected: expected.contentFingerprint,
        live: liveOrRecomputed.contentFingerprint,
      },
    );
  }
  if (
    liveOrRecomputed.id &&
    expected.id &&
    liveOrRecomputed.id !== expected.id
  ) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_VERSION_MIX",
      MSG_EVAL_SNAPSHOT_VERSION_MIX_FA,
      { expectedId: expected.id, liveId: liveOrRecomputed.id },
    );
  }
}

/**
 * Compare fingerprints as strings (export reviewed hash vs recomputed).
 * Shared helper — adapters translate to SNAPSHOT_MISMATCH / PUBLICATION_*.
 */
export function assertEvaluationFingerprintMatch(
  expected: string,
  live: string,
): void {
  if (expected !== live) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_MISMATCH",
      MSG_EVAL_SNAPSHOT_MISMATCH_FA,
      { expected, live },
    );
  }
}

/**
 * Revalidate a persisted snapshot: existence, expiry, optional live fingerprint,
 * permission fingerprint, and bound-ref stamp equality.
 */
export async function revalidateEvaluationSnapshot(
  db: EvaluationSnapshotDb,
  handle: { id: string } | AuthoritativeEvaluationSnapshot,
  ctx?: {
    liveFingerprint?: string;
    permissionFingerprint?: string | null;
    boundRefs?: Record<string, unknown> | null;
    nowMs?: number;
  },
): Promise<{ ok: true; snapshot: AuthoritativeEvaluationSnapshot } | EvaluationSnapshotConflict> {
  const id = handle.id;
  const snap =
    "contentFingerprint" in handle && "status" in handle
      ? (handle as AuthoritativeEvaluationSnapshot)
      : await repo.getEvaluationSnapshotById(db, id);

  if (!snap) {
    return {
      code: "EVAL_SNAPSHOT_NOT_FOUND",
      messageFa: MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
    };
  }
  if (snap.status !== "active") {
    if (snap.status === "expired" || isExpired(snap, ctx?.nowMs)) {
      return {
        code: "EVAL_SNAPSHOT_EXPIRED",
        messageFa: MSG_EVAL_SNAPSHOT_EXPIRED_FA,
      };
    }
    return {
      code: "EVAL_SNAPSHOT_STALE",
      messageFa: MSG_EVAL_SNAPSHOT_STALE_FA,
    };
  }
  if (isExpired(snap, ctx?.nowMs)) {
    return {
      code: "EVAL_SNAPSHOT_EXPIRED",
      messageFa: MSG_EVAL_SNAPSHOT_EXPIRED_FA,
    };
  }
  if (
    ctx?.liveFingerprint != null &&
    ctx.liveFingerprint !== snap.contentFingerprint
  ) {
    return {
      code: "EVAL_SNAPSHOT_MISMATCH",
      messageFa: MSG_EVAL_SNAPSHOT_MISMATCH_FA,
      expectedFingerprint: snap.contentFingerprint,
      liveFingerprint: ctx.liveFingerprint,
    };
  }
  if (
    ctx?.permissionFingerprint != null &&
    snap.attribution.permissionFingerprint != null &&
    ctx.permissionFingerprint !== snap.attribution.permissionFingerprint
  ) {
    return {
      code: "EVAL_SNAPSHOT_PERMISSION_CHANGED",
      messageFa: MSG_EVAL_SNAPSHOT_PERMISSION_CHANGED_FA,
    };
  }
  if (ctx?.boundRefs != null && snap.boundRefs != null) {
    const liveFp = computeContentFingerprint(ctx.boundRefs);
    const boundFp = computeContentFingerprint(snap.boundRefs);
    if (liveFp !== boundFp) {
      return {
        code: "EVAL_SNAPSHOT_REF_CHANGED",
        messageFa: MSG_EVAL_SNAPSHOT_REF_CHANGED_FA,
      };
    }
  }
  return { ok: true, snapshot: snap };
}

/**
 * Stamp operation evidence onto snapshot; optionally mark consumed.
 */
export async function bindOperationToSnapshot(
  db: EvaluationSnapshotDb | null,
  input: BindOperationToSnapshotInput,
): Promise<EvaluationSnapshotBindResult> {
  const operationRef = {
    ...input.operationRef,
    snapshotId: input.snapshot.id,
    contentFingerprint: input.snapshot.contentFingerprint,
    kind: input.snapshot.kind,
  };
  const markConsumed = input.markConsumed === true;

  if (db && input.snapshot.id) {
    const existing = await repo.getEvaluationSnapshotById(db, input.snapshot.id);
    if (!existing) {
      throw new EvaluationSnapshotError(
        "EVAL_SNAPSHOT_NOT_FOUND",
        MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
        { reason: "bind_missing_row" },
      );
    }
    const updated = await repo.updateEvaluationSnapshotStatus(
      db,
      input.snapshot.id,
      markConsumed ? "consumed" : existing.status,
      operationRef,
    );
    if (!updated) {
      throw new EvaluationSnapshotError(
        "EVAL_SNAPSHOT_STALE",
        MSG_EVAL_SNAPSHOT_STALE_FA,
        { reason: "bind_not_active" },
      );
    }
    return {
      snapshot: updated,
      operationRef,
    };
  }

  return {
    snapshot: {
      ...input.snapshot,
      operationRef,
      status: markConsumed ? "consumed" : input.snapshot.status,
    },
    operationRef,
  };
}

/**
 * Best-effort terminal status for orphan cleanup after a failed domain op.
 * Only transitions from `active` (repo guard). Returns null if already terminal.
 */
export async function markEvaluationSnapshotTerminal(
  db: EvaluationSnapshotDb,
  id: string,
  status: Extract<EvaluationSnapshotStatus, "expired" | "superseded">,
  operationRef?: Record<string, unknown> | null,
): Promise<AuthoritativeEvaluationSnapshot | null> {
  return repo.updateEvaluationSnapshotStatus(db, id, status, operationRef ?? null);
}

export async function getEvaluationSnapshot(
  db: EvaluationSnapshotDb,
  id: string,
): Promise<AuthoritativeEvaluationSnapshot> {
  const snap = await repo.getEvaluationSnapshotById(db, id);
  if (!snap) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_NOT_FOUND",
      MSG_EVAL_SNAPSHOT_NOT_FOUND_FA,
    );
  }
  if (isExpired(snap)) {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_EXPIRED",
      MSG_EVAL_SNAPSHOT_EXPIRED_FA,
    );
  }
  if (snap.status !== "active") {
    throw new EvaluationSnapshotError(
      "EVAL_SNAPSHOT_STALE",
      MSG_EVAL_SNAPSHOT_STALE_FA,
      { status: snap.status },
    );
  }
  return snap;
}

export async function listRecentEvaluationSnapshots(
  db: EvaluationSnapshotDb,
  opts?: { kind?: string; limit?: number },
): Promise<AuthoritativeEvaluationSnapshot[]> {
  return repo.listRecentEvaluationSnapshots(db, opts);
}

export async function countEvaluationSnapshotSignals(
  db: EvaluationSnapshotDb,
): Promise<Record<string, number>> {
  return repo.countEvaluationSnapshotByStatus(db);
}

/**
 * Throw EvaluationSnapshotError from a conflict result.
 */
export function throwEvaluationSnapshotConflict(
  conflict: EvaluationSnapshotConflict,
): never {
  const code = conflict.code as
    | "EVAL_SNAPSHOT_MISMATCH"
    | "EVAL_SNAPSHOT_STALE"
    | "EVAL_SNAPSHOT_VERSION_MIX"
    | "EVAL_SNAPSHOT_REF_CHANGED"
    | "EVAL_SNAPSHOT_PERMISSION_CHANGED"
    | "EVAL_SNAPSHOT_EXPIRED"
    | "EVAL_SNAPSHOT_NOT_FOUND";
  throw new EvaluationSnapshotError(code, conflict.messageFa, {
    expected: conflict.expectedFingerprint ?? "",
    live: conflict.liveFingerprint ?? "",
  });
}
