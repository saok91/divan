/**
 * Evaluation snapshot persistence (Story 7.8 / FR-56).
 * Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
 * Schema: governance.evaluation_snapshot.
 */

import type { Pool, PoolClient } from "pg";

import type {
  AuthoritativeEvaluationSnapshot,
  EvaluationSnapshotAttribution,
  EvaluationSnapshotBoundRefs,
  EvaluationSnapshotKind,
  EvaluationSnapshotStatus,
} from "./evaluation-snapshot-permissions";

export type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

function asIso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function asIsoOrNull(value: unknown): string | null {
  if (value == null) return null;
  return asIso(value);
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function mapEvaluationSnapshotRow(
  row: Record<string, unknown>,
): AuthoritativeEvaluationSnapshot {
  const attribution = asJsonObject(row.attribution) as EvaluationSnapshotAttribution;
  const boundRaw = row.bound_refs;
  const boundRefs =
    boundRaw == null
      ? null
      : (asJsonObject(boundRaw) as EvaluationSnapshotBoundRefs);
  const opRaw = row.operation_ref;
  return {
    id: String(row.id),
    kind: String(row.kind) as EvaluationSnapshotKind,
    contentFingerprint: String(row.content_fingerprint),
    attribution: {
      actorAccountId: String(attribution.actorAccountId ?? ""),
      permissionFingerprint:
        attribution.permissionFingerprint != null
          ? String(attribution.permissionFingerprint)
          : null,
      asOf: attribution.asOf != null ? String(attribution.asOf) : null,
      buildRef:
        attribution.buildRef != null ? String(attribution.buildRef) : null,
    },
    boundRefs,
    createdAt: asIso(row.created_at),
    correlationId: String(row.correlation_id),
    status: String(row.status) as EvaluationSnapshotStatus,
    expiresAt: asIsoOrNull(row.expires_at),
    operationRef: opRaw == null ? null : asJsonObject(opRaw),
  };
}

export async function insertEvaluationSnapshot(
  db: PgQueryable,
  input: {
    id: string;
    kind: EvaluationSnapshotKind;
    contentFingerprint: string;
    attribution: EvaluationSnapshotAttribution;
    boundRefs?: EvaluationSnapshotBoundRefs | null;
    correlationId: string;
    status?: EvaluationSnapshotStatus;
    expiresAt?: string | null;
    operationRef?: Record<string, unknown> | null;
  },
): Promise<AuthoritativeEvaluationSnapshot> {
  const res = await db.query(
    `INSERT INTO governance.evaluation_snapshot (
       id, kind, content_fingerprint, attribution, bound_refs,
       status, correlation_id, expires_at, operation_ref
     ) VALUES (
       $1::uuid, $2, $3, $4::jsonb, $5::jsonb,
       $6, $7::uuid, $8::timestamptz, $9::jsonb
     )
     RETURNING *`,
    [
      input.id,
      input.kind,
      input.contentFingerprint,
      JSON.stringify(input.attribution),
      input.boundRefs == null ? null : JSON.stringify(input.boundRefs),
      input.status ?? "active",
      input.correlationId,
      input.expiresAt ?? null,
      input.operationRef == null ? null : JSON.stringify(input.operationRef),
    ],
  );
  return mapEvaluationSnapshotRow(res.rows[0] as Record<string, unknown>);
}

export async function getEvaluationSnapshotById(
  db: PgQueryable,
  id: string,
): Promise<AuthoritativeEvaluationSnapshot | null> {
  const res = await db.query(
    `SELECT * FROM governance.evaluation_snapshot WHERE id = $1::uuid`,
    [id],
  );
  if (res.rows.length === 0) return null;
  return mapEvaluationSnapshotRow(res.rows[0] as Record<string, unknown>);
}

export async function listRecentEvaluationSnapshots(
  db: PgQueryable,
  opts?: { kind?: string; limit?: number },
): Promise<AuthoritativeEvaluationSnapshot[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
  const res = opts?.kind
    ? await db.query(
        `SELECT * FROM governance.evaluation_snapshot
         WHERE kind = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [opts.kind, limit],
      )
    : await db.query(
        `SELECT * FROM governance.evaluation_snapshot
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit],
      );
  return (res.rows as Record<string, unknown>[]).map(mapEvaluationSnapshotRow);
}

export async function updateEvaluationSnapshotStatus(
  db: PgQueryable,
  id: string,
  status: EvaluationSnapshotStatus,
  operationRef?: Record<string, unknown> | null,
): Promise<AuthoritativeEvaluationSnapshot | null> {
  const res = await db.query(
    `UPDATE governance.evaluation_snapshot
     SET status = $2,
         operation_ref = COALESCE($3::jsonb, operation_ref)
     WHERE id = $1::uuid
       AND status = 'active'
     RETURNING *`,
    [
      id,
      status,
      operationRef == null ? null : JSON.stringify(operationRef),
    ],
  );
  if (res.rows.length === 0) return null;
  return mapEvaluationSnapshotRow(res.rows[0] as Record<string, unknown>);
}

export async function countEvaluationSnapshotByStatus(
  db: PgQueryable,
): Promise<Record<string, number>> {
  const res = await db.query(
    `SELECT status, COUNT(*)::int AS c
     FROM governance.evaluation_snapshot
     GROUP BY status`,
  );
  const out: Record<string, number> = {};
  for (const row of res.rows as Array<{ status: string; c: number }>) {
    out[row.status] = row.c;
  }
  return out;
}
