/**
 * Reconciliation persistence (Story 6.4 / FR-40).
 * Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
 * Schema: migration_staging (same AD-4 boundary as staging tables).
 */

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "@divan/db";

import type {
  Lg1IntegrityClass,
  ReconciliationDomainKey,
} from "./reconciliation-domains";

export type PgQueryable = Pool | PoolClient;

export type ReconciliationTier = "trial" | "final" | "production-candidate";

export type ReconciliationRunStatus =
  | "draft"
  | "in-progress"
  | "signed"
  | "rejected"
  | "superseded";

export type DiscrepancySeverity = "critical" | "warning";

export type DiscrepancyStatus =
  | "open"
  | "accepted"
  | "waived"
  | "resolved";

export type SignatureRoleCode = "migration_lead" | "hr_data_owner";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ReconciliationControl = {
  id: string;
  runId: string;
  domainKey: ReconciliationDomainKey;
  controlValue: JsonValue;
  attestedBy: string;
  attestedAt: string;
  labelFa: string;
};

export type ReconciliationObservation = {
  id: string;
  runId: string;
  domainKey: ReconciliationDomainKey;
  observedValue: JsonValue;
  computedAt: string;
  computationNotes: string | null;
};

export type ReconciliationDiscrepancy = {
  id: string;
  runId: string;
  domainKey: ReconciliationDomainKey;
  severity: DiscrepancySeverity;
  status: DiscrepancyStatus;
  ownerAccountId: string | null;
  ownerDisplay: string | null;
  dispositionCode: string | null;
  dispositionRationaleFa: string | null;
  dispositionBy: string | null;
  dispositionAt: string | null;
  waiverIndependentApprover: string | null;
  waiverScope: string | null;
  waiverRisk: string | null;
  waiverCompensatingControl: string | null;
  waiverExpiry: string | null;
  integrityClass: Lg1IntegrityClass | null;
};

export type ReconciliationSignature = {
  id: string;
  runId: string;
  roleCode: SignatureRoleCode;
  signerAccountId: string;
  signedAt: string;
  evidenceHash: string;
};

export type ReconciliationRun = {
  id: string;
  batchId: string;
  tier: ReconciliationTier;
  status: ReconciliationRunStatus;
  correlationId: string;
  sourceExtractVersion: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  frozenAt: string | null;
  evidenceHash: string | null;
  controls: ReconciliationControl[];
  observations: ReconciliationObservation[];
  discrepancies: ReconciliationDiscrepancy[];
  signatures: ReconciliationSignature[];
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

function mapControl(row: Record<string, unknown>): ReconciliationControl {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    domainKey: String(row.domain_key) as ReconciliationDomainKey,
    controlValue: parseJson(row.control_value),
    attestedBy: String(row.attested_by),
    attestedAt: new Date(String(row.attested_at)).toISOString(),
    labelFa: String(row.label_fa ?? ""),
  };
}

function mapObservation(
  row: Record<string, unknown>,
): ReconciliationObservation {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    domainKey: String(row.domain_key) as ReconciliationDomainKey,
    observedValue: parseJson(row.observed_value),
    computedAt: new Date(String(row.computed_at)).toISOString(),
    computationNotes:
      row.computation_notes == null ? null : String(row.computation_notes),
  };
}

function mapDiscrepancy(
  row: Record<string, unknown>,
): ReconciliationDiscrepancy {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    domainKey: String(row.domain_key) as ReconciliationDomainKey,
    severity: row.severity as DiscrepancySeverity,
    status: row.status as DiscrepancyStatus,
    ownerAccountId:
      row.owner_account_id == null ? null : String(row.owner_account_id),
    ownerDisplay:
      row.owner_display == null ? null : String(row.owner_display),
    dispositionCode:
      row.disposition_code == null ? null : String(row.disposition_code),
    dispositionRationaleFa:
      row.disposition_rationale_fa == null
        ? null
        : String(row.disposition_rationale_fa),
    dispositionBy:
      row.disposition_by == null ? null : String(row.disposition_by),
    dispositionAt:
      row.disposition_at == null
        ? null
        : new Date(String(row.disposition_at)).toISOString(),
    waiverIndependentApprover:
      row.waiver_independent_approver == null
        ? null
        : String(row.waiver_independent_approver),
    waiverScope: row.waiver_scope == null ? null : String(row.waiver_scope),
    waiverRisk: row.waiver_risk == null ? null : String(row.waiver_risk),
    waiverCompensatingControl:
      row.waiver_compensating_control == null
        ? null
        : String(row.waiver_compensating_control),
    waiverExpiry:
      row.waiver_expiry == null
        ? null
        : new Date(String(row.waiver_expiry)).toISOString(),
    integrityClass:
      row.integrity_class == null
        ? null
        : (String(row.integrity_class) as Lg1IntegrityClass),
  };
}

