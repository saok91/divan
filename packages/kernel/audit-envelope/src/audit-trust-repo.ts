/**
 * Audit trust persistence (Story 7.4 / FR-51).
 * Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
 * Preferred home: audit-envelope (control-plane next to authorizeOrThrow).
 * Schema: audit_trust. Incident rows are never DELETE'd.
 */

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  AUDIT_TRUST_DEFAULT_ENV_KEY,
  assertClearWriterSuspendAllowed,
  loadAuditTrustProvisionalConfig,
  type AuditTrustIncident,
  type AuditTrustIncidentKind,
  type AuditTrustIncidentStatus,
  type AuditTrustState,
  type AuditTrustWriterStatus,
  type IntegrityVerificationOutcome,
  type IntegrityVerificationRun,
} from "./audit-trust";

export type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

function mapIncidentRow(row: Record<string, unknown>): AuditTrustIncident {
  const detailRaw = row.detail;
  const detail =
    detailRaw && typeof detailRaw === "object" && !Array.isArray(detailRaw)
      ? (detailRaw as Record<string, string | number | boolean | null>)
      : {};
  return {
    id: String(row.id),
    kind: String(row.kind) as AuditTrustIncidentKind,
    status: String(row.status) as AuditTrustIncidentStatus,
    assignedTo: row.assigned_to != null ? String(row.assigned_to) : null,
    detectedAt: new Date(String(row.detected_at)).toISOString(),
    closedAt:
      row.closed_at != null
        ? new Date(String(row.closed_at)).toISOString()
        : null,
    closedBy: row.closed_by != null ? String(row.closed_by) : null,
    detail,
    correlationId: String(row.correlation_id),
    subjectAccountId:
      row.subject_account_id != null ? String(row.subject_account_id) : null,
  };
}

function mapVerificationRow(
  row: Record<string, unknown>,
): IntegrityVerificationRun {
  const findingsRaw = row.findings;
  const findings =
    findingsRaw &&
    typeof findingsRaw === "object" &&
    !Array.isArray(findingsRaw)
      ? (findingsRaw as Record<string, string | number | boolean | null>)
      : {};
  return {
    id: String(row.id),
    startedAt: new Date(String(row.started_at)).toISOString(),
    completedAt:
      row.completed_at != null
        ? new Date(String(row.completed_at)).toISOString()
        : null,
    outcome: String(row.outcome) as IntegrityVerificationOutcome,
    windowLabel: String(row.window_label),
    findings,
    actorAccountId: String(row.actor_account_id),
    correlationId: String(row.correlation_id),
  };
}

export async function ensureWriterStateRow(
  db: PgQueryable,
  envKey: string = AUDIT_TRUST_DEFAULT_ENV_KEY,
): Promise<void> {
  await db.query(
    `INSERT INTO audit_trust.writer_state (env_key, status, clear_requires_review)
     VALUES ($1, 'ok', TRUE)
     ON CONFLICT (env_key) DO NOTHING`,
    [envKey],
  );
}

export async function getWriterState(
  db: PgQueryable,
  envKey: string = AUDIT_TRUST_DEFAULT_ENV_KEY,
): Promise<AuditTrustState> {
  await ensureWriterStateRow(db, envKey);
  const stateResult = await db.query(
    `SELECT status, reason, suspended_at, suspended_by, clear_requires_review, correlation_id
     FROM audit_trust.writer_state WHERE env_key = $1`,
    [envKey],
  );
  const row = stateResult.rows[0] as Record<string, unknown> | undefined;
  const openResult = await db.query(
    `SELECT COUNT(*)::int AS c FROM audit_trust.incident
     WHERE status IN ('open', 'assigned', 'acknowledged')`,
  );
  const openIncidentCount = Number(
    (openResult.rows[0] as { c: number } | undefined)?.c ?? 0,
  );
  const lastRun = await db.query(
    `SELECT outcome, completed_at FROM audit_trust.integrity_verification_run
     ORDER BY started_at DESC LIMIT 1`,
  );
  const last = lastRun.rows[0] as Record<string, unknown> | undefined;

  const status = (row ? String(row.status) : "ok") as AuditTrustWriterStatus;
  const suspendedAt =
    row?.suspended_at != null
      ? new Date(String(row.suspended_at)).toISOString()
      : null;

  let suspendExpiresAt: string | null = null;
  let suspendTtlElapsed = false;
  if (status === "suspended" && suspendedAt) {
    try {
      const ttl = loadAuditTrustProvisionalConfig().suspendTtlMs;
      if (ttl != null && ttl > 0) {
        const expiresMs = new Date(suspendedAt).getTime() + ttl;
        suspendExpiresAt = new Date(expiresMs).toISOString();
        suspendTtlElapsed = Date.now() >= expiresMs;
      }
    } catch {
      // Config missing under enforce — caller gate handles fail-closed separately
    }
  }

  return {
    status,
    reason: row?.reason != null ? String(row.reason) : null,
    suspendedAt,
    suspendedBy: row?.suspended_by != null ? String(row.suspended_by) : null,
    clearRequiresReview: row ? Boolean(row.clear_requires_review) : true,
    correlationId:
      row?.correlation_id != null ? String(row.correlation_id) : null,
    openIncidentCount,
    lastVerificationOutcome: last
      ? (String(last.outcome) as IntegrityVerificationOutcome)
      : null,
    lastVerificationAt:
      last?.completed_at != null
        ? new Date(String(last.completed_at)).toISOString()
        : null,
    suspendExpiresAt,
    suspendTtlElapsed,
  };
}

