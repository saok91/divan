[
  {
    "location": "prd.md:204-212",
    "trigger_condition": "Draft deletion races finalization after both read Draft status",
    "guard_snippet": "atomically_finalize_if_version_and_status_match(draft_id, expected_version, Draft)",
    "potential_consequence": "A deleted Draft becomes authoritative or deletion hides successful finalization"
  },
  {
    "location": "prd.md:456-462",
    "trigger_condition": "Entitlement reaches recertification deadline without approval or rejection",
    "guard_snippet": "if recertification_overdue(): suspend_or_revoke_entitlement()",
    "potential_consequence": "Unreviewed sensitive access remains active indefinitely"
  },
  {
    "location": "prd.md:488-525",
    "trigger_condition": "Required source facts are disposed after formal report publication",
    "guard_snippet": "define_privacy_preserving_reproduction_or_mark_report_nonreproducible_after_disposal()",
    "potential_consequence": "Retention compliance or mandatory report reproducibility must be violated"
  },
  {
    "location": "prd.md:488-494",
    "trigger_condition": "An anonymized former Person later returns for new Employment",
    "guard_snippet": "retain_approved_rehire_token_or_require_verified_manual_rematch()",
    "potential_consequence": "Return creates a duplicate Person or restores disposed identity data"
  },
  {
    "location": "prd.md:513-518",
    "trigger_condition": "External correction case reaches its deadline without a decision",
    "guard_snippet": "if case.deadline_passed(): escalate_and_enter_explicit_breached_state()",
    "potential_consequence": "Overdue correction remains indistinguishable from an active compliant case"
  },
  {
    "location": "prd.md:527-540",
    "trigger_condition": "Applicable Launch Artifacts prescribe contradictory outcomes for one operation",
    "guard_snippet": "detect_policy_conflict_and_fail_baseline_until_joint_resolution()",
    "potential_consequence": "Implementations choose inconsistent authorization, retention, or temporal behavior"
  }
]
