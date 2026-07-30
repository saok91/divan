/**
 * Launch Artifact Register persistence (Story 7.7 / FR-55).
 * Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
 * Schema: governance.
 */

import type { Pool, PoolClient } from "pg";

import type {
  ControllingVersionRef,
  LaunchArtifactConflict,
  LaunchArtifactConflictStatus,
  LaunchArtifactId,
  LaunchArtifactRegisterRow,
  LaunchArtifactRegisterStatus,
  LaunchArtifactRebaselineStatus,
  LaunchArtifactVersion,
  LaunchArtifactVersionStatus,
  LaunchArtifactWaiver,
  LaunchArtifactWaiverStatus,
  RebaselineRecord,
} from "./launch-artifact-permissions";

export type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

function asIso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function asIsoOrNull(value: unknown): string | null {
  if (value == null) return null;
  return asIso(value);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function asJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asApprovalHistory(
  value: unknown,
): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
      out[k] = String(v);
    }
    return out;
  });
}

function mapVersion(row: Record<string, unknown>): LaunchArtifactVersion {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id) as LaunchArtifactId,
    versionLabel: String(row.version_label),
    status: String(row.status) as LaunchArtifactVersionStatus,
    effectiveFrom: asIsoOrNull(row.effective_from),
    effectiveTo: asIsoOrNull(row.effective_to),
    scopeSummary: String(row.scope_summary),
    affectedFrNfr: asJsonArray(row.affected_fr_nfr),
    approvalHistory: asApprovalHistory(row.approval_history),
    supersedesVersionId:
      row.supersedes_version_id != null
        ? String(row.supersedes_version_id)
        : null,
    contentRef: row.content_ref != null ? String(row.content_ref) : null,
    contentHash: row.content_hash != null ? String(row.content_hash) : null,
    createdAt: asIso(row.created_at),
    createdBy: String(row.created_by),
    correlationId: String(row.correlation_id),
  };
}

function mapArtifact(row: Record<string, unknown>): LaunchArtifactRegisterRow {
  return {
    id: String(row.id) as LaunchArtifactId,
    title: String(row.title),
    purposeSummary: String(row.purpose_summary),
    ownerAccountId:
      row.owner_account_id != null ? String(row.owner_account_id) : null,
    currentVersionId:
      row.current_version_id != null ? String(row.current_version_id) : null,
    status: String(row.status) as LaunchArtifactRegisterStatus,
  };
}

function mapWaiver(row: Record<string, unknown>): LaunchArtifactWaiver {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id) as LaunchArtifactId,
    artifactVersionId:
      row.artifact_version_id != null ? String(row.artifact_version_id) : null,
    ownerAccountId: String(row.owner_account_id),
    independentApproverAccountId: String(row.independent_approver_account_id),
    requesterAccountId: String(row.requester_account_id),
    scope: String(row.scope),
    risk: String(row.risk),
    compensatingControls: String(row.compensating_controls),
    expiry: asIso(row.expiry),
    status: String(row.status) as LaunchArtifactWaiverStatus,
    closureEvidence:
      row.closure_evidence != null ? String(row.closure_evidence) : null,
    targetGateCode:
      row.target_gate_code != null ? String(row.target_gate_code) : null,
    nonWaiverableAttemptCode:
      row.non_waiverable_attempt_code != null
        ? String(row.non_waiverable_attempt_code)
        : null,
    createdAt: asIso(row.created_at),
    closedAt: asIsoOrNull(row.closed_at),
    correlationId: String(row.correlation_id),
  };
}

function mapConflict(row: Record<string, unknown>): LaunchArtifactConflict {
  return {
    id: String(row.id),
    status: String(row.status) as LaunchArtifactConflictStatus,
    artifactIds: asStringArray(row.artifact_ids) as LaunchArtifactId[],
    summary: String(row.summary),
    resolutionVersionIds:
      row.resolution_version_ids == null
        ? null
        : asStringArray(row.resolution_version_ids),
    openedAt: asIso(row.opened_at),
    resolvedAt: asIsoOrNull(row.resolved_at),
    openedBy: String(row.opened_by),
    resolvedBy: row.resolved_by != null ? String(row.resolved_by) : null,
    correlationId: String(row.correlation_id),
  };
}

