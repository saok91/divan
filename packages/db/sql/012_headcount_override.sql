-- Headcount Override catalogue (Story 4.14 / FR-32).
-- Explicit rule violation with audit; free_units MAY go negative.
-- NOT Exemption (FR-29 coverage without consume).

-- Drop free_units >= 0 so Override-backed consume/reserve may drive free negative.
-- reserved_units CHECK (>=0) stays.
ALTER TABLE headcount_capacity_slot
  DROP CONSTRAINT IF EXISTS headcount_capacity_slot_free_units_check;

CREATE TABLE IF NOT EXISTS headcount_override (
  id                       UUID PRIMARY KEY,
  violated_rule            TEXT NOT NULL
                             CHECK (violated_rule IN (
                               'shortage',
                               'validity',
                               'job_title',
                               'seniority'
                             )),
  reason                   TEXT NOT NULL,
  actor_account_id         TEXT NOT NULL,
  related_event_id         UUID,
  related_assignment_id    TEXT,
  team_id                  TEXT NOT NULL,
  job_title_id             TEXT NOT NULL,
  seniority_id             TEXT,
  approval_id              UUID,
  slot_id                  UUID,
  capacity_snapshot        JSONB NOT NULL,
  status                   TEXT NOT NULL
                             CHECK (status IN ('active', 'superseded', 'voided')),
  created_by               TEXT,
  updated_by               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS headcount_override_status_idx
  ON headcount_override (status);

CREATE INDEX IF NOT EXISTS headcount_override_team_idx
  ON headcount_override (team_id);

CREATE INDEX IF NOT EXISTS headcount_override_rule_idx
  ON headcount_override (violated_rule);

CREATE INDEX IF NOT EXISTS headcount_override_event_idx
  ON headcount_override (related_event_id)
  WHERE related_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS headcount_override_slot_idx
  ON headcount_override (slot_id)
  WHERE slot_id IS NOT NULL;
