-- Headcount Exemption (Story 4.13 / FR-29).
-- Audited Primary coverage without consuming Approval capacity.
-- NOT Override catalogue / negative free (→ 4.14).

CREATE TABLE IF NOT EXISTS headcount_exemption (
  id                       UUID PRIMARY KEY,
  policy_code              TEXT NOT NULL,
  primary_assignment_id    TEXT NOT NULL,
  person_id                UUID NOT NULL,
  actor_account_id         TEXT NOT NULL,
  approver_account_id      TEXT NOT NULL,
  reason                   TEXT NOT NULL,
  validity_start           DATE NOT NULL,
  validity_end_exclusive   DATE NOT NULL,
  reporting_treatment      TEXT NOT NULL
                             CHECK (reporting_treatment IN (
                               'exclude_from_used',
                               'count_as_used_exempt',
                               'other'
                             )),
  status                   TEXT NOT NULL
                             CHECK (status IN ('draft', 'active', 'revoked', 'expired')),
  created_by               TEXT,
  updated_by               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT headcount_exemption_validity_nonempty
    CHECK (validity_end_exclusive > validity_start)
);

CREATE INDEX IF NOT EXISTS headcount_exemption_primary_idx
  ON headcount_exemption (primary_assignment_id);

CREATE INDEX IF NOT EXISTS headcount_exemption_person_idx
  ON headcount_exemption (person_id);

CREATE INDEX IF NOT EXISTS headcount_exemption_status_idx
  ON headcount_exemption (status);

CREATE INDEX IF NOT EXISTS headcount_exemption_policy_idx
  ON headcount_exemption (policy_code);
