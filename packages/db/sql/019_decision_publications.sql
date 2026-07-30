-- Formal decision publications (Story 7.6 / FR-54).
-- Schema choice: `reporting` — FR-54 lives in reporting BC alongside export_artifact
-- (ARCHITECTURE-SPINE). Distinct product from export TTL / live report.run.
-- Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
-- AR-REPORTING / AR-DATA / AR-ACCESS / AR-TEMPORAL pending freeze; provisional substrate only.
-- Immutability: decision-defining columns must not be UPDATEd after insert
-- (BEFORE UPDATE trigger raises PUBLICATION_IMMUTABLE_REWRITE; web maps PG text to domain code).
-- DELETE forbidden on publication rows, notices, and packages (append-only evidence).

CREATE SCHEMA IF NOT EXISTS reporting;

CREATE TABLE IF NOT EXISTS reporting.decision_publication (
  id                          UUID PRIMARY KEY,
  report_key                  TEXT NOT NULL,
  report_version              TEXT NOT NULL,
  metric_version              TEXT NOT NULL,
  snapshot_hash               TEXT NOT NULL,
  snapshot_ref                JSONB NOT NULL DEFAULT '{}'::jsonb,
  filters_snapshot            JSONB NOT NULL,
  evaluation_mode             TEXT NOT NULL
                                CHECK (evaluation_mode IN ('current', 'as_of')),
  as_of_date                  DATE,
  published_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  publisher_account_id        TEXT NOT NULL,
  permitted_audience          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                      TEXT NOT NULL
                                CHECK (status IN (
                                  'published',
                                  'superseded',
                                  'non-reproducible-after-disposal',
                                  'package_retained'
                                )),
  reproducibility_state       TEXT NOT NULL
                                CHECK (reproducibility_state IN (
                                  'reproducible',
                                  'package_retained',
                                  'non-reproducible-after-disposal'
                                )),
  correlation_id              UUID NOT NULL,
  source_export_artifact_id   TEXT,
  has_supersession_notice     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS reporting_decision_publication_report_published_idx
  ON reporting.decision_publication (report_key, published_at DESC);

CREATE INDEX IF NOT EXISTS reporting_decision_publication_status_idx
  ON reporting.decision_publication (status);

CREATE INDEX IF NOT EXISTS reporting_decision_publication_snapshot_idx
  ON reporting.decision_publication (snapshot_hash);

CREATE INDEX IF NOT EXISTS reporting_decision_publication_publisher_idx
  ON reporting.decision_publication (publisher_account_id);

-- Append-only supersession / correction / disposal notices.
CREATE TABLE IF NOT EXISTS reporting.publication_notice (
  id                          UUID PRIMARY KEY,
  publication_id              UUID NOT NULL
                                REFERENCES reporting.decision_publication (id),
  notice_kind                 TEXT NOT NULL
                                CHECK (notice_kind IN (
                                  'correction',
                                  'metric_policy_change',
                                  'disposal',
                                  'supersession'
                                )),
  trigger_ref_type            TEXT NOT NULL,
  trigger_ref_id              TEXT NOT NULL,
  note                        TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_account_id            TEXT NOT NULL,
  correlation_id              UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS reporting_publication_notice_publication_idx
  ON reporting.publication_notice (publication_id, created_at DESC);

-- Forbidden: DELETE on publication evidence tables (append-only FR-54).
CREATE OR REPLACE FUNCTION reporting.forbid_publication_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (FR-54); DELETE forbidden', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS reporting_publication_notice_no_delete
  ON reporting.publication_notice;
CREATE TRIGGER reporting_publication_notice_no_delete
  BEFORE DELETE ON reporting.publication_notice
  FOR EACH ROW
  EXECUTE PROCEDURE reporting.forbid_publication_delete();

DROP TRIGGER IF EXISTS reporting_decision_publication_no_delete
  ON reporting.decision_publication;
CREATE TRIGGER reporting_decision_publication_no_delete
  BEFORE DELETE ON reporting.decision_publication
  FOR EACH ROW
  EXECUTE PROCEDURE reporting.forbid_publication_delete();

DROP TRIGGER IF EXISTS reporting_reproducibility_package_no_delete
  ON reporting.reproducibility_package;
CREATE TRIGGER reporting_reproducibility_package_no_delete
  BEFORE DELETE ON reporting.reproducibility_package
  FOR EACH ROW
  EXECUTE PROCEDURE reporting.forbid_publication_delete();

-- Decision-defining columns are immutable after insert.
CREATE OR REPLACE FUNCTION reporting.forbid_decision_publication_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.report_key IS DISTINCT FROM OLD.report_key
     OR NEW.report_version IS DISTINCT FROM OLD.report_version
     OR NEW.metric_version IS DISTINCT FROM OLD.metric_version
     OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash
     OR NEW.snapshot_ref IS DISTINCT FROM OLD.snapshot_ref
     OR NEW.filters_snapshot IS DISTINCT FROM OLD.filters_snapshot
     OR NEW.evaluation_mode IS DISTINCT FROM OLD.evaluation_mode
     OR NEW.as_of_date IS DISTINCT FROM OLD.as_of_date
     OR NEW.published_at IS DISTINCT FROM OLD.published_at
     OR NEW.publisher_account_id IS DISTINCT FROM OLD.publisher_account_id
     OR NEW.permitted_audience IS DISTINCT FROM OLD.permitted_audience
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.source_export_artifact_id IS DISTINCT FROM OLD.source_export_artifact_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'PUBLICATION_IMMUTABLE_REWRITE: decision-defining columns cannot be updated';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reporting_decision_publication_immutable
  ON reporting.decision_publication;
CREATE TRIGGER reporting_decision_publication_immutable
  BEFORE UPDATE ON reporting.decision_publication
  FOR EACH ROW
  EXECUTE PROCEDURE reporting.forbid_decision_publication_rewrite();

-- Optional minimized reproducibility package (metadata + hash; no unauthorized PII rows).
CREATE TABLE IF NOT EXISTS reporting.reproducibility_package (
  id                          UUID PRIMARY KEY,
  publication_id              UUID NOT NULL
                                REFERENCES reporting.decision_publication (id),
  package_kind                TEXT NOT NULL,
  content_hash                TEXT NOT NULL,
  retention_class             TEXT NOT NULL,
  package_metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disposed_at                 TIMESTAMPTZ,
  disposal_run_id             TEXT,
  -- Bytes nullable and default NULL — prefer metadata+hash without row PII.
  content_bytes               BYTEA
);

CREATE INDEX IF NOT EXISTS reporting_reproducibility_package_publication_idx
  ON reporting.reproducibility_package (publication_id);

-- Lifecycle events for allowed status/reproducibility updates (attributable).
CREATE TABLE IF NOT EXISTS reporting.decision_publication_lifecycle_event (
  id                          UUID PRIMARY KEY,
  publication_id              UUID NOT NULL
                                REFERENCES reporting.decision_publication (id),
  event_kind                  TEXT NOT NULL,
  actor_account_id            TEXT NOT NULL,
  occurred_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason                      TEXT,
  correlation_id              UUID NOT NULL,
  detail_json                 JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS reporting_decision_publication_lifecycle_idx
  ON reporting.decision_publication_lifecycle_event (publication_id, occurred_at DESC);

-- Extend correction-case outcome link types for FR-54 publication ids (Story 7.6).
-- Choice: prefer `decision_publication`; keep `published_artifact` as alias validating same store.
ALTER TABLE correction_case.outcome_link
  DROP CONSTRAINT IF EXISTS outcome_link_link_type_check;

ALTER TABLE correction_case.outcome_link
  ADD CONSTRAINT outcome_link_link_type_check
  CHECK (link_type IN (
    'personnel_correction',
    'disposal_run',
    'hold',
    'recalc',
    'published_artifact',
    'decision_publication',
    'response_evidence',
    'pending_publication_hook'
  ));

