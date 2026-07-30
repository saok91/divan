/**
 * Export artifact persistence (Story 6.5 / FR-41 / FR-52).
 * Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
 * Schema: reporting (Export lives in reporting BC).
 */

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "@divan/db";

export type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type ExportSourceSurface = "report" | "personnel_list";
export type ExportFormat = "csv" | "xlsx";
export type ExportArtifactState =
  | "pending"
  | "ready"
  | "expired"
  | "revoked"
  | "disposed";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ExportArtifactRecord = {
  id: string;
  ownerAccountId: string;
  purpose: string;
  classification: string;
  classificationFa: string;
  handlingFa: string;
  scopeJson: JsonValue;
  fieldIds: string[];
  sourceSurface: ExportSourceSurface;
  sourceKey: string | null;
  filtersSnapshot: JsonValue;
  snapshotHash: string;
  format: ExportFormat;
  state: ExportArtifactState;
  createdAt: string;
  expiresAt: string;
  rowCount: number;
  requiresCustodyAck: boolean;
  hasSensitiveFields: boolean;
  correlationId: string;
  contentFilename: string | null;
  populationAuthzMode: string | null;
  /** Story 7.8 — shared authoritative evaluation snapshot ref (nullable). */
  evaluationSnapshotId: string | null;
};

export type ExportArtifactWithBytes = ExportArtifactRecord & {
  contentBytes: Buffer | null;
};

export type ExportRetrievalRecord = {
  id: string;
  artifactId: string;
  retrieverAccountId: string;
  retrievedAt: string;
  recipient: string;
  destinationClass: string;
  custodyAckAt: string | null;
  reauthReason: string;
  reauthOutcome: "allowed" | "denied";
  correlationId: string;
};

function parseJson(value: unknown): JsonValue {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as JsonValue;
    } catch {
      return value;
    }
  }
  return value as JsonValue;
}

