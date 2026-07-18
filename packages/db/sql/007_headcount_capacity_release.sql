-- Narrow headcount capacity release (Story 4.6 / FR-31) — NOT Reservation product.
-- Marks a consumption as released and restores free_units; idempotent on release_event_id.

ALTER TABLE headcount_capacity_consumption
  ADD COLUMN IF NOT EXISTS release_event_id UUID;

CREATE INDEX IF NOT EXISTS headcount_capacity_consumption_release_event_idx
  ON headcount_capacity_consumption (release_event_id)
  WHERE release_event_id IS NOT NULL;
