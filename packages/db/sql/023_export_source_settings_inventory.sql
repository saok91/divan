-- Story 10.4: allow settings inventory evidence under FR52 export lifecycle.
-- Extends source_surface CHECK to include settings_inventory (no parallel download SoT).

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'reporting'
    AND t.relname = 'export_artifact'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%source_surface%'
  LIMIT 1;
  IF con_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE reporting.export_artifact DROP CONSTRAINT %I',
      con_name
    );
  END IF;
END $$;

ALTER TABLE reporting.export_artifact
  ADD CONSTRAINT export_artifact_source_surface_check
  CHECK (source_surface IN ('report', 'personnel_list', 'settings_inventory'));
