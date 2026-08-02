-- Governed export artifacts (Story 6.5 / FR-41 / FR-52).
-- Schema choice: `reporting` — Export capability map lives in reporting BC
-- (ARCHITECTURE-SPINE) via audit-envelope; not a new bounded context.
-- Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
-- AR-DATA / AR-ACCESS / AR-REPORTING pending freeze; provisional substrate only.

CREATE SCHEMA IF NOT EXISTS reporting;

CREATE TABLE IF NOT EXISTS reporting.export_artifact (
  id                      UUID PRIMARY KEY,
  owner_account_id        TEXT NOT NULL,
  purpose                 TEXT NOT NULL,
  classification          TEXT NOT NULL,
  classification_fa       TEXT NOT NULL,
  handling_fa             TEXT NOT NULL,
  scope_json              JSONB NOT NULL,
  field_ids               JSONB NOT NULL,
  source_surface          TEXT NOT NULL
                            CHECK (source_surface IN ('report', 'personnel_list', 'settings_inventory')),
  source_key              TEXT,
  filters_snapshot        JSONB NOT NULL,
  snapshot_hash           TEXT NOT NULL,
  format                  TEXT NOT NULL
                            CHECK (format IN ('csv', 'xlsx')),
  state                   TEXT NOT NULL
                            CHECK (state IN (
                              'pending',
                              'ready',
                              'expired',
                              'revoked',
                              'disposed'
                            )),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at              TIMESTAMPTZ NOT NULL,
  row_count               INTEGER NOT NULL DEFAULT 0,
  requires_custody_ack    BOOLEAN NOT NULL DEFAULT FALSE,
  has_sensitive_fields    BOOLEAN NOT NULL DEFAULT FALSE,
  correlation_id          UUID NOT NULL,
  content_bytes           BYTEA,
  content_filename        TEXT,
  population_authz_mode   TEXT,
  CONSTRAINT reporting_export_artifact_ready_bytes_chk
    CHECK (
      state <> 'ready'
      OR (content_bytes IS NOT NULL AND content_filename IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS reporting_export_artifact_owner_idx
  ON reporting.export_artifact (owner_account_id);

CREATE INDEX IF NOT EXISTS reporting_export_artifact_state_idx
  ON reporting.export_artifact (state);

CREATE INDEX IF NOT EXISTS reporting_export_artifact_expires_idx
  ON reporting.export_artifact (expires_at);

CREATE TABLE IF NOT EXISTS reporting.export_artifact_retrieval (
  id                      UUID PRIMARY KEY,
  artifact_id             UUID NOT NULL
                            REFERENCES reporting.export_artifact (id) ON DELETE CASCADE,
  retriever_account_id    TEXT NOT NULL,
  retrieved_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recipient               TEXT NOT NULL,
  destination_class       TEXT NOT NULL
                            CHECK (destination_class IN (
                              'local_download',
                              'shared_drive',
                              'email',
                              'other'
                            )),
  custody_ack_at          TIMESTAMPTZ,
  reauth_reason           TEXT NOT NULL,
  reauth_outcome          TEXT NOT NULL
                            CHECK (reauth_outcome IN ('allowed', 'denied')),
  correlation_id          UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS reporting_export_retrieval_artifact_idx
  ON reporting.export_artifact_retrieval (artifact_id);

CREATE TABLE IF NOT EXISTS reporting.export_artifact_lifecycle_event (
  id                      UUID PRIMARY KEY,
  artifact_id             UUID NOT NULL
                            REFERENCES reporting.export_artifact (id) ON DELETE CASCADE,
  event_kind              TEXT NOT NULL
                            CHECK (event_kind IN (
                              'created',
                              'ready',
                              'revoked',
                              'disposed',
                              'expired',
                              'download_denied'
                            )),
  actor_account_id        TEXT NOT NULL,
  occurred_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason                  TEXT,
  correlation_id          UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS reporting_export_lifecycle_artifact_idx
  ON reporting.export_artifact_lifecycle_event (artifact_id);