function asStringArray(value: JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function mapArtifactRow(
  row: Record<string, unknown>,
  includeBytes: boolean,
): ExportArtifactRecord | ExportArtifactWithBytes {
  const fieldIds = asStringArray(parseJson(row.field_ids));
  const base: ExportArtifactRecord = {
    id: String(row.id),
    ownerAccountId: String(row.owner_account_id),
    purpose: String(row.purpose),
    classification: String(row.classification),
    classificationFa: String(row.classification_fa),
    handlingFa: String(row.handling_fa),
    scopeJson: parseJson(row.scope_json),
    fieldIds,
    sourceSurface: row.source_surface as ExportSourceSurface,
    sourceKey: row.source_key == null ? null : String(row.source_key),
    filtersSnapshot: parseJson(row.filters_snapshot),
    snapshotHash: String(row.snapshot_hash),
    format: row.format as ExportFormat,
    state: row.state as ExportArtifactState,
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    rowCount: Number(row.row_count) || 0,
    requiresCustodyAck: Boolean(row.requires_custody_ack),
    hasSensitiveFields: Boolean(row.has_sensitive_fields),
    correlationId: String(row.correlation_id),
    contentFilename:
      row.content_filename == null ? null : String(row.content_filename),
    populationAuthzMode:
      row.population_authz_mode == null
        ? null
        : String(row.population_authz_mode),
    evaluationSnapshotId:
      row.evaluation_snapshot_id == null
        ? null
        : String(row.evaluation_snapshot_id),
  };
  if (!includeBytes) return base;
  const bytes = row.content_bytes;
  return {
    ...base,
    contentBytes: bytes == null ? null : Buffer.from(bytes as Uint8Array),
  };
}

const ARTIFACT_COLS = `
  id, owner_account_id, purpose, classification, classification_fa, handling_fa,
  scope_json, field_ids, source_surface, source_key, filters_snapshot, snapshot_hash,
  format, state, created_at, expires_at, row_count, requires_custody_ack,
  has_sensitive_fields, correlation_id, content_filename, population_authz_mode,
  evaluation_snapshot_id
`;

export async function insertExportArtifact(
  db: PgQueryable,
  input: {
    ownerAccountId: string;
    purpose: string;
    classification: string;
    classificationFa: string;
    handlingFa: string;
    scopeJson: JsonValue;
    fieldIds: readonly string[];
    sourceSurface: ExportSourceSurface;
    sourceKey?: string | null;
    filtersSnapshot: JsonValue;
    snapshotHash: string;
    format: ExportFormat;
    expiresAt: Date;
    rowCount: number;
    requiresCustodyAck: boolean;
    hasSensitiveFields: boolean;
    correlationId: string;
    contentBytes: Buffer;
    contentFilename: string;
    populationAuthzMode?: string | null;
    evaluationSnapshotId?: string | null;
  },
): Promise<ExportArtifactRecord> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO reporting.export_artifact (
       id, owner_account_id, purpose, classification, classification_fa, handling_fa,
       scope_json, field_ids, source_surface, source_key, filters_snapshot, snapshot_hash,
       format, state, expires_at, row_count, requires_custody_ack, has_sensitive_fields,
       correlation_id, content_bytes, content_filename, population_authz_mode,
       evaluation_snapshot_id
     ) VALUES (
       $1::uuid, $2, $3, $4, $5, $6,
       $7::jsonb, $8::jsonb, $9, $10, $11::jsonb, $12,
       $13, 'ready', $14, $15, $16, $17,
       $18::uuid, $19, $20, $21, $22::uuid
     )
     RETURNING ${ARTIFACT_COLS}`,
    [
      id,
      input.ownerAccountId,
      input.purpose,
      input.classification,
      input.classificationFa,
      input.handlingFa,
      JSON.stringify(input.scopeJson),
      JSON.stringify([...input.fieldIds]),
      input.sourceSurface,
      input.sourceKey ?? null,
      JSON.stringify(input.filtersSnapshot),
      input.snapshotHash,
      input.format,
      input.expiresAt.toISOString(),
      input.rowCount,
      input.requiresCustodyAck,
      input.hasSensitiveFields,
      input.correlationId,
      input.contentBytes,
      input.contentFilename,
      input.populationAuthzMode ?? null,
      input.evaluationSnapshotId ?? null,
    ],
  );
  return mapArtifactRow(result.rows[0] as Record<string, unknown>, false);
}

export async function getExportArtifactById(
  db: PgQueryable,
  artifactId: string,
): Promise<ExportArtifactRecord | null> {
  const result = await db.query(
    `SELECT ${ARTIFACT_COLS}
     FROM reporting.export_artifact
     WHERE id = $1::uuid`,
    [artifactId],
  );
  if (result.rows.length === 0) return null;
  return mapArtifactRow(result.rows[0] as Record<string, unknown>, false);
}

export async function getExportArtifactWithBytes(
  db: PgQueryable,
  artifactId: string,
): Promise<ExportArtifactWithBytes | null> {
  const result = await db.query(
    `SELECT ${ARTIFACT_COLS}, content_bytes
     FROM reporting.export_artifact
     WHERE id = $1::uuid`,
    [artifactId],
  );
  if (result.rows.length === 0) return null;
  return mapArtifactRow(
    result.rows[0] as Record<string, unknown>,
    true,
  ) as ExportArtifactWithBytes;
}

export async function updateExportArtifactState(
  db: PgQueryable,
  artifactId: string,
  state: ExportArtifactState,
  opts?: { clearContent?: boolean },
): Promise<ExportArtifactRecord | null> {
  const result = opts?.clearContent
    ? await db.query(
        `UPDATE reporting.export_artifact
         SET state = $2, content_bytes = NULL, content_filename = NULL
         WHERE id = $1::uuid
         RETURNING ${ARTIFACT_COLS}`,
        [artifactId, state],
      )
    : await db.query(
        `UPDATE reporting.export_artifact
         SET state = $2
         WHERE id = $1::uuid
         RETURNING ${ARTIFACT_COLS}`,
        [artifactId, state],
      );
  if (result.rows.length === 0) return null;
  return mapArtifactRow(result.rows[0] as Record<string, unknown>, false);
}

/**
 * Run work in a single DB transaction when `db` is a Pool with `connect`.
 * PoolClient / mocks without connect run inline (no nested BEGIN).
 */
export async function withPgTransaction<T>(
  db: PgQueryable,
  fn: (client: PgQueryable) => Promise<T>,
): Promise<T> {
  const maybePool = db as Pool;
  if (typeof maybePool.connect !== "function") {
    return fn(db);
  }
  const client = await maybePool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function insertLifecycleEvent(
  db: PgQueryable,
  input: {
    artifactId: string;
    eventKind:
      | "created"
      | "ready"
      | "revoked"
      | "disposed"
      | "expired"
      | "download_denied";
    actorAccountId: string;
    reason?: string | null;
    correlationId: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO reporting.export_artifact_lifecycle_event (
       id, artifact_id, event_kind, actor_account_id, reason, correlation_id
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)`,
    [
      randomUUID(),
      input.artifactId,
      input.eventKind,
      input.actorAccountId,
      input.reason ?? null,
      input.correlationId,
    ],
  );
}

