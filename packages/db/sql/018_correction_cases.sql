-- External data-subject correction cases (Story 7.5 / FR-53).
-- Schema: correction_case — ordinary category correction.case (NOT person health).
-- Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
-- Case / attachment / evidence / outcome history rows are NEVER deleted
-- (close / reject / quarantine = status flip).
-- AR-DATA / AR-ACCESS pending freeze; provisional substrate only.
-- Do NOT claim LG-3 / jurisdiction / GDPR / general DMS complete.

CREATE SCHEMA IF NOT EXISTS correction_case;

CREATE TABLE IF NOT EXISTS correction_case.case (
  id                        UUID PRIMARY KEY,
  request_reference         TEXT NOT NULL,
  authority_verified_at     TIMESTAMPTZ NOT NULL,
  authority_verified_by     TEXT NOT NULL,
  person_id                 UUID NOT NULL,
  owner_account_id          TEXT NOT NULL,
  status                    TEXT NOT NULL
                              CHECK (status IN (
                                'open',
                                'in_progress',
                                'pending_decision',
                                'approved',
                                'rejected',
                                'constrained',
                                'closed',
                                'breached'
                              )),
  breached_at               TIMESTAMPTZ,
  deadline_at               TIMESTAMPTZ NOT NULL,
  decision                  TEXT
                              CHECK (
                                decision IS NULL
                                OR decision IN ('approved', 'rejected', 'constrained')
                              ),
  decision_reason           TEXT,
  closure_evidence          JSONB,
  correlation_id            UUID NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                TEXT NOT NULL,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by                TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS correction_case_case_status_idx
  ON correction_case.case (status);

CREATE INDEX IF NOT EXISTS correction_case_case_person_idx
  ON correction_case.case (person_id);

CREATE INDEX IF NOT EXISTS correction_case_case_deadline_idx
  ON correction_case.case (deadline_at)
  WHERE status IN ('open', 'in_progress', 'pending_decision', 'breached');

CREATE INDEX IF NOT EXISTS correction_case_case_breached_idx
  ON correction_case.case (breached_at)
  WHERE breached_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS correction_case_case_owner_idx
  ON correction_case.case (owner_account_id);

CREATE INDEX IF NOT EXISTS correction_case_case_corr_idx
  ON correction_case.case (correlation_id);

-- Limit duplicate spam of identical open request refs per person.
CREATE UNIQUE INDEX IF NOT EXISTS correction_case_case_open_req_person_uid
  ON correction_case.case (person_id, request_reference)
  WHERE status IN ('open', 'in_progress', 'pending_decision', 'breached');

CREATE TABLE IF NOT EXISTS correction_case.evidence_ref (
  id                        UUID PRIMARY KEY,
  case_id                   UUID NOT NULL
                              REFERENCES correction_case.case (id),
  kind                      TEXT NOT NULL
                              CHECK (kind IN (
                                'request',
                                'response',
                                'internal',
                                'other'
                              )),
  uri_or_ref                TEXT NOT NULL,
  metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_account_id          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS correction_case_evidence_case_idx
  ON correction_case.evidence_ref (case_id);

CREATE TABLE IF NOT EXISTS correction_case.attachment (
  id                        UUID PRIMARY KEY,
  case_id                   UUID NOT NULL
                              REFERENCES correction_case.case (id),
  storage_key               UUID NOT NULL UNIQUE,
  original_filename_minimized TEXT NOT NULL,
  content_type_detected     TEXT NOT NULL,
  size_bytes                INTEGER NOT NULL CHECK (size_bytes >= 0),
  inspection_status         TEXT NOT NULL
                              CHECK (inspection_status IN (
                                'allowed',
                                'rejected',
                                'quarantined'
                              )),
  sha256                    TEXT,
  content_bytes             BYTEA,
  uploaded_by               TEXT NOT NULL,
  uploaded_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS correction_case_attachment_case_idx
  ON correction_case.attachment (case_id);

CREATE INDEX IF NOT EXISTS correction_case_attachment_status_idx
  ON correction_case.attachment (inspection_status);

CREATE TABLE IF NOT EXISTS correction_case.outcome_link (
  id                        UUID PRIMARY KEY,
  case_id                   UUID NOT NULL
                              REFERENCES correction_case.case (id),
  link_type                 TEXT NOT NULL
                              CHECK (link_type IN (
                                'personnel_correction',
                                'disposal_run',
                                'hold',
                                'recalc',
                                'published_artifact',
                                'response_evidence',
                                'pending_publication_hook'
                              )),
  target_id                 TEXT NOT NULL,
  note                      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_account_id          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS correction_case_outcome_case_idx
  ON correction_case.outcome_link (case_id);

CREATE INDEX IF NOT EXISTS correction_case_outcome_type_idx
  ON correction_case.outcome_link (link_type, target_id);

-- Attributable case events (breach cue, status notes) — not a parallel audit SoT.
CREATE TABLE IF NOT EXISTS correction_case.case_event (
  id                        UUID PRIMARY KEY,
  case_id                   UUID NOT NULL
                              REFERENCES correction_case.case (id),
  kind                      TEXT NOT NULL,
  detail                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_account_id          TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  correlation_id            UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS correction_case_case_event_case_idx
  ON correction_case.case_event (case_id);