function mapSignature(row: Record<string, unknown>): ReconciliationSignature {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    roleCode: row.role_code as SignatureRoleCode,
    signerAccountId: String(row.signer_account_id),
    signedAt: new Date(String(row.signed_at)).toISOString(),
    evidenceHash: String(row.evidence_hash),
  };
}

async function loadChildren(
  db: PgQueryable,
  runId: string,
): Promise<{
  controls: ReconciliationControl[];
  observations: ReconciliationObservation[];
  discrepancies: ReconciliationDiscrepancy[];
  signatures: ReconciliationSignature[];
}> {
  const [controls, observations, discrepancies, signatures] =
    await Promise.all([
      db.query(
        `SELECT * FROM migration_staging.reconciliation_control
         WHERE run_id = $1::uuid ORDER BY domain_key ASC`,
        [runId],
      ),
      db.query(
        `SELECT * FROM migration_staging.reconciliation_observation
         WHERE run_id = $1::uuid ORDER BY domain_key ASC`,
        [runId],
      ),
      db.query(
        `SELECT * FROM migration_staging.reconciliation_discrepancy
         WHERE run_id = $1::uuid ORDER BY domain_key ASC`,
        [runId],
      ),
      db.query(
        `SELECT * FROM migration_staging.reconciliation_signature
         WHERE run_id = $1::uuid ORDER BY role_code ASC`,
        [runId],
      ),
    ]);

  return {
    controls: controls.rows.map((r) =>
      mapControl(r as Record<string, unknown>),
    ),
    observations: observations.rows.map((r) =>
      mapObservation(r as Record<string, unknown>),
    ),
    discrepancies: discrepancies.rows.map((r) =>
      mapDiscrepancy(r as Record<string, unknown>),
    ),
    signatures: signatures.rows.map((r) =>
      mapSignature(r as Record<string, unknown>),
    ),
  };
}

function mapRunHeader(
  row: Record<string, unknown>,
): Omit<
  ReconciliationRun,
  "controls" | "observations" | "discrepancies" | "signatures"
> {
  return {
    id: String(row.id),
    batchId: String(row.batch_id),
    tier: row.tier as ReconciliationTier,
    status: row.status as ReconciliationRunStatus,
    correlationId: String(row.correlation_id),
    sourceExtractVersion:
      row.source_extract_version == null
        ? null
        : String(row.source_extract_version),
    notes: row.notes == null ? null : String(row.notes),
    createdBy: String(row.created_by),
    createdAt: new Date(String(row.created_at)).toISOString(),
    frozenAt:
      row.frozen_at == null
        ? null
        : new Date(String(row.frozen_at)).toISOString(),
    evidenceHash:
      row.evidence_hash == null ? null : String(row.evidence_hash),
  };
}

export async function insertReconciliationRun(
  db: PgQueryable,
  input: {
    batchId: string;
    tier: ReconciliationTier;
    correlationId: string;
    createdBy: string;
    sourceExtractVersion?: string | null;
    notes?: string | null;
  },
): Promise<ReconciliationRun> {
  const id = randomUUID();
  const now = new Date();
  await db.query(
    `INSERT INTO migration_staging.reconciliation_run (
       id, batch_id, tier, status, correlation_id,
       source_extract_version, notes, created_by, created_at
     ) VALUES (
       $1::uuid, $2::uuid, $3, 'draft', $4::uuid,
       $5, $6, $7, $8::timestamptz
     )`,
    [
      id,
      input.batchId,
      input.tier,
      input.correlationId,
      input.sourceExtractVersion ?? null,
      input.notes ?? null,
      input.createdBy,
      now.toISOString(),
    ],
  );
  return {
    id,
    batchId: input.batchId,
    tier: input.tier,
    status: "draft",
    correlationId: input.correlationId,
    sourceExtractVersion: input.sourceExtractVersion ?? null,
    notes: input.notes ?? null,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
    frozenAt: null,
    evidenceHash: null,
    controls: [],
    observations: [],
    discrepancies: [],
    signatures: [],
  };
}

export async function getReconciliationRun(
  db: PgQueryable,
  runId: string,
): Promise<ReconciliationRun | null> {
  const res = await db.query(
    `SELECT * FROM migration_staging.reconciliation_run WHERE id = $1::uuid`,
    [runId],
  );
  if (res.rows.length === 0) return null;
  const header = mapRunHeader(res.rows[0] as Record<string, unknown>);
  const children = await loadChildren(db, runId);
  return { ...header, ...children };
}