export async function insertRetrieval(
  db: PgQueryable,
  input: {
    artifactId: string;
    retrieverAccountId: string;
    recipient: string;
    destinationClass: string;
    custodyAckAt: Date | null;
    reauthReason: string;
    reauthOutcome: "allowed" | "denied";
    correlationId: string;
  },
): Promise<ExportRetrievalRecord> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO reporting.export_artifact_retrieval (
       id, artifact_id, retriever_account_id, recipient, destination_class,
       custody_ack_at, reauth_reason, reauth_outcome, correlation_id
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5,
       $6, $7, $8, $9::uuid
     )
     RETURNING id, artifact_id, retriever_account_id, retrieved_at, recipient,
       destination_class, custody_ack_at, reauth_reason, reauth_outcome, correlation_id`,
    [
      id,
      input.artifactId,
      input.retrieverAccountId,
      input.recipient,
      input.destinationClass,
      input.custodyAckAt?.toISOString() ?? null,
      input.reauthReason,
      input.reauthOutcome,
      input.correlationId,
    ],
  );
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id),
    retrieverAccountId: String(row.retriever_account_id),
    retrievedAt: new Date(String(row.retrieved_at)).toISOString(),
    recipient: String(row.recipient),
    destinationClass: String(row.destination_class),
    custodyAckAt:
      row.custody_ack_at == null
        ? null
        : new Date(String(row.custody_ack_at)).toISOString(),
    reauthReason: String(row.reauth_reason),
    reauthOutcome: row.reauth_outcome as "allowed" | "denied",
    correlationId: String(row.correlation_id),
  };
}

export async function listRetrievalsForArtifact(
  db: PgQueryable,
  artifactId: string,
): Promise<ExportRetrievalRecord[]> {
  const result = await db.query(
    `SELECT id, artifact_id, retriever_account_id, retrieved_at, recipient,
            destination_class, custody_ack_at, reauth_reason, reauth_outcome, correlation_id
     FROM reporting.export_artifact_retrieval
     WHERE artifact_id = $1::uuid
     ORDER BY retrieved_at ASC`,
    [artifactId],
  );
  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      artifactId: String(r.artifact_id),
      retrieverAccountId: String(r.retriever_account_id),
      retrievedAt: new Date(String(r.retrieved_at)).toISOString(),
      recipient: String(r.recipient),
      destinationClass: String(r.destination_class),
      custodyAckAt:
        r.custody_ack_at == null
          ? null
          : new Date(String(r.custody_ack_at)).toISOString(),
      reauthReason: String(r.reauth_reason),
      reauthOutcome: r.reauth_outcome as "allowed" | "denied",
      correlationId: String(r.correlation_id),
    };
  });
}
