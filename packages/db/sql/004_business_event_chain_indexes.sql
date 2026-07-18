-- Story 4.3: optional indexes on business event chain columns.
-- Idempotent — do not edit applied 001–003 history.

CREATE INDEX IF NOT EXISTS kernel_events_cancels_event_id_idx
  ON kernel_events (cancels_event_id)
  WHERE cancels_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS kernel_events_reverses_event_id_idx
  ON kernel_events (reverses_event_id)
  WHERE reverses_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS kernel_events_corrects_event_id_idx
  ON kernel_events (corrects_event_id)
  WHERE corrects_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS kernel_events_person_effective_idx
  ON kernel_events (person_id, effective_date DESC)
  WHERE event_class = 'business';