function mapControllingVersions(value: unknown): ControllingVersionRef[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const e = entry as Record<string, unknown>;
    return {
      artifactId: String(e.artifactId ?? e.artifact_id) as LaunchArtifactId,
      versionId: String(e.versionId ?? e.version_id),
      versionLabel: String(e.versionLabel ?? e.version_label),
      status: String(e.status) as LaunchArtifactVersionStatus,
      effectiveFrom:
        e.effectiveFrom != null || e.effective_from != null
          ? String(e.effectiveFrom ?? e.effective_from)
          : null,
      effectiveTo:
        e.effectiveTo != null || e.effective_to != null
          ? String(e.effectiveTo ?? e.effective_to)
          : null,
      registerStatus: String(
        e.registerStatus ?? e.register_status ?? "pending",
      ) as LaunchArtifactRegisterStatus,
    };
  });
}

function mapRebaseline(row: Record<string, unknown>): RebaselineRecord {
  return {
    id: String(row.id),
    status: String(row.status) as LaunchArtifactRebaselineStatus,
    changeSummary: String(row.change_summary),
    impactAssessment: String(row.impact_assessment),
    affectedArtifactIds: asStringArray(
      row.affected_artifact_ids,
    ) as LaunchArtifactId[],
    requiredRegressionRefs: asJsonArray(row.required_regression_refs),
    buildRef: row.build_ref != null ? String(row.build_ref) : null,
    controllingVersions: mapControllingVersions(row.controlling_versions),
    requesterAccountId: String(row.requester_account_id),
    independentApproverAccountId:
      row.independent_approver_account_id != null
        ? String(row.independent_approver_account_id)
        : null,
    approvedAt: asIsoOrNull(row.approved_at),
    correlationId: String(row.correlation_id),
    createdAt: asIso(row.created_at),
  };
}

