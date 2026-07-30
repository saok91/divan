-- Launch Artifact Register change-control substrate (Story 7.7 / FR-55).
-- Schema: governance — distinct from reporting.export_artifact / decision_publication.
-- Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
-- Honest seed statuses only; do not claim LG-1 / LG-6 / production AR freeze.
-- Immutability: approved version decision columns cannot be silently rewritten.
-- DELETE forbidden on version/waiver/conflict/rebaseline history tables.

CREATE SCHEMA IF NOT EXISTS governance;

CREATE TABLE IF NOT EXISTS governance.launch_artifact (
  id                    TEXT PRIMARY KEY
                          CHECK (id IN (
                            'AR-ACCESS', 'AR-TEMPORAL', 'AR-HEADCOUNT', 'AR-DATA',
                            'AR-IDENTITY', 'AR-AUDIT', 'AR-MIGRATION', 'AR-REPORTING',
                            'AR-NFR', 'AR-SECONDARY', 'AR-CUTOVER'
                          )),
  title                 TEXT NOT NULL,
  purpose_summary       TEXT NOT NULL,
  owner_account_id      TEXT,
  current_version_id    UUID,
  status                TEXT NOT NULL
                          CHECK (status IN (
                            'pending', 'partial_freeze', 'approved',
                            'superseded', 'expired'
                          )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS governance.launch_artifact_version (
  id                      UUID PRIMARY KEY,
  artifact_id             TEXT NOT NULL
                            REFERENCES governance.launch_artifact (id),
  version_label           TEXT NOT NULL,
  status                  TEXT NOT NULL
                            CHECK (status IN (
                              'draft', 'approved', 'superseded', 'expired'
                            )),
  effective_from          TIMESTAMPTZ,
  effective_to            TIMESTAMPTZ,
  scope_summary           TEXT NOT NULL,
  affected_fr_nfr         JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_history        JSONB NOT NULL DEFAULT '[]'::jsonb,
  supersedes_version_id   UUID,
  content_ref             TEXT,
  content_hash            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by              TEXT NOT NULL,
  correlation_id          UUID NOT NULL,
  UNIQUE (artifact_id, version_label)
);

CREATE INDEX IF NOT EXISTS governance_launch_artifact_version_artifact_status_idx
  ON governance.launch_artifact_version (artifact_id, status);

CREATE INDEX IF NOT EXISTS governance_launch_artifact_version_effective_idx
  ON governance.launch_artifact_version (artifact_id, effective_from, effective_to);

ALTER TABLE governance.launch_artifact
  DROP CONSTRAINT IF EXISTS launch_artifact_current_version_fk;
ALTER TABLE governance.launch_artifact
  ADD CONSTRAINT launch_artifact_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES governance.launch_artifact_version (id);

CREATE TABLE IF NOT EXISTS governance.launch_artifact_waiver (
  id                                  UUID PRIMARY KEY,
  artifact_id                         TEXT NOT NULL
                                        REFERENCES governance.launch_artifact (id),
  artifact_version_id                 UUID
                                        REFERENCES governance.launch_artifact_version (id),
  owner_account_id                    TEXT NOT NULL,
  independent_approver_account_id     TEXT NOT NULL,
  requester_account_id                TEXT NOT NULL,
  scope                               TEXT NOT NULL,
  risk                                TEXT NOT NULL,
  compensating_controls               TEXT NOT NULL,
  expiry                              TIMESTAMPTZ NOT NULL,
  status                              TEXT NOT NULL
                                        CHECK (status IN ('open', 'closed', 'expired')),
  closure_evidence                    TEXT,
  target_gate_code                    TEXT,
  non_waiverable_attempt_code         TEXT,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at                           TIMESTAMPTZ,
  correlation_id                      UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS governance_launch_artifact_waiver_expiry_idx
  ON governance.launch_artifact_waiver (status, expiry);

CREATE INDEX IF NOT EXISTS governance_launch_artifact_waiver_artifact_idx
  ON governance.launch_artifact_waiver (artifact_id, status);

CREATE TABLE IF NOT EXISTS governance.launch_artifact_conflict (
  id                        UUID PRIMARY KEY,
  status                    TEXT NOT NULL
                              CHECK (status IN ('open', 'resolved')),
  artifact_ids              TEXT[] NOT NULL,
  summary                   TEXT NOT NULL,
  resolution_version_ids    TEXT[],
  opened_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at               TIMESTAMPTZ,
  opened_by                 TEXT NOT NULL,
  resolved_by               TEXT,
  correlation_id            UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS governance_launch_artifact_conflict_open_idx
  ON governance.launch_artifact_conflict (status)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS governance.launch_artifact_rebaseline (
  id                                  UUID PRIMARY KEY,
  status                              TEXT NOT NULL
                                        CHECK (status IN (
                                          'required', 'in_review', 'approved', 'rejected'
                                        )),
  change_summary                      TEXT NOT NULL,
  impact_assessment                   TEXT NOT NULL,
  affected_artifact_ids               TEXT[] NOT NULL,
  required_regression_refs            JSONB NOT NULL DEFAULT '[]'::jsonb,
  build_ref                           TEXT,
  controlling_versions                JSONB NOT NULL DEFAULT '[]'::jsonb,
  requester_account_id                TEXT NOT NULL,
  independent_approver_account_id     TEXT,
  approved_at                         TIMESTAMPTZ,
  correlation_id                      UUID NOT NULL,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS governance_launch_artifact_rebaseline_status_idx
  ON governance.launch_artifact_rebaseline (status);

-- Append-only spirit: forbid DELETE on history tables.
CREATE OR REPLACE FUNCTION governance.forbid_launch_artifact_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (FR-55); DELETE forbidden', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS governance_launch_artifact_version_no_delete
  ON governance.launch_artifact_version;
CREATE TRIGGER governance_launch_artifact_version_no_delete
  BEFORE DELETE ON governance.launch_artifact_version
  FOR EACH ROW
  EXECUTE PROCEDURE governance.forbid_launch_artifact_delete();

DROP TRIGGER IF EXISTS governance_launch_artifact_waiver_no_delete
  ON governance.launch_artifact_waiver;
CREATE TRIGGER governance_launch_artifact_waiver_no_delete
  BEFORE DELETE ON governance.launch_artifact_waiver
  FOR EACH ROW
  EXECUTE PROCEDURE governance.forbid_launch_artifact_delete();

DROP TRIGGER IF EXISTS governance_launch_artifact_conflict_no_delete
  ON governance.launch_artifact_conflict;
CREATE TRIGGER governance_launch_artifact_conflict_no_delete
  BEFORE DELETE ON governance.launch_artifact_conflict
  FOR EACH ROW
  EXECUTE PROCEDURE governance.forbid_launch_artifact_delete();

DROP TRIGGER IF EXISTS governance_launch_artifact_rebaseline_no_delete
  ON governance.launch_artifact_rebaseline;
CREATE TRIGGER governance_launch_artifact_rebaseline_no_delete
  BEFORE DELETE ON governance.launch_artifact_rebaseline
  FOR EACH ROW
  EXECUTE PROCEDURE governance.forbid_launch_artifact_delete();

-- Approved version decision-defining columns are immutable.
CREATE OR REPLACE FUNCTION governance.forbid_approved_version_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'approved'
     AND (
       NEW.version_label IS DISTINCT FROM OLD.version_label
       OR NEW.scope_summary IS DISTINCT FROM OLD.scope_summary
       OR NEW.affected_fr_nfr IS DISTINCT FROM OLD.affected_fr_nfr
       OR NEW.content_ref IS DISTINCT FROM OLD.content_ref
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
       OR NEW.artifact_id IS DISTINCT FROM OLD.artifact_id
       OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
       OR NEW.effective_to IS DISTINCT FROM OLD.effective_to
       OR NEW.approval_history IS DISTINCT FROM OLD.approval_history
     )
  THEN
    RAISE EXCEPTION 'LAUNCH_ARTIFACT_IMMUTABLE_REWRITE: approved version decision columns cannot be updated';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS governance_launch_artifact_version_immutable
  ON governance.launch_artifact_version;
CREATE TRIGGER governance_launch_artifact_version_immutable
  BEFORE UPDATE ON governance.launch_artifact_version
  FOR EACH ROW
  EXECUTE PROCEDURE governance.forbid_approved_version_rewrite();

-- Additive consumer metadata on decision publications (Story 7.7 / AC #5).
-- New publishes only; never rewrite historical decision-defining columns.
ALTER TABLE reporting.decision_publication
  ADD COLUMN IF NOT EXISTS controlling_artifact_versions JSONB NOT NULL DEFAULT '[]'::jsonb;
