-- Migration reconciliation schema (Story 6.4 / FR-40 / LG-1).
-- Lives under migration_staging (same AD-4 staging boundary as 013).
-- Signed reconciliation evidence gates production cutover — not a production SoT.
-- AR-MIGRATION / AR-CUTOVER pending freeze; provisional substrate only.

CREATE SCHEMA IF NOT EXISTS migration_staging;

CREATE TABLE IF NOT EXISTS migration_staging.reconciliation_run (
  id                      UUID PRIMARY KEY,
  batch_id                UUID NOT NULL
                            REFERENCES migration_staging.import_batch (id) ON DELETE CASCADE,
  tier                    TEXT NOT NULL
                            CHECK (tier IN ('trial', 'final', 'production-candidate')),
  status                  TEXT NOT NULL
                            CHECK (status IN (
                              'draft',
                              'in-progress',
                              'signed',
                              'rejected',
                              'superseded'
                            )),
  correlation_id          UUID NOT NULL,
  source_extract_version  TEXT,
  notes                   TEXT,
  created_by              TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  frozen_at               TIMESTAMPTZ,
  evidence_hash           TEXT
);

CREATE INDEX IF NOT EXISTS migration_staging_recon_run_batch_idx
  ON migration_staging.reconciliation_run (batch_id);

CREATE INDEX IF NOT EXISTS migration_staging_recon_run_status_idx
  ON migration_staging.reconciliation_run (status);

CREATE TABLE IF NOT EXISTS migration_staging.reconciliation_control (
  id            UUID PRIMARY KEY,
  run_id        UUID NOT NULL
                  REFERENCES migration_staging.reconciliation_run (id) ON DELETE CASCADE,
  domain_key    TEXT NOT NULL,
  control_value JSONB NOT NULL,
  attested_by   TEXT NOT NULL,
  attested_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  label_fa      TEXT NOT NULL DEFAULT '',
  CONSTRAINT migration_staging_recon_control_uid UNIQUE (run_id, domain_key)
);

CREATE INDEX IF NOT EXISTS migration_staging_recon_control_run_idx
  ON migration_staging.reconciliation_control (run_id);

CREATE TABLE IF NOT EXISTS migration_staging.reconciliation_observation (
  id                 UUID PRIMARY KEY,
  run_id             UUID NOT NULL
                       REFERENCES migration_staging.reconciliation_run (id) ON DELETE CASCADE,
  domain_key         TEXT NOT NULL,
  observed_value     JSONB NOT NULL,
  computed_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  computation_notes  TEXT,
  CONSTRAINT migration_staging_recon_observation_uid UNIQUE (run_id, domain_key)
);

CREATE INDEX IF NOT EXISTS migration_staging_recon_observation_run_idx
  ON migration_staging.reconciliation_observation (run_id);

CREATE TABLE IF NOT EXISTS migration_staging.reconciliation_discrepancy (
  id                         UUID PRIMARY KEY,
  run_id                     UUID NOT NULL
                               REFERENCES migration_staging.reconciliation_run (id) ON DELETE CASCADE,
  domain_key                 TEXT NOT NULL,
  severity                   TEXT NOT NULL
                               CHECK (severity IN ('critical', 'warning')),
  status                     TEXT NOT NULL
                               CHECK (status IN ('open', 'accepted', 'waived', 'resolved')),
  owner_account_id           TEXT,
  owner_display              TEXT,
  disposition_code           TEXT,
  disposition_rationale_fa   TEXT,
  disposition_by             TEXT,
  disposition_at             TIMESTAMPTZ,
  -- FR-55-shaped waiver fields (required when disposition=waived for critical)
  waiver_independent_approver TEXT,
  waiver_scope               TEXT,
  waiver_risk                TEXT,
  waiver_compensating_control TEXT,
  waiver_expiry              TIMESTAMPTZ,
  integrity_class            TEXT
);

CREATE INDEX IF NOT EXISTS migration_staging_recon_discrepancy_run_idx
  ON migration_staging.reconciliation_discrepancy (run_id);

CREATE INDEX IF NOT EXISTS migration_staging_recon_discrepancy_open_idx
  ON migration_staging.reconciliation_discrepancy (run_id, severity, status);

-- One discrepancy row per domain per run (compare replace + Map keyed by domain)
CREATE UNIQUE INDEX IF NOT EXISTS migration_staging_recon_discrepancy_uid
  ON migration_staging.reconciliation_discrepancy (run_id, domain_key);

CREATE TABLE IF NOT EXISTS migration_staging.reconciliation_signature (
  id                UUID PRIMARY KEY,
  run_id            UUID NOT NULL
                      REFERENCES migration_staging.reconciliation_run (id) ON DELETE CASCADE,
  role_code         TEXT NOT NULL
                      CHECK (role_code IN ('migration_lead', 'hr_data_owner')),
  signer_account_id TEXT NOT NULL,
  signed_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  evidence_hash     TEXT NOT NULL,
  CONSTRAINT migration_staging_recon_signature_uid UNIQUE (run_id, role_code)
);

CREATE INDEX IF NOT EXISTS migration_staging_recon_signature_run_idx
  ON migration_staging.reconciliation_signature (run_id);