export async function upsertArtifact(
  db: PgQueryable,
  input: {
    id: LaunchArtifactId;
    title: string;
    purposeSummary: string;
    status: LaunchArtifactRegisterStatus;
    ownerAccountId: string | null;
    currentVersionId: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO governance.launch_artifact (
       id, title, purpose_summary, owner_account_id, current_version_id, status
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       purpose_summary = EXCLUDED.purpose_summary,
       updated_at = CURRENT_TIMESTAMP`,
    [
      input.id,
      input.title,
      input.purposeSummary,
      input.ownerAccountId,
      input.currentVersionId,
      input.status,
    ],
  );
}

export async function listArtifacts(
  db: PgQueryable,
): Promise<LaunchArtifactRegisterRow[]> {
  const result = await db.query(
    `SELECT id, title, purpose_summary, owner_account_id, current_version_id, status
     FROM governance.launch_artifact
     ORDER BY id`,
  );
  return (result.rows as Record<string, unknown>[]).map(mapArtifact);
}

export async function getArtifact(
  db: PgQueryable,
  artifactId: string,
): Promise<LaunchArtifactRegisterRow | null> {
  const result = await db.query(
    `SELECT id, title, purpose_summary, owner_account_id, current_version_id, status
     FROM governance.launch_artifact WHERE id = $1`,
    [artifactId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapArtifact(row) : null;
}

export async function setCurrentVersion(
  db: PgQueryable,
  artifactId: string,
  versionId: string,
): Promise<void> {
  await db.query(
    `UPDATE governance.launch_artifact
     SET current_version_id = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [artifactId, versionId],
  );
}

export async function insertVersion(
  db: PgQueryable,
  input: {
    id: string;
    artifactId: LaunchArtifactId;
    versionLabel: string;
    status: LaunchArtifactVersionStatus;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    scopeSummary: string;
    affectedFrNfr: string[];
    approvalHistory: Array<Record<string, string>>;
    supersedesVersionId: string | null;
    contentRef: string | null;
    contentHash: string | null;
    createdBy: string;
    correlationId: string;
  },
): Promise<LaunchArtifactVersion> {
  const result = await db.query(
    `INSERT INTO governance.launch_artifact_version (
       id, artifact_id, version_label, status, effective_from, effective_to,
       scope_summary, affected_fr_nfr, approval_history, supersedes_version_id,
       content_ref, content_hash, created_by, correlation_id
     ) VALUES (
       $1::uuid, $2, $3, $4, $5::timestamptz, $6::timestamptz,
       $7, $8::jsonb, $9::jsonb, $10::uuid, $11, $12, $13, $14::uuid
     )
     RETURNING *`,
    [
      input.id,
      input.artifactId,
      input.versionLabel,
      input.status,
      input.effectiveFrom,
      input.effectiveTo,
      input.scopeSummary,
      JSON.stringify(input.affectedFrNfr),
      JSON.stringify(input.approvalHistory),
      input.supersedesVersionId,
      input.contentRef,
      input.contentHash,
      input.createdBy,
      input.correlationId,
    ],
  );
  return mapVersion(result.rows[0] as Record<string, unknown>);
}

export async function getVersion(
  db: PgQueryable,
  versionId: string,
): Promise<LaunchArtifactVersion | null> {
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_version WHERE id = $1::uuid`,
    [versionId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapVersion(row) : null;
}

export async function findVersionByLabel(
  db: PgQueryable,
  artifactId: string,
  versionLabel: string,
): Promise<LaunchArtifactVersion | null> {
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_version
     WHERE artifact_id = $1 AND version_label = $2`,
    [artifactId, versionLabel],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapVersion(row) : null;
}

export async function listVersions(
  db: PgQueryable,
  artifactId: string,
): Promise<LaunchArtifactVersion[]> {
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_version
     WHERE artifact_id = $1
     ORDER BY created_at DESC`,
    [artifactId],
  );
  return (result.rows as Record<string, unknown>[]).map(mapVersion);
}

export async function findControllingVersion(
  db: PgQueryable,
  artifactId: string,
  asOf: Date,
): Promise<LaunchArtifactVersion | null> {
  const artifact = await getArtifact(db, artifactId);
  if (artifact?.currentVersionId) {
    const current = await getVersion(db, artifact.currentVersionId);
    if (current?.status === "approved") {
      const fromOk =
        !current.effectiveFrom ||
        Date.parse(current.effectiveFrom) <= asOf.getTime();
      const toOk =
        !current.effectiveTo ||
        Date.parse(current.effectiveTo) > asOf.getTime();
      if (fromOk && toOk) return current;
    }
  }

  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_version
     WHERE artifact_id = $1
       AND status = 'approved'
       AND (effective_from IS NULL OR effective_from <= $2::timestamptz)
       AND (effective_to IS NULL OR effective_to > $2::timestamptz)
     ORDER BY effective_from DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [artifactId, asOf.toISOString()],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapVersion(row) : null;
}

export async function markVersionSuperseded(
  db: PgQueryable,
  versionId: string,
): Promise<void> {
  await db.query(
    `UPDATE governance.launch_artifact_version
     SET status = 'superseded'
     WHERE id = $1::uuid AND status = 'approved'`,
    [versionId],
  );
}

export async function approveVersion(
  db: PgQueryable,
  input: {
    versionId: string;
    actorAccountId: string;
    supersedesVersionId: string | null;
    effectiveFrom: string;
  },
): Promise<LaunchArtifactVersion | null> {
  const historyEntry = {
    at: new Date().toISOString(),
    by: input.actorAccountId,
    decision: "approved",
  };
  const result = await db.query(
    `UPDATE governance.launch_artifact_version
     SET status = 'approved',
         effective_from = COALESCE(effective_from, $2::timestamptz),
         supersedes_version_id = COALESCE($3::uuid, supersedes_version_id),
         approval_history = approval_history || $4::jsonb
     WHERE id = $1::uuid AND status = 'draft'
     RETURNING *`,
    [
      input.versionId,
      input.effectiveFrom,
      input.supersedesVersionId,
      JSON.stringify([historyEntry]),
    ],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapVersion(row);
}

export async function markExpiredVersions(
  db: PgQueryable,
  artifactIds?: string[],
): Promise<number> {
  const params: unknown[] = [];
  let filter = "";
  if (artifactIds?.length) {
    params.push(artifactIds);
    filter = ` AND artifact_id = ANY($1::text[])`;
  }
  const result = await db.query(
    `UPDATE governance.launch_artifact_version
     SET status = 'expired'
     WHERE status = 'approved'
       AND effective_to IS NOT NULL
       AND effective_to < CURRENT_TIMESTAMP
       ${filter}`,
    params,
  );
  return result.rowCount ?? 0;
}

export async function insertWaiver(
  db: PgQueryable,
  input: Omit<LaunchArtifactWaiver, "createdAt" | "closedAt"> & {
    status: LaunchArtifactWaiverStatus;
  },
): Promise<LaunchArtifactWaiver> {
  const result = await db.query(
    `INSERT INTO governance.launch_artifact_waiver (
       id, artifact_id, artifact_version_id, owner_account_id,
       independent_approver_account_id, requester_account_id,
       scope, risk, compensating_controls, expiry, status,
       closure_evidence, target_gate_code, non_waiverable_attempt_code,
       correlation_id
     ) VALUES (
       $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11,
       $12, $13, $14, $15::uuid
     )
     RETURNING *`,
    [
      input.id,
      input.artifactId,
      input.artifactVersionId,
      input.ownerAccountId,
      input.independentApproverAccountId,
      input.requesterAccountId,
      input.scope,
      input.risk,
      input.compensatingControls,
      input.expiry,
      input.status,
      input.closureEvidence,
      input.targetGateCode,
      input.nonWaiverableAttemptCode,
      input.correlationId,
    ],
  );
  return mapWaiver(result.rows[0] as Record<string, unknown>);
}

/** Audit trail for non-waiverable reject attempts (status closed immediately). */
export async function insertRejectedWaiverAttempt(
  db: PgQueryable,
  input: {
    id: string;
    artifactId: LaunchArtifactId;
    artifactVersionId: string | null;
    ownerAccountId: string;
    independentApproverAccountId: string;
    requesterAccountId: string;
    scope: string;
    risk: string;
    compensatingControls: string;
    expiry: string;
    targetGateCode: string | null;
    nonWaiverableAttemptCode: string;
    correlationId: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO governance.launch_artifact_waiver (
       id, artifact_id, artifact_version_id, owner_account_id,
       independent_approver_account_id, requester_account_id,
       scope, risk, compensating_controls, expiry, status,
       closure_evidence, target_gate_code, non_waiverable_attempt_code,
       closed_at, correlation_id
     ) VALUES (
       $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10::timestamptz, 'closed',
       'rejected_non_waiverable', $11, $12, CURRENT_TIMESTAMP, $13::uuid
     )`,
    [
      input.id,
      input.artifactId,
      input.artifactVersionId,
      input.ownerAccountId,
      input.independentApproverAccountId,
      input.requesterAccountId,
      input.scope,
      input.risk,
      input.compensatingControls,
      input.expiry,
      input.targetGateCode,
      input.nonWaiverableAttemptCode,
      input.correlationId,
    ],
  );
}

