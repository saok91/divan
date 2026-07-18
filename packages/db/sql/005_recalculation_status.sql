-- Story 4.4: Durable recalculation pending / failed / stale signal (AD-6 / NFR3).
-- Applied via raw SQL — NOT Prisma migrations.
-- Never mutate kernel_events for rebuild; this table only tracks projection freshness.

CREATE TABLE IF NOT EXISTS recalculation_status (
  person_id UUID PRIMARY KEY,
  from_effective_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'failed', 'stale', 'clear')),
  generation BIGINT NOT NULL DEFAULT 1,
  job_key TEXT NOT NULL,
  last_error TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recalculation_status_status_idx
  ON recalculation_status (status)
  WHERE status IN ('pending', 'failed', 'stale');

COMMENT ON TABLE recalculation_status IS
  'AD-6 heavy historical recalc visibility. pending/failed/stale block gold CTAs; never serve stale as current.';