export async function listReconciliationRunsForBatch(
  db: PgQueryable,
  batchId: string,
): Promise<
  Array<
    Omit<
      ReconciliationRun,
      "controls" | "observations" | "discrepancies" | "signatures"
    >
  >
> {
  const res = await db.query(
    `SELECT * FROM migration_staging.reconciliation_run
     WHERE batch_id = $1::uuid
     ORDER BY created_at DESC`,
    [batchId],
  );
  return res.rows.map((r) => mapRunHeader(r as Record<string, unknown>));
}

export async function updateRunStatus(
  db: PgQueryable,
  opts: {
    runId: string;
    status: ReconciliationRunStatus;
    frozenAt?: string | null;
    evidenceHash?: string | null;
  },
): Promise<void> {
  await db.query(
    `UPDATE migration_staging.reconciliation_run
     SET status = $2,
         frozen_at = COALESCE($3::timestamptz, frozen_at),
         evidence_hash = COALESCE($4, evidence_hash)
     WHERE id = $1::uuid`,
    [
      opts.runId,
      opts.status,
      opts.frozenAt ?? null,
      opts.evidenceHash ?? null,
    ],
  );
}

export async function clearSignaturesForRun(
  db: PgQueryable,
  runId: string,
): Promise<void> {
  await db.query(
    `DELETE FROM migration_staging.reconciliation_signature WHERE run_id = $1::uuid`,
    [runId],
  );
  await db.query(
    `UPDATE migration_staging.reconciliation_run
     SET status = CASE WHEN status = 'signed' THEN 'in-progress' ELSE status END,
         frozen_at = NULL,
         evidence_hash = NULL
     WHERE id = $1::uuid`,
    [runId],
  );
}

export async function upsertControl(
  db: PgQueryable,
  input: {
    runId: string;
    domainKey: ReconciliationDomainKey;
    controlValue: JsonValue;
    attestedBy: string;
    labelFa?: string;
  },
): Promise<ReconciliationControl> {
  const id = randomUUID();
  const now = new Date();
  await db.query(
    `INSERT INTO migration_staging.reconciliation_control (
       id, run_id, domain_key, control_value, attested_by, attested_at, label_fa
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4::jsonb, $5, $6::timestamptz, $7
     )
     ON CONFLICT (run_id, domain_key) DO UPDATE SET
       control_value = EXCLUDED.control_value,
       attested_by = EXCLUDED.attested_by,
       attested_at = EXCLUDED.attested_at,
       label_fa = EXCLUDED.label_fa
     RETURNING id`,
    [
      id,
      input.runId,
      input.domainKey,
      JSON.stringify(input.controlValue),
      input.attestedBy,
      now.toISOString(),
      input.labelFa ?? "",
    ],
  );
  // Invalidate signatures when controls mutate after sign
  await clearSignaturesForRun(db, input.runId);
  const run = await getReconciliationRun(db, input.runId);
  const control = run?.controls.find((c) => c.domainKey === input.domainKey);
  if (!control) {
    return {
      id,
      runId: input.runId,
      domainKey: input.domainKey,
      controlValue: input.controlValue,
      attestedBy: input.attestedBy,
      attestedAt: now.toISOString(),
      labelFa: input.labelFa ?? "",
    };
  }
  return control;
}

export async function upsertObservation(
  db: PgQueryable,
  input: {
    runId: string;
    domainKey: ReconciliationDomainKey;
    observedValue: JsonValue;
    computationNotes?: string | null;
  },
): Promise<ReconciliationObservation> {
  const id = randomUUID();
  const now = new Date();
  await db.query(
    `INSERT INTO migration_staging.reconciliation_observation (
       id, run_id, domain_key, observed_value, computed_at, computation_notes
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4::jsonb, $5::timestamptz, $6
     )
     ON CONFLICT (run_id, domain_key) DO UPDATE SET
       observed_value = EXCLUDED.observed_value,
       computed_at = EXCLUDED.computed_at,
       computation_notes = EXCLUDED.computation_notes`,
    [
      id,
      input.runId,
      input.domainKey,
      JSON.stringify(input.observedValue),
      now.toISOString(),
      input.computationNotes ?? null,
    ],
  );
  return {
    id,
    runId: input.runId,
    domainKey: input.domainKey,
    observedValue: input.observedValue,
    computedAt: now.toISOString(),
    computationNotes: input.computationNotes ?? null,
  };
}