export async function getWaiver(
  db: PgQueryable,
  waiverId: string,
): Promise<LaunchArtifactWaiver | null> {
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_waiver WHERE id = $1::uuid`,
    [waiverId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapWaiver(row) : null;
}

export async function closeWaiver(
  db: PgQueryable,
  waiverId: string,
  closureEvidence: string,
): Promise<LaunchArtifactWaiver | null> {
  const result = await db.query(
    `UPDATE governance.launch_artifact_waiver
     SET status = 'closed',
         closure_evidence = $2,
         closed_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid AND status = 'open'
     RETURNING *`,
    [waiverId, closureEvidence],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapWaiver(row) : null;
}

export async function listWaivers(
  db: PgQueryable,
  opts?: { artifactId?: string; status?: LaunchArtifactWaiverStatus },
): Promise<LaunchArtifactWaiver[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts?.artifactId) {
    params.push(opts.artifactId);
    clauses.push(`artifact_id = $${params.length}`);
  }
  if (opts?.status) {
    params.push(opts.status);
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_waiver ${where}
     ORDER BY created_at DESC`,
    params,
  );
  return (result.rows as Record<string, unknown>[]).map(mapWaiver);
}

export async function markExpiredWaivers(
  db: PgQueryable,
  artifactIds?: string[],
): Promise<number> {
  const params: unknown[] = [];
  let filter = "";
  if (artifactIds?.length) {
    params.push(artifactIds);
    filter = ` AND artifact_id = ANY($1::text[])`;
  }
  const result = await db.query(
    `UPDATE governance.launch_artifact_waiver
     SET status = 'expired'
     WHERE status = 'open'
       AND expiry < CURRENT_TIMESTAMP
       ${filter}`,
    params,
  );
  return result.rowCount ?? 0;
}

