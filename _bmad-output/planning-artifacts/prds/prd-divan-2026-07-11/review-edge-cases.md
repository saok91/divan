[
  {
    "location": "prd.md:153-159",
    "trigger_condition": "Unit deactivates while future Assignments or Reservations target it",
    "guard_snippet": "if unit.has_future_dependencies(): require_disposition_or_block()",
    "potential_consequence": "Scheduled events become effective against an inactive hierarchy"
  },
  {
    "location": "prd.md:160-165",
    "trigger_condition": "Job reference deactivates while active or Scheduled Assignments use it",
    "guard_snippet": "if reference.has_active_or_scheduled_usage(): require_disposition_or_block()",
    "potential_consequence": "Assignments retain invalid Role, Title, Ladder, Grade, or Seniority"
  },
  {
    "location": "prd.md:153-159",
    "trigger_condition": "Retroactive hierarchy change places child outside parent validity",
    "guard_snippet": "assert child.validity.within(parent.validity)",
    "potential_consequence": "Historical organization reconstruction contains impossible hierarchy states"
  },
  {
    "location": "prd.md:174-179",
    "trigger_condition": "Secondary Assignment starts without an active Employment",
    "guard_snippet": "require_active_employment_for(secondary.effective_interval)",
    "potential_consequence": "Non-employed Person appears assigned to an organization"
  },
  {
    "location": "prd.md:174-179",
    "trigger_condition": "Equivalent Secondary Assignments overlap for the same Person",
    "guard_snippet": "reject_overlapping_secondary(person, team, reason, interval)",
    "potential_consequence": "Secondary work is duplicated in profiles and reports"
  },
  {
    "location": "prd.md:123-149",
    "trigger_condition": "Historical profile field changes outside a defined Personnel Event",
    "guard_snippet": "record_profile_change_as_effective_dated_authoritative_event()",
    "potential_consequence": "Prior approved profile values cannot be reconstructed"
  },
  {
    "location": "prd.md:211-223",
    "trigger_condition": "Correction link targets itself or creates a chain cycle",
    "guard_snippet": "if correction.creates_cycle(): reject()",
    "potential_consequence": "Resolved state and timeline traversal never become deterministic"
  },
  {
    "location": "prd.md:197-209",
    "trigger_condition": "Finalization succeeds but client retries after losing the response",
    "guard_snippet": "finalize_once(draft_id, idempotency_key)",
    "potential_consequence": "One user action creates duplicate authoritative events"
  },
  {
    "location": "prd.md:197-216",
    "trigger_condition": "Cancel races the Scheduled event becoming Effective",
    "guard_snippet": "atomically_transition(event, expected_status, target_status)",
    "potential_consequence": "Event effect and neutralization can both be applied"
  },
  {
    "location": "prd.md:197-203",
    "trigger_condition": "Two authorized users concurrently edit the same Draft",
    "guard_snippet": "update_draft_if_version_matches(draft_id, expected_version)",
    "potential_consequence": "A valid Draft edit silently overwrites another"
  },
  {
    "location": "prd.md:248-253",
    "trigger_condition": "Transfer destination resolves to the existing source Assignment",
    "guard_snippet": "if destination == source: reject_noop_transfer()",
    "potential_consequence": "Capacity is unnecessarily reserved, released, and reconsumed"
  },
  {
    "location": "prd.md:218-223",
    "trigger_condition": "Retroactive native event predates the approved Baseline",
    "guard_snippet": "if effective_date < baseline_date: block_or_require_baseline_revision()",
    "potential_consequence": "Recalculation invents history outside the reconstructable boundary"
  },
  {
    "location": "prd.md:294-300",
    "trigger_condition": "Headcount allowed count is negative, fractional, or otherwise non-integral",
    "guard_snippet": "require_integer(allowed_count); require(allowed_count >= 0)",
    "potential_consequence": "Used, reserved, and free capacity become nonsensical"
  },
  {
    "location": "prd.md:294-300",
    "trigger_condition": "Headcount Approval validity end precedes its start",
    "guard_snippet": "require(valid_from < valid_to)",
    "potential_consequence": "Approval status and consumability disagree across dates"
  },
  {
    "location": "prd.md:278-290",
    "trigger_condition": "User requests an as-of date later than today",
    "guard_snippet": "if as_of > today: reject_or_use_explicit_forecast_semantics()",
    "potential_consequence": "Scheduled events appear historical or disappear inconsistently"
  },
  {
    "location": "prd.md:331-338",
    "trigger_condition": "Underlying results change between pagination requests",
    "guard_snippet": "paginate_with_stable_snapshot_and_unique_cursor()",
    "potential_consequence": "Users see duplicate or missing personnel records"
  },
  {
    "location": "prd.md:398-403",
    "trigger_condition": "Records change after export preview but before artifact generation",
    "guard_snippet": "bind_export_to_snapshot(query_version, filters, fields)",
    "potential_consequence": "Downloaded data differs from the reviewed filtered result"
  },
  {
    "location": "prd.md:398-403",
    "trigger_condition": "Export permission or scope is revoked while generation is queued",
    "guard_snippet": "reauthorize_export_at_execution_and_download()",
    "potential_consequence": "Revoked users receive newly generated sensitive data"
  },
  {
    "location": "prd.md:347-357",
    "trigger_condition": "Authorized aggregate filters reduce a sensitive cohort to one Person",
    "guard_snippet": "suppress_or_coarsen_aggregates_below(minimum_cohort_size)",
    "potential_consequence": "Dashboard totals reveal an individual's sensitive fact"
  },
  {
    "location": "prd.md:370-382",
    "trigger_condition": "Target data changes after preview validation but before execution",
    "guard_snippet": "revalidate_against_current_state_inside_import_transaction()",
    "potential_consequence": "Previously valid rows overwrite or conflict with newer state"
  },
  {
    "location": "prd.md:370-382",
    "trigger_condition": "Spreadsheet contains formulas, external links, or executable content",
    "guard_snippet": "reject_active_content_and_import_values_only()",
    "potential_consequence": "Import processing executes content or stores deceptive values"
  },
  {
    "location": "prd.md:398-403",
    "trigger_condition": "Exported text begins with spreadsheet formula control characters",
    "guard_snippet": "escape_spreadsheet_formula_prefixes(exported_cell)",
    "potential_consequence": "Opening an export executes attacker-controlled spreadsheet formulas"
  },
  {
    "location": "prd.md:370-382",
    "trigger_condition": "Concurrent Import Batches update the same existing record",
    "guard_snippet": "detect_conflicting_batch_writes_and_abort_one_batch()",
    "potential_consequence": "One atomic batch silently loses another batch's update"
  },
  {
    "location": "prd.md:407-412",
    "trigger_condition": "Audit evidence cannot be persisted during a governed mutation",
    "guard_snippet": "commit_business_change_and_required_audit_atomically()",
    "potential_consequence": "Sensitive changes succeed without mandatory audit evidence"
  },
  {
    "location": "prd.md:407-412",
    "trigger_condition": "Authorization denies a protected operation or out-of-scope probe",
    "guard_snippet": "audit_denied_operation(actor, action, scope, result)",
    "potential_consequence": "Repeated access attacks leave no reviewable security trail"
  },
  {
    "location": "prd.md:190-195",
    "trigger_condition": "Reason or reference text contains unauthorized sensitive information",
    "guard_snippet": "classify_validate_and_permission_filter_free_text_evidence()",
    "potential_consequence": "Timelines or audit evidence expose sensitive values"
  },
  {
    "location": "prd.md:167-172",
    "trigger_condition": "Referenced organization or job data changes during event finalization",
    "guard_snippet": "validate_and_finalize_against_one_locked_reference_version()",
    "potential_consequence": "Authoritative Assignment commits with newly invalid references"
  }
]
