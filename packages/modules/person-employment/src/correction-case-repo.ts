/**
 * Correction-case persistence (Story 7.5 / FR-53).
 * Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
 * Schema: correction_case. History rows are never DELETE'd.
 */

import { createHash, randomUUID } from "node:crypto";

import type {
  CorrectionCase,
  CorrectionCaseAttachment,
  CorrectionCaseAttachmentInspectionStatus,
  CorrectionCaseDecision,
  CorrectionCaseEvidenceKind,
  CorrectionCaseEvidenceRef,
  CorrectionCaseOutcomeLinkType,
  CorrectionCaseOutcomeLinks,
  CorrectionCaseStatus,
} from "@divan/audit-envelope";
import type { Pool, PoolClient } from "@divan/db";

export type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

function mapCaseRow(row: Record<string, unknown>): CorrectionCase {
  const closure = row.closure_evidence;
  let closureEvidence: Record<string, string> | null = null;
  if (closure != null && typeof closure === "object" && !Array.isArray(closure)) {
    closureEvidence = {};
    for (const [k, v] of Object.entries(closure as Record<string, unknown>)) {
      if (typeof v === "string") closureEvidence[k] = v;
    }
  }
  return {
    id: String(row.id),
    requestReference: String(row.request_reference),
    authorityVerifiedAt: new Date(String(row.authority_verified_at)).toISOString(),
    authorityVerifiedBy: String(row.authority_verified_by),
    personId: String(row.person_id),
    ownerAccountId: String(row.owner_account_id),
    status: String(row.status) as CorrectionCaseStatus,
    breachedAt:
      row.breached_at != null
        ? new Date(String(row.breached_at)).toISOString()
        : null,
    deadlineAt: new Date(String(row.deadline_at)).toISOString(),
    decision:
      row.decision != null
        ? (String(row.decision) as CorrectionCaseDecision)
        : null,
    decisionReason:
      row.decision_reason != null ? String(row.decision_reason) : null,
    closureEvidence,
    correlationId: String(row.correlation_id),
    createdAt: new Date(String(row.created_at)).toISOString(),
    createdBy: String(row.created_by),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    updatedBy: String(row.updated_by),
  };
}

function mapEvidenceRow(row: Record<string, unknown>): CorrectionCaseEvidenceRef {
  const meta = row.metadata;
  const metadata: Record<string, string> = {};
  if (meta != null && typeof meta === "object" && !Array.isArray(meta)) {
    for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
      if (typeof v === "string") metadata[k] = v;
    }
  }
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    kind: String(row.kind) as CorrectionCaseEvidenceKind,
    uriOrRef: String(row.uri_or_ref),
    metadata,
    createdAt: new Date(String(row.created_at)).toISOString(),
    actorAccountId: String(row.actor_account_id),
  };
}

function mapAttachmentRow(
  row: Record<string, unknown>,
): CorrectionCaseAttachment {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    storageKey: String(row.storage_key),
    originalFilenameMinimized: String(row.original_filename_minimized),
    contentTypeDetected: String(row.content_type_detected),
    sizeBytes: Number(row.size_bytes),
    inspectionStatus: String(
      row.inspection_status,
    ) as CorrectionCaseAttachmentInspectionStatus,
    sha256: row.sha256 != null ? String(row.sha256) : null,
    uploadedBy: String(row.uploaded_by),
    uploadedAt: new Date(String(row.uploaded_at)).toISOString(),
  };
}

function mapOutcomeRow(row: Record<string, unknown>): CorrectionCaseOutcomeLinks {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    linkType: String(row.link_type) as CorrectionCaseOutcomeLinkType,
    targetId: String(row.target_id),
    note: row.note != null ? String(row.note) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    actorAccountId: String(row.actor_account_id),
  };
}

export async function insertCorrectionCase(
  db: PgQueryable,
  input: {
    requestReference: string;
    authorityVerifiedAt: Date;
    authorityVerifiedBy: string;
    personId: string;
    ownerAccountId: string;
    deadlineAt: Date;
    correlationId: string;
    actorAccountId: string;
  },
): Promise<CorrectionCase> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO correction_case.case (
       id, request_reference, authority_verified_at, authority_verified_by,
       person_id, owner_account_id, status, deadline_at, correlation_id,
       created_by, updated_by
     ) VALUES (
       $1::uuid, $2, $3, $4, $5::uuid, $6, 'open', $7, $8::uuid, $9, $9
     )
     RETURNING *`,
    [
      id,
      input.requestReference,
      input.authorityVerifiedAt.toISOString(),
      input.authorityVerifiedBy,
      input.personId,
      input.ownerAccountId,
      input.deadlineAt.toISOString(),
      input.correlationId,
      input.actorAccountId,
    ],
  );
  return mapCaseRow(result.rows[0] as Record<string, unknown>);
}

export async function getCorrectionCaseById(
  db: PgQueryable,
  caseId: string,
): Promise<CorrectionCase | null> {
  const result = await db.query(
    `SELECT * FROM correction_case.case WHERE id = $1::uuid`,
    [caseId],
  );
  if (!result.rows[0]) return null;
  return mapCaseRow(result.rows[0] as Record<string, unknown>);
}

export async function listCorrectionCases(
  db: PgQueryable,
  opts?: {
    status?: CorrectionCaseStatus;
    breachedOnly?: boolean;
    personId?: string;
    limit?: number;
  },
): Promise<CorrectionCase[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts?.status) {
    params.push(opts.status);
    clauses.push(`status = $${params.length}`);
  }
  if (opts?.breachedOnly) {
    clauses.push(
      `(status = 'breached' OR breached_at IS NOT NULL OR (deadline_at < CURRENT_TIMESTAMP AND status IN ('open','in_progress','pending_decision','approved','rejected','constrained')))`,
    );
  }
  if (opts?.personId) {
    params.push(opts.personId);
    clauses.push(`person_id = $${params.length}::uuid`);
  }
  const limit = opts?.limit ?? 100;
  params.push(limit);
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await db.query(
    `SELECT * FROM correction_case.case
     ${where}
     ORDER BY
       CASE WHEN status = 'breached' OR breached_at IS NOT NULL THEN 0 ELSE 1 END,
       deadline_at ASC,
       created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return (result.rows as Record<string, unknown>[]).map(mapCaseRow);
}

