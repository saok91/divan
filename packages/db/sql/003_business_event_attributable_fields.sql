-- Story 4.1: FR-14 attributable business event columns on kernel_events.
-- Idempotent ALTER — do not edit applied 001/002 history.
-- Business rows carry Person / Effective Date / registration / status / evidence.
-- Access rows leave business columns NULL; access result CHECK unchanged.

ALTER TABLE kernel_events
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS person_id UUID,
  ADD COLUMN IF NOT EXISTS employment_id UUID,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registered_by TEXT,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_by TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS reference_code TEXT,
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS before_evidence JSONB,
  ADD COLUMN IF NOT EXISTS after_evidence JSONB,
  -- Chain foreshadow for Story 4.3 (no product writers in 4.1)
  ADD COLUMN IF NOT EXISTS corrects_event_id UUID,
  ADD COLUMN IF NOT EXISTS cancels_event_id UUID,
  ADD COLUMN IF NOT EXISTS reverses_event_id UUID,
  ADD COLUMN IF NOT EXISTS supersedes_event_id UUID;

COMMENT ON COLUMN kernel_events.event_type IS
  'Personnel Event type (PascalCase past-tense). SoT for business type; required when event_class=business.';
COMMENT ON COLUMN kernel_events.person_id IS
  'Target Person UUID (application-level ref; no FK to Prisma Person in 4.1).';
COMMENT ON COLUMN kernel_events.employment_id IS
  'Applicable Employment UUID; NULL when Draft/Start has not bound Employment yet.';
COMMENT ON COLUMN kernel_events.effective_date IS
  'Business Effective Date (DATE only). Distinct from registered_at / finalized_at timestamptz.';
COMMENT ON COLUMN kernel_events.registered_at IS
  'Registration clock (timestamptz). Not Effective Date.';
COMMENT ON COLUMN kernel_events.registered_by IS
  'Registration actor InternalAccount id (TEXT cuid; aligns with actor_account_id).';
COMMENT ON COLUMN kernel_events.finalized_at IS
  'Finalization clock (timestamptz); NULL until Story 4.2 finalize.';
COMMENT ON COLUMN kernel_events.finalized_by IS
  'Finalization actor account id; NULL until Story 4.2.';
COMMENT ON COLUMN kernel_events.status IS
  'Lifecycle token: Draft | Scheduled | Effective | Cancelled | Reversed (transitions owned by 4.2/4.3).';
COMMENT ON COLUMN kernel_events.reference_code IS
  'Optional external/reference id (reason column remains separate).';
COMMENT ON COLUMN kernel_events.provenance IS
  'Source/import metadata JSON — no sensitive field values.';
COMMENT ON COLUMN kernel_events.before_evidence IS
  'Authorized reconstruction refs only — never compensation amounts / national ID.';
COMMENT ON COLUMN kernel_events.after_evidence IS
  'Authorized reconstruction refs only — never compensation amounts / national ID.';
COMMENT ON COLUMN kernel_events.corrects_event_id IS
  'Foreshadow Correction chain (4.3); nullable; no writer in 4.1.';
COMMENT ON COLUMN kernel_events.cancels_event_id IS
  'Foreshadow Cancel chain (4.3); nullable; no writer in 4.1.';
COMMENT ON COLUMN kernel_events.reverses_event_id IS
  'Foreshadow Reverse chain (4.3); nullable; no writer in 4.1.';
COMMENT ON COLUMN kernel_events.supersedes_event_id IS
  'Foreshadow supersede chain (4.3); nullable; no writer in 4.1.';

-- Provisional status token set (transitions owned by 4.2/4.3).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kernel_events_status_token_chk'
  ) THEN
    ALTER TABLE kernel_events
      ADD CONSTRAINT kernel_events_status_token_chk CHECK (
        status IS NULL
        OR status IN ('Draft', 'Scheduled', 'Effective', 'Cancelled', 'Reversed')
      );
  END IF;
END $$;

-- Business rows require FR-14 attributable fields.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kernel_events_business_required_chk'
  ) THEN
    ALTER TABLE kernel_events
      ADD CONSTRAINT kernel_events_business_required_chk CHECK (
        event_class <> 'business'
        OR (
          event_type IS NOT NULL
          AND person_id IS NOT NULL
          AND effective_date IS NOT NULL
          AND status IS NOT NULL
          AND registered_at IS NOT NULL
          AND registered_by IS NOT NULL
        )
      );
  END IF;
END $$;

-- Access-only result field must stay NULL on business rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kernel_events_business_result_null_chk'
  ) THEN
    ALTER TABLE kernel_events
      ADD CONSTRAINT kernel_events_business_result_null_chk CHECK (
        event_class <> 'business' OR result IS NULL
      );
  END IF;
END $$;

-- Access rows keep business-required columns NULL (access CHECK on result unchanged).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kernel_events_access_business_null_chk'
  ) THEN
    ALTER TABLE kernel_events
      ADD CONSTRAINT kernel_events_access_business_null_chk CHECK (
        event_class <> 'access'
        OR (
          event_type IS NULL
          AND person_id IS NULL
          AND effective_date IS NULL
          AND status IS NULL
          AND registered_at IS NULL
          AND registered_by IS NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS kernel_events_class_effective_date_idx
  ON kernel_events (event_class, effective_date);

CREATE INDEX IF NOT EXISTS kernel_events_person_effective_date_idx
  ON kernel_events (person_id, effective_date);

CREATE INDEX IF NOT EXISTS kernel_events_employment_id_idx
  ON kernel_events (employment_id);

-- Append-only hardening: block UPDATE/DELETE even for lab superusers.
CREATE OR REPLACE FUNCTION kernel_events_forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'kernel_events is append-only: % not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS kernel_events_append_only_trg ON kernel_events;
CREATE TRIGGER kernel_events_append_only_trg
  BEFORE UPDATE OR DELETE ON kernel_events
  FOR EACH ROW
  EXECUTE PROCEDURE kernel_events_forbid_mutation();

-- REVOKE left commented — app role model unclear in lab (often table owner / superuser).
-- When a non-owner app role exists:
--   REVOKE UPDATE, DELETE ON kernel_events FROM PUBLIC;
--   REVOKE UPDATE, DELETE ON kernel_events FROM <app_role>;
