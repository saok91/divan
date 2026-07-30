/**
 * Decision publication persistence (Story 7.6 / FR-54).
 * Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
 * Schema: reporting (alongside export_artifact; distinct product).
 */

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "@divan/db";

import type {
  PublicationNoticeKind,
  PublicationStatus,
  ReproducibilityState,
} from "./decision-publication-permissions";

export type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DecisionPublicationRecord = {
  id: string;
  reportKey: string;
  reportVersion: string;
  metricVersion: string;
  snapshotHash: string;
  snapshotRef: JsonValue;
  filtersSnapshot: JsonValue;
  evaluationMode: "current" | "as_of";
  asOfDate: string | null;
  publishedAt: string;
  publisherAccountId: string;
  permittedAudience: string[];
  status: PublicationStatus;
  reproducibilityState: ReproducibilityState;
  correlationId: string;
  sourceExportArtifactId: string | null;
  hasSupersessionNotice: boolean;
  /** Story 7.7 — controlling AR version refs at publish time (additive). */
  controllingArtifactVersions: JsonValue;
  createdAt: string;
};

export type PublicationNoticeRecord = {
  id: string;
  publicationId: string;
  noticeKind: PublicationNoticeKind;
  triggerRefType: string;
  triggerRefId: string;
  note: string | null;
  createdAt: string;
  actorAccountId: string;
  correlationId: string;
};

