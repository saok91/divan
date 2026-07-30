-- Authoritative evaluation snapshot registry (Story 7.8 / FR-56).
-- Schema: governance — alongside launch-artifact; NOT reporting.export_artifact SoT.
-- Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
-- Migrations-only — do not expand ensure*Schema.
-- bound_refs: ids/stamps/fingerprints only — no unauthorized PII row dumps.
-- DELETE forbidden (append-only spirit); status transitions via controlled UPDATE.

CREATE SCHEMA IF NOT EXISTS governance;

CREATE TABLE IF NOT EXISTS governance.evaluation_snapshot (
  id                    UUID PRIMARY KEY,
  kind                  TEXT NOT NULL,
  content_fingerprint   TEXT NOT NULL,
  attribution           JSONB NOT NULL DEFAULT '{}'::jsonb,
  bound_refs            JSONB,
  status                TEXT NOT NULL
                          CHECK (status IN (
                            'active', 'consumed', 'expired', 'superseded'
                          )),
  correlation_id        UUID NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at            TIMESTAMPTZ,
  operation_ref         JSONB
);

CREATE INDEX IF NOT EXISTS governance_evaluation_snapshot_fingerprint_idx
  ON governance.evaluation_snapshot (content_fingerprint);

CREATE INDEX IF NOT EXISTS governance_evaluation_snapshot_kind_created_idx
  ON governance.evaluation_snapshot (kind, created_at DESC);

CREATE INDEX IF NOT EXISTS governance_evaluation_snapshot_status_idx
  ON governance.evaluation_snapshot (status);

CREATE INDEX IF NOT EXISTS governance_evaluation_snapshot_correlation_idx
  ON governance.evaluation_snapshot (correlation_id);

-- DELETE forbid — append-only spirit (mirror launch-artifact history tables).
CREATE OR REPLACE FUNCTION governance.forbid_evaluation_snapshot_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'EVAL_SNAPSHOT_DELETE_FORBIDDEN: evaluation snapshot rows cannot be deleted'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_evaluation_snapshot_delete
  ON governance.evaluation_snapshot;
CREATE TRIGGER trg_forbid_evaluation_snapshot_delete
  BEFORE DELETE ON governance.evaluation_snapshot
  FOR EACH ROW
  EXECUTE PROCEDURE governance.forbid_evaluation_snapshot_delete();

-- Allowed UPDATE columns: status, operation_ref, expires_at, bound_refs (membership refine).
-- Fingerprint / kind / attribution / correlation_id / created_at are immutable.
CREATE OR REPLACE FUNCTION governance.guard_evaluation_snapshot_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.content_fingerprint IS DISTINCT FROM OLD.content_fingerprint
     OR NEW.attribution IS DISTINCT FROM OLD.attribution
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'EVAL_SNAPSHOT_IMMUTABLE: fingerprint/kind/attribution cannot be rewritten'
      USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('active', 'consumed', 'expired', 'superseded')
  THEN
    RAISE EXCEPTION 'EVAL_SNAPSHOT_STATUS_INVALID: %', NEW.status
      USING ERRCODE = 'P0001';
  END IF;
  -- No revival: consumed/expired/superseded must not return to active.
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'EVAL_SNAPSHOT_STATUS_REGRESSION: cannot revive % to active', OLD.status
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_evaluation_snapshot_update
  ON governance.evaluation_snapshot;
CREATE TRIGGER trg_guard_evaluation_snapshot_update
  BEFORE UPDATE ON governance.evaluation_snapshot
  FOR EACH ROW
  EXECUTE PROCEDURE governance.guard_evaluation_snapshot_update();

-- Additive consumer stamps (nullable — new rows only; never rewrite history semantics).
ALTER TABLE reporting.export_artifact
  ADD COLUMN IF NOT EXISTS evaluation_snapshot_id UUID;

ALTER TABLE reporting.decision_publication
  ADD COLUMN IF NOT EXISTS evaluation_snapshot_id UUID;

CREATE INDEX IF NOT EXISTS reporting_export_artifact_eval_snapshot_idx
  ON reporting.export_artifact (evaluation_snapshot_id)
  WHERE evaluation_snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reporting_decision_publication_eval_snapshot_idx
  ON reporting.decision_publication (evaluation_snapshot_id)
  WHERE evaluation_snapshot_id IS NOT NULL;