export async function setWriterSuspended(
  db: PgQueryable,
  input: {
    reason: string;
    suspendedBy: string;
    correlationId: string;
    clearRequiresReview?: boolean;
    envKey?: string;
  },
): Promise<AuditTrustState> {
  const envKey = input.envKey ?? AUDIT_TRUST_DEFAULT_ENV_KEY;
  await ensureWriterStateRow(db, envKey);
  await db.query(
    `UPDATE audit_trust.writer_state SET
       status = 'suspended',
       reason = $2,
       suspended_at = CURRENT_TIMESTAMP,
       suspended_by = $3,
       clear_requires_review = $4,
       correlation_id = $5::uuid,
       updated_at = CURRENT_TIMESTAMP
     WHERE env_key = $1`,
    [
      envKey,
      input.reason,
      input.suspendedBy,
      input.clearRequiresReview ?? true,
      input.correlationId,
    ],
  );
  return getWriterState(db, envKey);
}

export async function clearWriterSuspend(
  db: PgQueryable,
  input: {
    clearedBy: string;
    correlationId: string;
    envKey?: string;
  },
): Promise<AuditTrustState> {
  const envKey = input.envKey ?? AUDIT_TRUST_DEFAULT_ENV_KEY;
  const before = await getWriterState(db, envKey);
  assertClearWriterSuspendAllowed(before);
  await db.query(
    `UPDATE audit_trust.writer_state SET
       status = 'ok',
       reason = NULL,
       suspended_at = NULL,
       suspended_by = NULL,
       clear_requires_review = TRUE,
       correlation_id = $2::uuid,
       updated_at = CURRENT_TIMESTAMP
     WHERE env_key = $1`,
    [envKey, input.correlationId],
  );
  return getWriterState(db, envKey);
}

