-- Migration staging schema (Story 6.2 / AD-4).
-- Separate from production event-store: batch payload lives here until atomic cutover.
-- Provisional AR-MIGRATION — pending freeze; do not claim production cutover readiness.

CREATE SCHEMA IF NOT EXISTS migration_staging;

CREATE TABLE IF NOT EXISTS migration_staging.import_batch (
  id                    UUID PRIMARY KEY,
  preview_batch_id      UUID NOT NULL,
  template_key          TEXT NOT NULL,
  status                TEXT NOT NULL
                          CHECK (status IN (
                            'confirmed-draft',
                            'approved',
                            'staging-loaded',
                            'executing',
                            'cutover-complete',
                            'failed',
                            'rolled-back'
                          )),
  correlation_id        UUID NOT NULL,
  idempotency_key       TEXT NOT NULL,
  source_file_name      TEXT,
  source_content_hash   TEXT NOT NULL,
  uploaded_by           TEXT NOT NULL,
  uploaded_at           TIMESTAMPTZ NOT NULL,
  approved_by           TEXT,
  approved_at           TIMESTAMPTZ,
  executed_by           TEXT,
  executed_at           TIMESTAMPTZ,
  owner_display_name    TEXT NOT NULL DEFAULT '',
  template_title_fa     TEXT NOT NULL DEFAULT '',
  visible_columns       JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_summary         JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT migration_staging_import_batch_preview_uid UNIQUE (preview_batch_id),
  CONSTRAINT migration_staging_import_batch_idem_uid UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS migration_staging_import_batch_status_idx
  ON migration_staging.import_batch (status);

CREATE INDEX IF NOT EXISTS migration_staging_import_batch_corr_idx
  ON migration_staging.import_batch (correlation_id);

CREATE TABLE IF NOT EXISTS migration_staging.import_batch_row (
  id           UUID PRIMARY KEY,
  batch_id     UUID NOT NULL
                 REFERENCES migration_staging.import_batch (id) ON DELETE CASCADE,
  row_id       UUID NOT NULL,
  source_row   INT NOT NULL,
  values       JSONB NOT NULL,
  CONSTRAINT migration_staging_import_batch_row_uid UNIQUE (batch_id, row_id)
);

CREATE INDEX IF NOT EXISTS migration_staging_import_batch_row_batch_idx
  ON migration_staging.import_batch_row (batch_id);

CREATE TABLE IF NOT EXISTS migration_staging.import_batch_evidence (
  id                   UUID PRIMARY KEY,
  batch_id             UUID NOT NULL
                         REFERENCES migration_staging.import_batch (id) ON DELETE CASCADE,
  status               TEXT NOT NULL
                         CHECK (status IN (
                           'cutover-complete',
                           'failed',
                           'rolled-back'
                         )),
  actors               JSONB NOT NULL,
  counts               JSONB NOT NULL,
  errors               JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_record_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_event_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,
  correlation_id       UUID NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS migration_staging_evidence_batch_idx
  ON migration_staging.import_batch_evidence (batch_id);

CREATE INDEX IF NOT EXISTS migration_staging_evidence_status_idx
  ON migration_staging.import_batch_evidence (status);

-- Overlap keys held while a batch is executing (personnel codes / person ids).
-- Unique primary key blocks concurrent overlapping cutovers.
CREATE TABLE IF NOT EXISTS migration_staging.execution_overlap_key (
  overlap_key   TEXT PRIMARY KEY,
  batch_id      UUID NOT NULL
                  REFERENCES migration_staging.import_batch (id) ON DELETE CASCADE,
  owner_account TEXT NOT NULL,
  owner_display TEXT NOT NULL DEFAULT '',
  correlation_id UUID NOT NULL,
  locked_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS migration_staging_overlap_batch_idx
  ON migration_staging.execution_overlap_key (batch_id);
