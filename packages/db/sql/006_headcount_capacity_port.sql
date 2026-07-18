-- Narrow headcount capacity port (Story 4.5) — NOT full Approval/Matching/Reservation product.
-- Fail-closed slots for Start/Return capacity checks + consume/link on Effective apply.

CREATE TABLE IF NOT EXISTS headcount_capacity_slot (
  id              UUID PRIMARY KEY,
  team_id         UUID NOT NULL,
  job_title_id    UUID,
  ladder_id       UUID,
  grade_id        UUID,
  -- Inclusive open; exclusive end. Null end = unbounded availability window.
  start_date      DATE NOT NULL,
  end_date_exclusive DATE,
  -- Remaining free units (1 = one Start/Return may consume).
  free_units      INTEGER NOT NULL CHECK (free_units >= 0),
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS headcount_capacity_slot_team_idx
  ON headcount_capacity_slot (team_id);

CREATE TABLE IF NOT EXISTS headcount_capacity_consumption (
  id              UUID PRIMARY KEY,
  slot_id         UUID NOT NULL REFERENCES headcount_capacity_slot(id) ON DELETE RESTRICT,
  event_id        UUID NOT NULL,
  person_id       UUID NOT NULL,
  consumed_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS headcount_capacity_consumption_slot_idx
  ON headcount_capacity_consumption (slot_id);
