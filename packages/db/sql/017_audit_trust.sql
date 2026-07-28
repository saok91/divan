-- Audit trust fail-safe: writer suspend + incidents + integrity runs (Story 7.4 / FR-51 / NFR-9).
-- Schema: audit_trust — ordinary category audit.trust (NOT person health).
-- Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
-- Incident history rows are NEVER deleted (close = status + attributable fields).
-- AR-AUDIT / AR-ACCESS / AR-NFR pending freeze; provisional substrate only.
-- Do NOT claim hash-chain / LG-2 / signed NTP complete.
-- Hash-chain remains Architecture Deferred — MVP = trigger + verification + suspend.

CREATE SCHEMA IF NOT EXISTS audit_trust;

-- Singleton (or env-scoped) writer control-plane state.
CREATE TABLE IF NOT EXISTS audit_trust.writer_state (
  env_key                 TEXT PRIMARY KEY DEFAULT 'default',
  status                  TEXT NOT NULL
                            CHECK (status IN ('ok', 'degraded', 'suspended')),
  reason                  TEXT,
  suspended_at            TIMESTAMPTZ,
  suspended_by            TEXT,
  clear_requires_review   BOOLEAN NOT NULL DEFAULT TRUE,
  correlation_id          UUID,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_trust_writer_state_suspend_chk
    CHECK (
      (status <> 'suspended')
      OR (suspended_at IS NOT NULL)
    )
);

INSERT INTO audit_trust.writer_state (env_key, status, clear_requires_review)
VALUES ('default', 'ok', TRUE)
ON CONFLICT (env_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_trust.incident (
  id                      UUID PRIMARY KEY,
  kind                    TEXT NOT NULL
                            CHECK (kind IN (
                              'append_fail',
                              'clock_anomaly',
                              'integrity_fail',
                              'capture_gap',
                              'interrupted'
                            )),
  status                  TEXT NOT NULL
                            CHECK (status IN (
                              'open',
                              'assigned',
                              'acknowledged',
                              'closed'
                            )),
  assigned_to             TEXT,
  detected_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at               TIMESTAMPTZ,
  closed_by               TEXT,
  detail                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id          UUID NOT NULL,
  subject_account_id      TEXT,
  CONSTRAINT audit_trust_incident_close_chk
    CHECK (
      (status <> 'closed')
      OR (closed_at IS NOT NULL AND closed_by IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS audit_trust_incident_open_idx
  ON audit_trust.incident (status, detected_at DESC)
  WHERE status IN ('open', 'assigned', 'acknowledged');

CREATE INDEX IF NOT EXISTS audit_trust_incident_kind_idx
  ON audit_trust.incident (kind);

CREATE INDEX IF NOT EXISTS audit_trust_incident_corr_idx
  ON audit_trust.incident (correlation_id);

CREATE TABLE IF NOT EXISTS audit_trust.integrity_verification_run (
  id                      UUID PRIMARY KEY,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at            TIMESTAMPTZ,
  outcome                 TEXT NOT NULL
                            CHECK (outcome IN ('pass', 'fail')),
  window_label            TEXT NOT NULL,
  findings                JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_account_id        TEXT NOT NULL,
  correlation_id          UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_trust_integrity_run_corr_idx
  ON audit_trust.integrity_verification_run (correlation_id);

CREATE INDEX IF NOT EXISTS audit_trust_integrity_run_started_idx
  ON audit_trust.integrity_verification_run (started_at DESC);