export async function updateCorrectionCaseStatus(
  db: PgQueryable,
  input: {
    caseId: string;
    status: CorrectionCaseStatus;
    /** Optimistic concurrency — must match current row status. */
    expectedStatus: CorrectionCaseStatus;
    actorAccountId: string;
    decision?: CorrectionCaseDecision;
    decisionReason?: string | null;
    closureEvidence?: Record<string, string> | null;
    breachedAt?: Date | null;
  },
): Promise<CorrectionCase | null> {
  const result = await db.query(
    `UPDATE correction_case.case
     SET status = $2,
         decision = COALESCE($3, decision),
         decision_reason = COALESCE($4, decision_reason),
         closure_evidence = COALESCE($5::jsonb, closure_evidence),
         breached_at = COALESCE($6, breached_at),
         updated_at = CURRENT_TIMESTAMP,
         updated_by = $7
     WHERE id = $1::uuid
       AND status = $8
     RETURNING *`,
    [
      input.caseId,
      input.status,
      input.decision ?? null,
      input.decisionReason ?? null,
      input.closureEvidence != null
        ? JSON.stringify(input.closureEvidence)
        : null,
      input.breachedAt != null ? input.breachedAt.toISOString() : null,
      input.actorAccountId,
      input.expectedStatus,
    ],
  );
  if (!result.rows[0]) return null;
  return mapCaseRow(result.rows[0] as Record<string, unknown>);
}

export async function markCorrectionCasesBreached(
  db: PgQueryable,
  input: { actorAccountId: string; now?: Date },
): Promise<CorrectionCase[]> {
  const now = (input.now ?? new Date()).toISOString();
  const result = await db.query(
    `UPDATE correction_case.case
     SET status = 'breached',
         breached_at = COALESCE(breached_at, $1::timestamptz),
         updated_at = CURRENT_TIMESTAMP,
         updated_by = $2
     WHERE status IN ('open', 'in_progress', 'pending_decision')
       AND deadline_at < $1::timestamptz
     RETURNING *`,
    [now, input.actorAccountId],
  );
  return (result.rows as Record<string, unknown>[]).map(mapCaseRow);
}

export async function insertCaseEvent(
  db: PgQueryable,
  input: {
    caseId: string;
    kind: string;
    detail: Record<string, string>;
    actorAccountId: string;
    correlationId: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO correction_case.case_event (
       id, case_id, kind, detail, actor_account_id, correlation_id
     ) VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6::uuid)`,
    [
      randomUUID(),
      input.caseId,
      input.kind,
      JSON.stringify(input.detail),
      input.actorAccountId,
      input.correlationId,
    ],
  );
}

export async function insertEvidenceRef(
  db: PgQueryable,
  input: {
    caseId: string;
    kind: CorrectionCaseEvidenceKind;
    uriOrRef: string;
    metadata: Record<string, string>;
    actorAccountId: string;
  },
): Promise<CorrectionCaseEvidenceRef> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO correction_case.evidence_ref (
       id, case_id, kind, uri_or_ref, metadata, actor_account_id
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6)
     RETURNING *`,
    [
      id,
      input.caseId,
      input.kind,
      input.uriOrRef,
      JSON.stringify(input.metadata),
      input.actorAccountId,
    ],
  );
  return mapEvidenceRow(result.rows[0] as Record<string, unknown>);
}

export async function listEvidenceRefs(
  db: PgQueryable,
  caseId: string,
): Promise<CorrectionCaseEvidenceRef[]> {
  const result = await db.query(
    `SELECT * FROM correction_case.evidence_ref
     WHERE case_id = $1::uuid
     ORDER BY created_at ASC`,
    [caseId],
  );
  return (result.rows as Record<string, unknown>[]).map(mapEvidenceRow);
}