export type ReproducibilityPackageRecord = {
  id: string;
  publicationId: string;
  packageKind: string;
  contentHash: string;
  retentionClass: string;
  packageMetadata: JsonValue;
  createdAt: string;
  disposedAt: string | null;
  disposalRunId: string | null;
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

function mapPublicationRow(
  row: Record<string, unknown>,
): DecisionPublicationRecord {
  return {
    id: String(row.id),
    reportKey: String(row.report_key),
    reportVersion: String(row.report_version),
    metricVersion: String(row.metric_version),
    snapshotHash: String(row.snapshot_hash),
    snapshotRef: parseJson(row.snapshot_ref),
    filtersSnapshot: parseJson(row.filters_snapshot),
    evaluationMode: row.evaluation_mode as "current" | "as_of",
    asOfDate: row.as_of_date == null ? null : String(row.as_of_date).slice(0, 10),
    publishedAt: new Date(String(row.published_at)).toISOString(),
    publisherAccountId: String(row.publisher_account_id),
    permittedAudience: asStringArray(parseJson(row.permitted_audience)),
    status: row.status as PublicationStatus,
    reproducibilityState: row.reproducibility_state as ReproducibilityState,
    correlationId: String(row.correlation_id),
    sourceExportArtifactId:
      row.source_export_artifact_id == null
        ? null
        : String(row.source_export_artifact_id),
    hasSupersessionNotice: Boolean(row.has_supersession_notice),
    controllingArtifactVersions: parseJson(
      row.controlling_artifact_versions ?? [],
    ),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapNoticeRow(row: Record<string, unknown>): PublicationNoticeRecord {
  return {
    id: String(row.id),
    publicationId: String(row.publication_id),
    noticeKind: row.notice_kind as PublicationNoticeKind,
    triggerRefType: String(row.trigger_ref_type),
    triggerRefId: String(row.trigger_ref_id),
    note: row.note == null ? null : String(row.note),
    createdAt: new Date(String(row.created_at)).toISOString(),
    actorAccountId: String(row.actor_account_id),
    correlationId: String(row.correlation_id),
  };
}

function mapPackageRow(
  row: Record<string, unknown>,
): ReproducibilityPackageRecord {
  return {
    id: String(row.id),
    publicationId: String(row.publication_id),
    packageKind: String(row.package_kind),
    contentHash: String(row.content_hash),
    retentionClass: String(row.retention_class),
    packageMetadata: parseJson(row.package_metadata),
    createdAt: new Date(String(row.created_at)).toISOString(),
    disposedAt:
      row.disposed_at == null
        ? null
        : new Date(String(row.disposed_at)).toISOString(),
    disposalRunId:
      row.disposal_run_id == null ? null : String(row.disposal_run_id),
  };
}

const PUBLICATION_COLS = `
  id, report_key, report_version, metric_version, snapshot_hash, snapshot_ref,
  filters_snapshot, evaluation_mode, as_of_date, published_at, publisher_account_id,
  permitted_audience, status, reproducibility_state, correlation_id,
  source_export_artifact_id, has_supersession_notice,
  COALESCE(controlling_artifact_versions, '[]'::jsonb) AS controlling_artifact_versions,
  created_at
`;

const NOTICE_COLS = `
  id, publication_id, notice_kind, trigger_ref_type, trigger_ref_id, note,
  created_at, actor_account_id, correlation_id
`;

const PACKAGE_COLS = `
  id, publication_id, package_kind, content_hash, retention_class, package_metadata,
  created_at, disposed_at, disposal_run_id
`;

export async function insertDecisionPublication(
  db: PgQueryable,
  input: {
    reportKey: string;
    reportVersion: string;
    metricVersion: string;
    snapshotHash: string;
    snapshotRef: JsonValue;
    filtersSnapshot: JsonValue;
    evaluationMode: "current" | "as_of";
    asOfDate?: string | null;
    publisherAccountId: string;
    permittedAudience: readonly string[];
    correlationId: string;
    sourceExportArtifactId?: string | null;
    controllingArtifactVersions?: JsonValue;
  },
): Promise<DecisionPublicationRecord> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO reporting.decision_publication (
       id, report_key, report_version, metric_version, snapshot_hash, snapshot_ref,
       filters_snapshot, evaluation_mode, as_of_date, publisher_account_id,
       permitted_audience, status, reproducibility_state, correlation_id,
       source_export_artifact_id, controlling_artifact_versions
     ) VALUES (
       $1::uuid, $2, $3, $4, $5, $6::jsonb,
       $7::jsonb, $8, $9::date, $10,
       $11::jsonb, 'published', 'reproducible', $12::uuid,
       $13, $14::jsonb
     )
     RETURNING ${PUBLICATION_COLS}`,
    [
      id,
      input.reportKey,
      input.reportVersion,
      input.metricVersion,
      input.snapshotHash,
      JSON.stringify(input.snapshotRef ?? {}),
      JSON.stringify(input.filtersSnapshot),
      input.evaluationMode,
      input.asOfDate ?? null,
      input.publisherAccountId,
      JSON.stringify([...input.permittedAudience]),
      input.correlationId,
      input.sourceExportArtifactId ?? null,
      JSON.stringify(input.controllingArtifactVersions ?? []),
    ],
  );
  return mapPublicationRow(result.rows[0] as Record<string, unknown>);
}

export async function getDecisionPublicationById(
  db: PgQueryable,
  id: string,
): Promise<DecisionPublicationRecord | null> {
  const result = await db.query(
    `SELECT ${PUBLICATION_COLS}
     FROM reporting.decision_publication
     WHERE id = $1::uuid`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return mapPublicationRow(result.rows[0] as Record<string, unknown>);
}

export async function decisionPublicationExists(
  db: PgQueryable,
  id: string,
): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 AS ok FROM reporting.decision_publication WHERE id = $1::uuid`,
    [id],
  );
  return result.rows.length > 0;
}

export async function listDecisionPublications(
  db: PgQueryable,
  input?: {
    reportKey?: string;
    limit?: number;
  },
): Promise<DecisionPublicationRecord[]> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  if (input?.reportKey) {
    const result = await db.query(
      `SELECT ${PUBLICATION_COLS}
       FROM reporting.decision_publication
       WHERE report_key = $1
       ORDER BY published_at DESC
       LIMIT $2`,
      [input.reportKey, limit],
    );
    return result.rows.map((r) =>
      mapPublicationRow(r as Record<string, unknown>),
    );
  }
  const result = await db.query(
    `SELECT ${PUBLICATION_COLS}
     FROM reporting.decision_publication
     ORDER BY published_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((r) =>
    mapPublicationRow(r as Record<string, unknown>),
  );
}

/**
 * Allowed lifecycle UPDATE only — status / reproducibility_state / has_supersession_notice.
 * Decision-defining columns are blocked by DB trigger.
 */
export async function updatePublicationLifecycle(
  db: PgQueryable,
  input: {
    id: string;
    status?: PublicationStatus;
    reproducibilityState?: ReproducibilityState;
    hasSupersessionNotice?: boolean;
    expectedStatus?: PublicationStatus;
  },
): Promise<DecisionPublicationRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (input.status !== undefined) {
    sets.push(`status = $${i++}`);
    params.push(input.status);
  }
  if (input.reproducibilityState !== undefined) {
    sets.push(`reproducibility_state = $${i++}`);
    params.push(input.reproducibilityState);
  }
  if (input.hasSupersessionNotice !== undefined) {
    sets.push(`has_supersession_notice = $${i++}`);
    params.push(input.hasSupersessionNotice);
  }
  if (sets.length === 0) {
    return getDecisionPublicationById(db, input.id);
  }

  params.push(input.id);
  const idParam = `$${i++}`;
  let where = `id = ${idParam}::uuid`;
  if (input.expectedStatus) {
    params.push(input.expectedStatus);
    where += ` AND status = $${i++}`;
  }

  const result = await db.query(
    `UPDATE reporting.decision_publication
     SET ${sets.join(", ")}
     WHERE ${where}
     RETURNING ${PUBLICATION_COLS}`,
    params,
  );
  if (result.rows.length === 0) return null;
  return mapPublicationRow(result.rows[0] as Record<string, unknown>);
}

export async function insertPublicationNotice(
  db: PgQueryable,
  input: {
    publicationId: string;
    noticeKind: PublicationNoticeKind;
    triggerRefType: string;
    triggerRefId: string;
    note?: string | null;
    actorAccountId: string;
    correlationId: string;
  },
): Promise<PublicationNoticeRecord> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO reporting.publication_notice (
       id, publication_id, notice_kind, trigger_ref_type, trigger_ref_id,
       note, actor_account_id, correlation_id
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::uuid
     )
     RETURNING ${NOTICE_COLS}`,
    [
      id,
      input.publicationId,
      input.noticeKind,
      input.triggerRefType,
      input.triggerRefId,
      input.note ?? null,
      input.actorAccountId,
      input.correlationId,
    ],
  );
  return mapNoticeRow(result.rows[0] as Record<string, unknown>);
}

