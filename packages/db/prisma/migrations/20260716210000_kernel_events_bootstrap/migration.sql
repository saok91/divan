-- Kernel append-only event store (AD-3 / AD-6).
-- Applied via raw SQL — NOT Prisma migrations.
-- See packages/db/sql/README.md for apply instructions.

CREATE TABLE IF NOT EXISTS kernel_events (
  id UUID PRIMARY KEY,
  event_class TEXT NOT NULL CHECK (event_class IN ('business', 'access')),
  correlation_id UUID NOT NULL,
  actor_account_id UUID NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  operation TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  result TEXT NULL CHECK (result IS NULL OR result IN ('allow', 'deny')),
  reason TEXT NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT kernel_events_access_result_chk CHECK (
    event_class <> 'access' OR result IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS kernel_events_correlation_id_idx
  ON kernel_events (correlation_id);

CREATE INDEX IF NOT EXISTS kernel_events_occurred_at_idx
  ON kernel_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS kernel_events_event_class_idx
  ON kernel_events (event_class);

COMMENT ON TABLE kernel_events IS
  'Append-only kernel event log. Access events never feed projections. No UPDATE/DELETE via app API.';

-- Harden when the app role is not a superuser (no-op / skipped if current role owns table as superuser labs).
-- REVOKE UPDATE, DELETE ON kernel_events FROM PUBLIC;
