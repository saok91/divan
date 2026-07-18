-- Headcount Approval lifecycle (Story 4.12 / FR-28).
-- Note: 009_compensation_draft_sidecar.sql already exists — this is 010.
-- Capacity ceiling entity; consumption/reservation remain on slot ledger.
-- NOT Matching matrix, exemptions, Override catalogue (→ 4.13 / 4.14).

CREATE TABLE IF NOT EXISTS headcount_approval (
  id                       UUID PRIMARY KEY,
  requirement_code         TEXT NOT NULL,
  team_id                  UUID NOT NULL,
  job_title_id             UUID NOT NULL,
  seniority_id             UUID,
  allowed_count            INTEGER NOT NULL CHECK (allowed_count >= 0),
  validity_start           DATE NOT NULL,
  validity_end_exclusive   DATE NOT NULL,
  status                   TEXT NOT NULL
                             CHECK (status IN ('draft', 'active', 'cancelled', 'expired')),
  approval_reference       TEXT,
  owner_account_id         UUID,
  created_by               TEXT,
  updated_by               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT headcount_approval_validity_nonempty
    CHECK (validity_end_exclusive > validity_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS headcount_approval_requirement_code_uidx
  ON headcount_approval (requirement_code);

CREATE INDEX IF NOT EXISTS headcount_approval_team_idx
  ON headcount_approval (team_id);

CREATE INDEX IF NOT EXISTS headcount_approval_status_idx
  ON headcount_approval (status);

-- Bridge: capacity slot may be backed by an Approval (product path).
ALTER TABLE headcount_capacity_slot
  ADD COLUMN IF NOT EXISTS approval_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS headcount_capacity_slot_approval_uidx
  ON headcount_capacity_slot (approval_id)
  WHERE approval_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'headcount_capacity_slot_approval_id_fkey'
  ) THEN
    ALTER TABLE headcount_capacity_slot
      ADD CONSTRAINT headcount_capacity_slot_approval_id_fkey
      FOREIGN KEY (approval_id) REFERENCES headcount_approval(id) ON DELETE RESTRICT;
  END IF;
END $$;
