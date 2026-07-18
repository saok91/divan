-- Narrow headcount reservation (Story 4.7 / FR-30) — NOT Approval/Matching/Override catalogue.
-- Scheduled Transfer reserves destination capacity; Cancel releases; Effective converts to consumption.

ALTER TABLE headcount_capacity_slot
  ADD COLUMN IF NOT EXISTS reserved_units INTEGER NOT NULL DEFAULT 0;

-- Ensure non-negative reserved_units (idempotent add)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'headcount_capacity_slot_reserved_units_check'
  ) THEN
    ALTER TABLE headcount_capacity_slot
      ADD CONSTRAINT headcount_capacity_slot_reserved_units_check
      CHECK (reserved_units >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS headcount_capacity_reservation (
  id              UUID PRIMARY KEY,
  slot_id         UUID NOT NULL REFERENCES headcount_capacity_slot(id) ON DELETE RESTRICT,
  event_id        UUID NOT NULL,
  person_id       UUID NOT NULL,
  status          TEXT NOT NULL DEFAULT 'reserved'
                    CHECK (status IN ('reserved', 'released', 'converted')),
  reserved_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS headcount_capacity_reservation_slot_idx
  ON headcount_capacity_reservation (slot_id);

CREATE INDEX IF NOT EXISTS headcount_capacity_reservation_status_idx
  ON headcount_capacity_reservation (status)
  WHERE status = 'reserved';