export async function insertConflict(
  db: PgQueryable,
  input: {
    id: string;
    status: LaunchArtifactConflictStatus;
    artifactIds: LaunchArtifactId[];
    summary: string;
    resolutionVersionIds: string[] | null;
    openedBy: string;
    resolvedBy: string | null;
    correlationId: string;
  },
): Promise<LaunchArtifactConflict> {
  const result = await db.query(
    `INSERT INTO governance.launch_artifact_conflict (
       id, status, artifact_ids, summary, resolution_version_ids,
       opened_by, resolved_by, correlation_id
     ) VALUES (
       $1::uuid, $2, $3::text[], $4, $5::text[], $6, $7, $8::uuid
     )
     RETURNING *`,
    [
      input.id,
      input.status,
      input.artifactIds,
      input.summary,
      input.resolutionVersionIds,
      input.openedBy,
      input.resolvedBy,
      input.correlationId,
    ],
  );
  return mapConflict(result.rows[0] as Record<string, unknown>);
}

export async function getConflict(
  db: PgQueryable,
  conflictId: string,
): Promise<LaunchArtifactConflict | null> {
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_conflict WHERE id = $1::uuid`,
    [conflictId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapConflict(row) : null;
}

export async function resolveConflict(
  db: PgQueryable,
  input: {
    conflictId: string;
    resolutionVersionIds: string[];
    resolvedBy: string;
  },
): Promise<LaunchArtifactConflict | null> {
  const result = await db.query(
    `UPDATE governance.launch_artifact_conflict
     SET status = 'resolved',
         resolution_version_ids = $2::text[],
         resolved_by = $3,
         resolved_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid AND status = 'open'
     RETURNING *`,
    [input.conflictId, input.resolutionVersionIds, input.resolvedBy],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapConflict(row) : null;
}

export async function listConflicts(
  db: PgQueryable,
): Promise<LaunchArtifactConflict[]> {
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_conflict
     ORDER BY opened_at DESC`,
  );
  return (result.rows as Record<string, unknown>[]).map(mapConflict);
}