export async function listPublicationNotices(
  db: PgQueryable,
  publicationId: string,
): Promise<PublicationNoticeRecord[]> {
  const result = await db.query(
    `SELECT ${NOTICE_COLS}
     FROM reporting.publication_notice
     WHERE publication_id = $1::uuid
     ORDER BY created_at ASC`,
    [publicationId],
  );
  return result.rows.map((r) => mapNoticeRow(r as Record<string, unknown>));
}

export async function insertLifecycleEvent(
  db: PgQueryable,
  input: {
    publicationId: string;
    eventKind: string;
    actorAccountId: string;
    correlationId: string;
    reason?: string | null;
    detailJson?: JsonValue;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO reporting.decision_publication_lifecycle_event (
       id, publication_id, event_kind, actor_account_id, reason, correlation_id, detail_json
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7::jsonb)`,
    [
      randomUUID(),
      input.publicationId,
      input.eventKind,
      input.actorAccountId,
      input.reason ?? null,
      input.correlationId,
      JSON.stringify(input.detailJson ?? {}),
    ],
  );
}

export async function insertReproducibilityPackage(
  db: PgQueryable,
  input: {
    publicationId: string;
    packageKind: string;
    contentHash: string;
    retentionClass: string;
    packageMetadata: JsonValue;
    disposalRunId?: string | null;
  },
): Promise<ReproducibilityPackageRecord> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO reporting.reproducibility_package (
       id, publication_id, package_kind, content_hash, retention_class,
       package_metadata, disposal_run_id
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7
     )
     RETURNING ${PACKAGE_COLS}`,
    [
      id,
      input.publicationId,
      input.packageKind,
      input.contentHash,
      input.retentionClass,
      JSON.stringify(input.packageMetadata ?? {}),
      input.disposalRunId ?? null,
    ],
  );
  return mapPackageRow(result.rows[0] as Record<string, unknown>);
}

export async function clearPackageBytesForPublication(
  db: PgQueryable,
  publicationId: string,
): Promise<void> {
  await db.query(
    `UPDATE reporting.reproducibility_package
     SET content_bytes = NULL,
         disposed_at = CURRENT_TIMESTAMP
     WHERE publication_id = $1::uuid
       AND disposed_at IS NULL`,
    [publicationId],
  );
}

export async function getReproducibilityPackage(
  db: PgQueryable,
  publicationId: string,
): Promise<ReproducibilityPackageRecord | null> {
  const result = await db.query(
    `SELECT ${PACKAGE_COLS}
     FROM reporting.reproducibility_package
     WHERE publication_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 1`,
    [publicationId],
  );
  if (result.rows.length === 0) return null;
  return mapPackageRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Publications still claiming reproducibility that may intersect disposal scope.
 * MVP intersection: optional report_key filter; otherwise all reproducible claims.
 */
export async function listReproduciblePublicationsForDisposal(
  db: PgQueryable,
  input?: { reportKey?: string },
): Promise<DecisionPublicationRecord[]> {
  if (input?.reportKey) {
    const result = await db.query(
      `SELECT ${PUBLICATION_COLS}
       FROM reporting.decision_publication
       WHERE reproducibility_state = 'reproducible'
         AND report_key = $1
       ORDER BY published_at ASC`,
      [input.reportKey],
    );
    return result.rows.map((r) =>
      mapPublicationRow(r as Record<string, unknown>),
    );
  }
  const result = await db.query(
    `SELECT ${PUBLICATION_COLS}
     FROM reporting.decision_publication
     WHERE reproducibility_state = 'reproducible'
     ORDER BY published_at ASC`,
  );
  return result.rows.map((r) =>
    mapPublicationRow(r as Record<string, unknown>),
  );
}

/**
 * Find publications whose filters_snapshot may reference a person id (cheap JSON text match).
 * MVP auto-notice scope — ambiguous intersections stay on explicit createNotice API.
 */
export async function listPublicationsIntersectingPerson(
  db: PgQueryable,
  personId: string,
): Promise<DecisionPublicationRecord[]> {
  const result = await db.query(
    `SELECT ${PUBLICATION_COLS}
     FROM reporting.decision_publication
     WHERE filters_snapshot::text LIKE '%' || $1 || '%'
       AND status IN ('published', 'superseded', 'package_retained')
     ORDER BY published_at DESC
     LIMIT 100`,
    [personId],
  );
  return result.rows.map((r) =>
    mapPublicationRow(r as Record<string, unknown>),
  );
}

export async function listPublicationsByReportKey(
  db: PgQueryable,
  reportKey: string,
): Promise<DecisionPublicationRecord[]> {
  return listDecisionPublications(db, { reportKey, limit: 200 });
}