export async function replaceDiscrepancies(
  db: PgQueryable,
  runId: string,
  items: Array<{
    domainKey: ReconciliationDomainKey;
    severity: DiscrepancySeverity;
    status?: DiscrepancyStatus;
    integrityClass?: Lg1IntegrityClass | null;
    ownerAccountId?: string | null;
    ownerDisplay?: string | null;
  }>,
): Promise<ReconciliationDiscrepancy[]> {
  await db.query(
    `DELETE FROM migration_staging.reconciliation_discrepancy WHERE run_id = $1::uuid`,
    [runId],
  );
  const results: ReconciliationDiscrepancy[] = [];
  for (const item of items) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO migration_staging.reconciliation_discrepancy (
         id, run_id, domain_key, severity, status, integrity_class,
         owner_account_id, owner_display
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8
       )`,
      [
        id,
        runId,
        item.domainKey,
        item.severity,
        item.status ?? "open",
        item.integrityClass ?? null,
        item.ownerAccountId ?? null,
        item.ownerDisplay ?? null,
      ],
    );
    results.push({
      id,
      runId,
      domainKey: item.domainKey,
      severity: item.severity,
      status: item.status ?? "open",
      ownerAccountId: item.ownerAccountId ?? null,
      ownerDisplay: item.ownerDisplay ?? null,
      dispositionCode: null,
      dispositionRationaleFa: null,
      dispositionBy: null,
      dispositionAt: null,
      waiverIndependentApprover: null,
      waiverScope: null,
      waiverRisk: null,
      waiverCompensatingControl: null,
      waiverExpiry: null,
      integrityClass: item.integrityClass ?? null,
    });
  }
  return results;
}

export async function updateDiscrepancyDisposition(
  db: PgQueryable,
  input: {
    discrepancyId: string;
    status: DiscrepancyStatus;
    ownerAccountId: string;
    ownerDisplay?: string | null;
    dispositionCode: string;
    dispositionRationaleFa: string;
    dispositionBy: string;
    waiver?: {
      independentApprover: string;
      scope: string;
      risk: string;
      compensatingControl: string;
      expiry: string;
    } | null;
  },
): Promise<ReconciliationDiscrepancy | null> {
  const now = new Date();
  const res = await db.query(
    `UPDATE migration_staging.reconciliation_discrepancy SET
       status = $2,
       owner_account_id = $3,
       owner_display = COALESCE($4, owner_display),
       disposition_code = $5,
       disposition_rationale_fa = $6,
       disposition_by = $7,
       disposition_at = $8::timestamptz,
       waiver_independent_approver = $9,
       waiver_scope = $10,
       waiver_risk = $11,
       waiver_compensating_control = $12,
       waiver_expiry = $13::timestamptz
     WHERE id = $1::uuid
     RETURNING *`,
    [
      input.discrepancyId,
      input.status,
      input.ownerAccountId,
      input.ownerDisplay ?? null,
      input.dispositionCode,
      input.dispositionRationaleFa,
      input.dispositionBy,
      now.toISOString(),
      input.waiver?.independentApprover ?? null,
      input.waiver?.scope ?? null,
      input.waiver?.risk ?? null,
      input.waiver?.compensatingControl ?? null,
      input.waiver?.expiry ?? null,
    ],
  );
  if (res.rows.length === 0) return null;
  const disc = mapDiscrepancy(res.rows[0] as Record<string, unknown>);
  await clearSignaturesForRun(db, disc.runId);
  return disc;
}

export async function insertSignature(
  db: PgQueryable,
  input: {
    runId: string;
    roleCode: SignatureRoleCode;
    signerAccountId: string;
    evidenceHash: string;
  },
): Promise<ReconciliationSignature> {
  const id = randomUUID();
  const now = new Date();
  await db.query(
    `INSERT INTO migration_staging.reconciliation_signature (
       id, run_id, role_code, signer_account_id, signed_at, evidence_hash
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6
     )
     ON CONFLICT (run_id, role_code) DO UPDATE SET
       signer_account_id = EXCLUDED.signer_account_id,
       signed_at = EXCLUDED.signed_at,
       evidence_hash = EXCLUDED.evidence_hash`,
    [
      id,
      input.runId,
      input.roleCode,
      input.signerAccountId,
      now.toISOString(),
      input.evidenceHash,
    ],
  );
  return {
    id,
    runId: input.runId,
    roleCode: input.roleCode,
    signerAccountId: input.signerAccountId,
    signedAt: now.toISOString(),
    evidenceHash: input.evidenceHash,
  };
}
