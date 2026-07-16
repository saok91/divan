-- Story 2.3: InternalAccount ids are Prisma cuid strings, not UUIDs.
-- Keep correlation_id / event id as UUID; store actor as text for attribution.
-- Also folded into Prisma migration 20260716220000_access_admin_projections.
-- Idempotent for environments that already applied this via sql:apply.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'kernel_events'
      AND column_name = 'actor_account_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE kernel_events
      ALTER COLUMN actor_account_id TYPE TEXT USING actor_account_id::text;
  END IF;
END $$;
