-- Data lifecycle: legal hold + disposal evidence (Story 7.3 / FR-50).
-- Schema: data_lifecycle — ordinary category data.lifecycle (NOT person health).
-- Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
-- Hold history rows are NEVER deleted (release = status flip).
-- AR-DATA / AR-ACCESS pending freeze; provisional substrate only.
-- Do NOT claim LG-3 / jurisdiction / signed retention complete.

CREATE SCHEMA IF NOT EXISTS data_lifecycle;

CREATE TABLE IF NOT EXISTS data_lifecycle.legal_hold (
  id                      UUID PRIMARY KEY,
  scope_kind              TEXT NOT NULL
                            CHECK (scope_kind IN (
                              'person',
                              'element_category',
                              'artifact',
                              'org_scope'
                            )),
  scope_ref               TEXT NOT NULL,
  reason                  TEXT NOT NULL,
  placed_by               TEXT NOT NULL,
  placed_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_by             TEXT,
  released_at             TIMESTAMPTZ,
  status                  TEXT NOT NULL
                            CHECK (status IN ('active', 'released')),
  correlation_id          UUID NOT NULL,
  CONSTRAINT data_lifecycle_legal_hold_release_chk
    CHECK (
      (status = 'active' AND released_by IS NULL AND released_at IS NULL)
      OR (status = 'released' AND released_by IS NOT NULL AND released_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS data_lifecycle_legal_hold_active_scope_idx
  ON data_lifecycle.legal_hold (scope_kind, scope_ref)
  WHERE status = 'active';

-- At most one active hold per exact scope (release flips status; history retained).
CREATE UNIQUE INDEX IF NOT EXISTS data_lifecycle_legal_hold_active_scope_uid
  ON data_lifecycle.legal_hold (scope_kind, scope_ref)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS data_lifecycle_legal_hold_status_idx
  ON data_lifecycle.legal_hold (status);

CREATE INDEX IF NOT EXISTS data_lifecycle_legal_hold_corr_idx
  ON data_lifecycle.legal_hold (correlation_id);

CREATE TABLE IF NOT EXISTS data_lifecycle.disposal_run (
  id                      UUID PRIMARY KEY,
  trigger                 TEXT NOT NULL,
  scope_kind              TEXT NOT NULL,
  scope_ref               TEXT NOT NULL,
  actor_account_id        TEXT NOT NULL,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at            TIMESTAMPTZ,
  status                  TEXT NOT NULL
                            CHECK (status IN (
                              'running',
                              'completed',
                              'failed',
                              'partial',
                              'blocked'
                            )),
  correlation_id          UUID NOT NULL,
  restore_catchup_required BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS data_lifecycle_disposal_run_corr_idx
  ON data_lifecycle.disposal_run (correlation_id);

CREATE INDEX IF NOT EXISTS data_lifecycle_disposal_run_status_idx
  ON data_lifecycle.disposal_run (status);

CREATE TABLE IF NOT EXISTS data_lifecycle.propagation_result (
  id                      UUID PRIMARY KEY,
  run_id                  UUID NOT NULL
                            REFERENCES data_lifecycle.disposal_run (id),
  target_kind             TEXT NOT NULL,
  target_id               TEXT,
  outcome                 TEXT NOT NULL
                            CHECK (outcome IN (
                              'applied',
                              'skipped',
                              'failed',
                              'blocked_by_hold'
                            )),
  detail_fa               TEXT,
  correlation_id          UUID NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS data_lifecycle_propagation_run_idx
  ON data_lifecycle.propagation_result (run_id);

-- Operational field disposal markers for reconstruction honesty (never fabricate).
CREATE TABLE IF NOT EXISTS data_lifecycle.disposed_field (
  id                      UUID PRIMARY KEY,
  person_id               UUID NOT NULL,
  field_key               TEXT NOT NULL,
  element_id              TEXT,
  action                  TEXT NOT NULL
                            CHECK (action IN (
                              'anonymize',
                              'delete',
                              'restrict'
                            )),
  run_id                  UUID
                            REFERENCES data_lifecycle.disposal_run (id),
  disposed_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  correlation_id          UUID NOT NULL,
  CONSTRAINT data_lifecycle_disposed_field_uid UNIQUE (person_id, field_key)
);

CREATE INDEX IF NOT EXISTS data_lifecycle_disposed_field_person_idx
  ON data_lifecycle.disposed_field (person_id);
