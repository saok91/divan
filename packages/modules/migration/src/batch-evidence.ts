/**
 * Import batch evidence DTO + persistence (Story 6.2 / FR-38).
 */

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "@divan/db";

export type BatchEvidenceActors = {
  uploadedBy: string;
  uploadedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  executedBy: string | null;
  executedAt: string | null;
};

export type BatchEvidenceCounts = {
  rowCount: number;
  createdPersonCount: number;
  createdEventCount: number;
  errorCount: number;
};

export type BatchEvidenceStatus =
  | "cutover-complete"
  | "failed"
  | "rolled-back";

export type ImportBatchEvidence = {
  id: string;
  batchId: string;
  correlationId: string;
  status: BatchEvidenceStatus;
  actors: BatchEvidenceActors;
  counts: BatchEvidenceCounts;
  errors: string[];
  createdRecordIds: string[];
  createdEventIds: string[];
  createdAt: string;
};

type PgQueryable = Pool | PoolClient;

export async function persistBatchEvidence(
  db: PgQueryable,
  input: {
    batchId: string;
    correlationId: string;
    status: BatchEvidenceStatus;
    actors: BatchEvidenceActors;
    counts: BatchEvidenceCounts;
    errors?: string[];
    createdRecordIds?: string[];
    createdEventIds?: string[];
  },
): Promise<ImportBatchEvidence> {
  const id = randomUUID();
  const now = new Date();
  await db.query(
    `INSERT INTO migration_staging.import_batch_evidence (
       id, batch_id, status, actors, counts, errors,
       created_record_ids, created_event_ids, correlation_id, created_at
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4::jsonb, $5::jsonb, $6::jsonb,
       $7::jsonb, $8::jsonb, $9::uuid, $10::timestamptz
     )`,
    [
      id,
      input.batchId,
      input.status,
      JSON.stringify(input.actors),
      JSON.stringify(input.counts),
      JSON.stringify(input.errors ?? []),
      JSON.stringify(input.createdRecordIds ?? []),
      JSON.stringify(input.createdEventIds ?? []),
      input.correlationId,
      now.toISOString(),
    ],
  );
  return {
    id,
    batchId: input.batchId,
    correlationId: input.correlationId,
    status: input.status,
    actors: input.actors,
    counts: input.counts,
    errors: input.errors ?? [],
    createdRecordIds: input.createdRecordIds ?? [],
    createdEventIds: input.createdEventIds ?? [],
    createdAt: now.toISOString(),
  };
}

export async function getLatestBatchEvidence(
  db: PgQueryable,
  batchId: string,
): Promise<ImportBatchEvidence | null> {
  const res = await db.query(
    `SELECT * FROM migration_staging.import_batch_evidence
     WHERE batch_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 1`,
    [batchId],
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    batchId: String(row.batch_id),
    correlationId: String(row.correlation_id),
    status: row.status as BatchEvidenceStatus,
    actors:
      typeof row.actors === "string"
        ? (JSON.parse(row.actors) as BatchEvidenceActors)
        : (row.actors as BatchEvidenceActors),
    counts:
      typeof row.counts === "string"
        ? (JSON.parse(row.counts) as BatchEvidenceCounts)
        : (row.counts as BatchEvidenceCounts),
    errors:
      typeof row.errors === "string"
        ? (JSON.parse(row.errors) as string[])
        : ((row.errors as string[]) ?? []),
    createdRecordIds:
      typeof row.created_record_ids === "string"
        ? (JSON.parse(row.created_record_ids) as string[])
        : ((row.created_record_ids as string[]) ?? []),
    createdEventIds:
      typeof row.created_event_ids === "string"
        ? (JSON.parse(row.created_event_ids) as string[])
        : ((row.created_event_ids as string[]) ?? []),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}