export async function countAttachmentsForCase(
  db: PgQueryable,
  caseId: string,
): Promise<number> {
  // Rejected rows must not exhaust quota; allowed + quarantined count.
  const result = await db.query(
    `SELECT COUNT(*)::int AS n FROM correction_case.attachment
     WHERE case_id = $1::uuid
       AND inspection_status <> 'rejected'`,
    [caseId],
  );
  return Number((result.rows[0] as { n: number }).n ?? 0);
}

/** Lock case row for concurrent attachment quota enforcement. */
export async function lockCorrectionCaseForUpdate(
  db: PgQueryable,
  caseId: string,
): Promise<CorrectionCase | null> {
  const result = await db.query(
    `SELECT * FROM correction_case.case
     WHERE id = $1::uuid
     FOR UPDATE`,
    [caseId],
  );
  if (!result.rows[0]) return null;
  return mapCaseRow(result.rows[0] as Record<string, unknown>);
}

/** Cheap existence check against Person registry (public."Person"). */
export async function personRegistryExists(
  db: PgQueryable,
  personId: string,
): Promise<boolean> {
  try {
    // Person.id is text (Prisma uuid(7) stored as string) — do not cast to uuid.
    const result = await db.query(
      `SELECT 1 FROM public."Person" WHERE id = $1 LIMIT 1`,
      [personId],
    );
    return Boolean(result.rows[0]);
  } catch {
    return false;
  }
}

export async function insertAttachment(
  db: PgQueryable,
  input: {
    caseId: string;
    storageKey: string;
    originalFilenameMinimized: string;
    contentTypeDetected: string;
    sizeBytes: number;
    inspectionStatus: CorrectionCaseAttachmentInspectionStatus;
    sha256: string | null;
    contentBytes: Buffer | null;
    uploadedBy: string;
  },
): Promise<CorrectionCaseAttachment> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO correction_case.attachment (
       id, case_id, storage_key, original_filename_minimized,
       content_type_detected, size_bytes, inspection_status, sha256,
       content_bytes, uploaded_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10
     )
     RETURNING id, case_id, storage_key, original_filename_minimized,
               content_type_detected, size_bytes, inspection_status, sha256,
               uploaded_by, uploaded_at`,
    [
      id,
      input.caseId,
      input.storageKey,
      input.originalFilenameMinimized,
      input.contentTypeDetected,
      input.sizeBytes,
      input.inspectionStatus,
      input.sha256,
      input.contentBytes,
      input.uploadedBy,
    ],
  );
  return mapAttachmentRow(result.rows[0] as Record<string, unknown>);
}

export async function listAttachments(
  db: PgQueryable,
  caseId: string,
): Promise<CorrectionCaseAttachment[]> {
  const result = await db.query(
    `SELECT id, case_id, storage_key, original_filename_minimized,
            content_type_detected, size_bytes, inspection_status, sha256,
            uploaded_by, uploaded_at
     FROM correction_case.attachment
     WHERE case_id = $1::uuid
     ORDER BY uploaded_at ASC`,
    [caseId],
  );
  return (result.rows as Record<string, unknown>[]).map(mapAttachmentRow);
}

export async function getAttachmentById(
  db: PgQueryable,
  attachmentId: string,
): Promise<(CorrectionCaseAttachment & { contentBytes: Buffer | null }) | null> {
  const result = await db.query(
    `SELECT id, case_id, storage_key, original_filename_minimized,
            content_type_detected, size_bytes, inspection_status, sha256,
            uploaded_by, uploaded_at, content_bytes
     FROM correction_case.attachment
     WHERE id = $1::uuid`,
    [attachmentId],
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0] as Record<string, unknown>;
  return {
    ...mapAttachmentRow(row),
    contentBytes: row.content_bytes != null ? (row.content_bytes as Buffer) : null,
  };
}

export async function insertOutcomeLink(
  db: PgQueryable,
  input: {
    caseId: string;
    linkType: CorrectionCaseOutcomeLinkType;
    targetId: string;
    note: string | null;
    actorAccountId: string;
  },
): Promise<CorrectionCaseOutcomeLinks> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO correction_case.outcome_link (
       id, case_id, link_type, target_id, note, actor_account_id
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
     RETURNING *`,
    [
      id,
      input.caseId,
      input.linkType,
      input.targetId,
      input.note,
      input.actorAccountId,
    ],
  );
  return mapOutcomeRow(result.rows[0] as Record<string, unknown>);
}

export async function listOutcomeLinks(
  db: PgQueryable,
  caseId: string,
): Promise<CorrectionCaseOutcomeLinks[]> {
  const result = await db.query(
    `SELECT * FROM correction_case.outcome_link
     WHERE case_id = $1::uuid
     ORDER BY created_at ASC`,
    [caseId],
  );
  return (result.rows as Record<string, unknown>[]).map(mapOutcomeRow);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function withCorrectionCaseTransaction<T>(
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
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Cheap existence check for FR-17 Correction event id in kernel_events. */
export async function correctionEventExists(
  db: PgQueryable,
  eventId: string,
): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT 1 FROM kernel_events WHERE id = $1::uuid LIMIT 1`,
      [eventId],
    );
    return Boolean(result.rows[0]);
  } catch {
    return false;
  }
}
