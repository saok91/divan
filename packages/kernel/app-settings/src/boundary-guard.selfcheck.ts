/**
 * Boundary non-widen selfcheck (Story 10.5 / AC #5).
 * Proves no registered parameter can widen permission, retention, export, or audit boundaries.
 * Run: pnpm --filter @divan/app-settings selfcheck:boundary
 */
import assert from "node:assert/strict";

import {
  GOVERNED_SETTINGS_REGISTRY,
  listAdminEditableKeys,
  requireGovernedSettingsRegistry,
} from "./registry";

requireGovernedSettingsRegistry();

/**
 * Explicit wave-1 operational admin_editable allowlist.
 * Adding a new editable key requires updating this list (or documenting
 * boundaryClass: operational + non-security rationale in the same change).
 */
const WAVE1_ADMIN_EDITABLE_ALLOWLIST = Object.freeze([
  "import.max_file_bytes",
  "import.max_data_rows",
  "import.max_drafts_global",
  "import.max_drafts_per_actor",
  "import.draft_ttl_ms",
  "export.artifact_ttl_ms",
  "list.personnel_max_rows",
  "list.search_page_size_default",
  "list.search_page_size_max",
  "headcount.reservation_expiry_warning_days",
  "correction.attachment_max_bytes",
  "correction.attachment_max_per_case",
  "correction.attachment_allowlist",
  "entitlement.recert_window_ms",
] as const);

const adminKeys = listAdminEditableKeys();

assert.deepEqual(
  [...adminKeys].sort(),
  [...WAVE1_ADMIN_EDITABLE_ALLOWLIST].sort(),
  "admin_editable keys must match wave-1 allowlist — update allowlist deliberately",
);

for (const def of GOVERNED_SETTINGS_REGISTRY) {
  if (def.boundaryClass === "security_posture") {
    assert.equal(
      def.editability,
      "read_only_with_evidence",
      `${def.key}: security_posture must be read_only_with_evidence`,
    );
  }
}

const custody = GOVERNED_SETTINGS_REGISTRY.find(
  (d) => d.key === "export.custody_bulk_row_threshold",
);
assert.ok(custody, "custody threshold registered");
assert.equal(custody!.editability, "read_only_with_evidence");
assert.ok(!adminKeys.includes(custody!.key));

/** Keys/descriptions that imply permission / retention / export / audit wideners. */
const FORBIDDEN_EDITABLE_PATTERNS: Array<{
  re: RegExp;
  why: string;
}> = [
  {
    re: /permission|grant|role\.|entitlement\.assign|rbac/i,
    why: "permission grant",
  },
  {
    re: /retention\.|disposal|purge|legal.?hold|امحا|نگهداری قانونی/i,
    why: "retention disposal",
  },
  {
    re: /export\.classif|classification.?override|custody_bulk|sensitive.?export/i,
    why: "export classification / custody",
  },
  {
    re: /audit\.trust|trust_enforce|trust_max|trust_suspend|hash.?chain|audit.?integrity.?threshold/i,
    why: "audit-trust / integrity threshold",
  },
];

for (const key of adminKeys) {
  const def = GOVERNED_SETTINGS_REGISTRY.find((d) => d.key === key);
  assert.ok(def, key);
  assert.equal(
    def!.boundaryClass,
    "operational",
    `${key}: admin_editable must be boundaryClass operational`,
  );

  const haystack = `${def!.key} ${def!.descriptionFa} ${def!.labelFa}`;
  for (const rule of FORBIDDEN_EDITABLE_PATTERNS) {
    // entitlement.recert_window_ms is operational timing, not a permission grant.
    if (
      key === "entitlement.recert_window_ms" &&
      rule.why === "permission grant"
    ) {
      continue;
    }
    assert.ok(
      !rule.re.test(haystack),
      `${key} must not imply ${rule.why}`,
    );
  }
}

// Explicit RO inventory / security keys stay non-editable
for (const key of [
  "session.idle_timeout_seconds",
  "session.absolute_timeout_seconds",
  "identity.provider_mode",
  "identity.ldap_configured",
  "audit.trust_enforce",
  "audit.trust_max_clock_skew_ms",
  "audit.inference_bulk_enabled",
  "infra.pg_pool_max",
  "infra.baseline_boundary_date",
  "export.custody_bulk_row_threshold",
] as const) {
  assert.ok(
    !adminKeys.includes(key),
    `${key} must remain read_only (boundary non-widen)`,
  );
}

console.log("boundary-guard selfcheck: ok");