export async function openTrustIncident(
  db: PgQueryable,
  input: {
    kind: AuditTrustIncidentKind;
    correlationId: string;
    detail?: Record<string, string | number | boolean | null>;
    subjectAccountId?: string | null;
  },
): Promise<AuditTrustIncident> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO audit_trust.incident (
       id, kind, status, detail, correlation_id, subject_account_id
     ) VALUES ($1::uuid, $2, 'open', $3::jsonb, $4::uuid, $5)
     RETURNING *`,
    [
      id,
      input.kind,
      JSON.stringify(input.detail ?? {}),
      input.correlationId,
      input.subjectAccountId ?? null,
    ],
  );
  return mapIncidentRow(result.rows[0] as Record<string, unknown>);
}

export async function listTrustIncidents(
  db: PgQueryable,
  input?: {
    statusIn?: AuditTrustIncidentStatus[];
    limit?: number;
  },
): Promise<AuditTrustIncident[]> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const statuses = input?.statusIn;
  let result;
  if (statuses && statuses.length > 0) {
    result = await db.query(
      `SELECT * FROM audit_trust.incident
       WHERE status = ANY($1::text[])
       ORDER BY detected_at DESC
       LIMIT $2`,
      [statuses, limit],
    );
  } else {
    result = await db.query(
      `SELECT * FROM audit_trust.incident
       ORDER BY detected_at DESC
       LIMIT $1`,
      [limit],
    );
  }
  return (result.rows as Record<string, unknown>[]).map(mapIncidentRow);
}

export async function getTrustIncident(
  db: PgQueryable,
  incidentId: string,
): Promise<AuditTrustIncident | null> {
  const result = await db.query(
    `SELECT * FROM audit_trust.incident WHERE id = $1::uuid`,
    [incidentId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapIncidentRow(row) : null;
}

export async function assignTrustIncident(
  db: PgQueryable,
  input: { incidentId: string; assignedTo: string },
): Promise<AuditTrustIncident> {
  const result = await db.query(
    `UPDATE audit_trust.incident SET
       status = 'assigned',
       assigned_to = $2
     WHERE id = $1::uuid AND status IN ('open', 'assigned', 'acknowledged')
     RETURNING *`,
    [input.incidentId, input.assignedTo],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("AUDIT_TRUST_INCIDENT_NOT_FOUND");
  }
  return mapIncidentRow(row);
}

export async function acknowledgeTrustIncident(
  db: PgQueryable,
  input: { incidentId: string },
): Promise<AuditTrustIncident> {
  const result = await db.query(
    `UPDATE audit_trust.incident SET status = 'acknowledged'
     WHERE id = $1::uuid AND status IN ('open', 'assigned', 'acknowledged')
     RETURNING *`,
    [input.incidentId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("AUDIT_TRUST_INCIDENT_NOT_FOUND");
  }
  return mapIncidentRow(row);
}

export async function closeTrustIncident(
  db: PgQueryable,
  input: { incidentId: string; closedBy: string },
): Promise<AuditTrustIncident> {
  const result = await db.query(
    `UPDATE audit_trust.incident SET
       status = 'closed',
       closed_at = CURRENT_TIMESTAMP,
       closed_by = $2
     WHERE id = $1::uuid AND status IN ('open', 'assigned', 'acknowledged')
     RETURNING *`,
    [input.incidentId, input.closedBy],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("AUDIT_TRUST_INCIDENT_NOT_FOUND");
  }
  return mapIncidentRow(row);
}

export async function insertIntegrityVerificationRun(
  db: PgQueryable,
  input: {
    outcome: IntegrityVerificationOutcome;
    windowLabel: string;
    findings: Record<string, string | number | boolean | null>;
    actorAccountId: string;
    correlationId: string;
  },
): Promise<IntegrityVerificationRun> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO audit_trust.integrity_verification_run (
       id, completed_at, outcome, window_label, findings, actor_account_id, correlation_id
     ) VALUES ($1::uuid, CURRENT_TIMESTAMP, $2, $3, $4::jsonb, $5, $6::uuid)
     RETURNING *`,
    [
      id,
      input.outcome,
      input.windowLabel,
      JSON.stringify(input.findings),
      input.actorAccountId,
      input.correlationId,
    ],
  );
  return mapVerificationRow(result.rows[0] as Record<string, unknown>);
}

export async function selectDbNow(db: PgQueryable): Promise<Date> {
  const result = await db.query(`SELECT now() AS n`);
  return new Date(String((result.rows[0] as { n: string }).n));
}

/**
 * Assert append-only trigger on kernel_events is present/enabled.
 * Function: kernel_events_forbid_mutation; trigger: kernel_events_append_only_trg.
 */
export async function checkAppendOnlyTriggerPresent(
  db: PgQueryable,
): Promise<{ present: boolean; enabled: boolean }> {
  const result = await db.query(
    `SELECT t.tgname, t.tgenabled
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'kernel_events'
       AND t.tgname = 'kernel_events_append_only_trg'
       AND NOT t.tgisinternal`,
  );
  const row = result.rows[0] as { tgname: string; tgenabled: string } | undefined;
  if (!row) return { present: false, enabled: false };
  // O = origin, D = disabled, R = replica, A = always
  return {
    present: true,
    enabled: row.tgenabled !== "D",
  };
}

/**
 * Recent access-event occurred_at for non-monotonic heuristic (window hours).
 * Returned in chronological ASC order (oldest → newest within limit).
 */
export async function listRecentAccessOccurredAt(
  db: PgQueryable,
  windowHours: number,
  limit = 20,
): Promise<Date[]> {
  const result = await db.query(
    `SELECT occurred_at FROM (
       SELECT occurred_at FROM kernel_events
       WHERE event_class = 'access'
         AND occurred_at >= (CURRENT_TIMESTAMP - ($1::text || ' hours')::interval)
       ORDER BY occurred_at DESC
       LIMIT $2
     ) recent
     ORDER BY occurred_at ASC`,
    [String(windowHours), limit],
  );
  return (result.rows as { occurred_at: string }[]).map(
    (r) => new Date(String(r.occurred_at)),
  );
}

/**
 * Heuristic gap: missing expected correlation continuity is honesty-labeled.
 * Counts access events in window — does not claim perfect capture proof.
 */
export async function countAccessEventsInWindow(
  db: PgQueryable,
  windowHours: number,
): Promise<number> {
  const result = await db.query(
    `SELECT COUNT(*)::int AS c FROM kernel_events
     WHERE event_class = 'access'
       AND occurred_at >= (CURRENT_TIMESTAMP - ($1::text || ' hours')::interval)`,
    [String(windowHours)],
  );
  return Number((result.rows[0] as { c: number }).c ?? 0);
}