export async function listOpenConflictsIntersecting(
  db: PgQueryable,
  artifactIds: string[],
): Promise<LaunchArtifactConflict[]> {
  if (!artifactIds.length) return [];
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_conflict
     WHERE status = 'open'
       AND artifact_ids && $1::text[]`,
    [artifactIds],
  );
  return (result.rows as Record<string, unknown>[]).map(mapConflict);
}

export async function insertRebaseline(
  db: PgQueryable,
  input: {
    id: string;
    status: LaunchArtifactRebaselineStatus;
    changeSummary: string;
    impactAssessment: string;
    affectedArtifactIds: LaunchArtifactId[];
    requiredRegressionRefs: string[];
    buildRef: string | null;
    controllingVersions: ControllingVersionRef[];
    requesterAccountId: string;
    independentApproverAccountId: string | null;
    approvedAt: string | null;
    correlationId: string;
  },
): Promise<RebaselineRecord> {
  const result = await db.query(
    `INSERT INTO governance.launch_artifact_rebaseline (
       id, status, change_summary, impact_assessment, affected_artifact_ids,
       required_regression_refs, build_ref, controlling_versions,
       requester_account_id, independent_approver_account_id,
       approved_at, correlation_id
     ) VALUES (
       $1::uuid, $2, $3, $4, $5::text[], $6::jsonb, $7, $8::jsonb,
       $9, $10, $11::timestamptz, $12::uuid
     )
     RETURNING *`,
    [
      input.id,
      input.status,
      input.changeSummary,
      input.impactAssessment,
      input.affectedArtifactIds,
      JSON.stringify(input.requiredRegressionRefs),
      input.buildRef,
      JSON.stringify(input.controllingVersions),
      input.requesterAccountId,
      input.independentApproverAccountId,
      input.approvedAt,
      input.correlationId,
    ],
  );
  return mapRebaseline(result.rows[0] as Record<string, unknown>);
}

export async function getRebaseline(
  db: PgQueryable,
  rebaselineId: string,
): Promise<RebaselineRecord | null> {
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_rebaseline WHERE id = $1::uuid`,
    [rebaselineId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRebaseline(row) : null;
}

export async function approveRebaseline(
  db: PgQueryable,
  input: {
    rebaselineId: string;
    independentApproverAccountId: string;
    buildRef: string | null;
    controllingVersions: ControllingVersionRef[];
  },
): Promise<RebaselineRecord | null> {
  const result = await db.query(
    `UPDATE governance.launch_artifact_rebaseline
     SET status = 'approved',
         independent_approver_account_id = $2,
         build_ref = $3,
         controlling_versions = $4::jsonb,
         approved_at = CURRENT_TIMESTAMP
     WHERE id = $1::uuid AND status IN ('required', 'in_review')
     RETURNING *`,
    [
      input.rebaselineId,
      input.independentApproverAccountId,
      input.buildRef,
      JSON.stringify(input.controllingVersions),
    ],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRebaseline(row) : null;
}

export async function listRebaselines(
  db: PgQueryable,
): Promise<RebaselineRecord[]> {
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_rebaseline
     ORDER BY created_at DESC`,
  );
  return (result.rows as Record<string, unknown>[]).map(mapRebaseline);
}

export async function listOpenRebaselinesIntersecting(
  db: PgQueryable,
  artifactIds: string[],
): Promise<RebaselineRecord[]> {
  if (!artifactIds.length) return [];
  const result = await db.query(
    `SELECT * FROM governance.launch_artifact_rebaseline
     WHERE status IN ('required', 'in_review')
       AND affected_artifact_ids && $1::text[]`,
    [artifactIds],
  );
  return (result.rows as Record<string, unknown>[]).map(mapRebaseline);
}

export async function countSignals(db: PgQueryable): Promise<{
  expiredArtifacts: number;
  openConflicts: number;
  openRebaselines: number;
  openWaivers: number;
}> {
  const expired = await db.query(
    `SELECT COUNT(*)::int AS c FROM governance.launch_artifact_version
     WHERE status = 'expired'`,
  );
  const conflicts = await db.query(
    `SELECT COUNT(*)::int AS c FROM governance.launch_artifact_conflict
     WHERE status = 'open'`,
  );
  const rebaselines = await db.query(
    `SELECT COUNT(*)::int AS c FROM governance.launch_artifact_rebaseline
     WHERE status IN ('required', 'in_review')`,
  );
  const waivers = await db.query(
    `SELECT COUNT(*)::int AS c FROM governance.launch_artifact_waiver
     WHERE status = 'open'`,
  );
  return {
    expiredArtifacts: Number(
      (expired.rows[0] as { c: number } | undefined)?.c ?? 0,
    ),
    openConflicts: Number(
      (conflicts.rows[0] as { c: number } | undefined)?.c ?? 0,
    ),
    openRebaselines: Number(
      (rebaselines.rows[0] as { c: number } | undefined)?.c ?? 0,
    ),
    openWaivers: Number(
      (waivers.rows[0] as { c: number } | undefined)?.c ?? 0,
    ),
  };
}
