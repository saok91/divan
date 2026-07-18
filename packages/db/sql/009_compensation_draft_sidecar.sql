-- Sensitive draft sidecar for CompensationChanged monetary values (Story 4.8 / FR-24).
-- Amounts must NOT travel in PersonnelEventDraft.payload (assertNoSensitiveEvidence denylist).
-- Owned by @divan/compensation-facts; web/person-employment use public put/take APIs only.

CREATE SCHEMA IF NOT EXISTS compensation;

CREATE TABLE IF NOT EXISTS compensation.draft_sensitive_values (
  draft_id    UUID PRIMARY KEY,
  values_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
