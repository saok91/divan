/**
 * Governed settings substrate selfcheck (Story 10.1 / AD-7 / FR-45).
 * Pure gates always run; DB paths run when DATABASE_URL is set and schema present.
 * Run: pnpm --filter @divan/app-settings selfcheck
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), "../../../.env") });
loadEnv();

import {
  GOVERNED_SETTINGS_REGISTRY,
  GovernedSettingsError,
  MSG_SETTINGS_CONFIG_DEGRADED_FA,
  MSG_SETTINGS_STORE_UNAVAILABLE_FA,
  deleteOverride,
  getCodeDefault,
  getConfigurationOpsHealthSection,
  getSettingsDegradedKeys,
  getSettingsParameter,
  invalidateSettingsCache,
  isSecretShapedKey,
  isSettingsConfigurationDegraded,
  listAdminEditableKeys,
  requireGovernedSettingsRegistry,
  resetSettingsCacheForTests,
  resolveSetting,
  resolveSettingNumber,
  serializeSettingsInventoryValue,
  upsertOverride,
  validateSettingsValue,
  valueLooksLikeSecret,
  warmSettingsCache,
  warmSettingsCacheFromEnvOnly,
} from "./index";

// --- Pure: registry completeness ---
const registry = requireGovernedSettingsRegistry();
assert.ok(registry.length >= 15, "wave-1 registry too small");

const requiredKeys = [
  "import.max_file_bytes",
  "import.max_data_rows",
  "import.max_drafts_global",
  "import.max_drafts_per_actor",
  "import.draft_ttl_ms",
  "export.artifact_ttl_ms",
  "export.custody_bulk_row_threshold",
  "list.personnel_max_rows",
  "list.search_page_size_default",
  "list.search_page_size_max",
  "headcount.reservation_expiry_warning_days",
  "correction.attachment_max_bytes",
  "correction.attachment_max_per_case",
  "correction.attachment_allowlist",
  "entitlement.recert_window_ms",
  "session.idle_timeout_seconds",
  "session.absolute_timeout_seconds",
  "identity.provider_mode",
  "identity.ldap_configured",
  "identity.ldap_url_scheme",
  "identity.ldap_tls_reject_unauthorized",
  "identity.ldap_connect_timeout_ms",
  "identity.ldap_create_mapping_mode",
  "audit.inference_bulk_enabled",
  "audit.inference_bulk_min_cohort",
  "audit.inference_bulk_max_volume_per_request",
  "audit.inference_bulk_max_volume_per_window",
  "audit.trust_enforce",
  "audit.trust_max_clock_skew_ms",
  "audit.trust_verification_window_hours",
  "audit.trust_suspend_ttl_ms",
  "audit.envelope_category_count",
  "infra.pg_pool_max",
  "infra.baseline_boundary_date",
] as const;

for (const key of requiredKeys) {
  const def = getSettingsParameter(key);
  assert.ok(def.labelFa.trim().length > 0, `${key} labelFa`);
  assert.ok(def.descriptionFa.trim().length > 0, `${key} descriptionFa`);
  assert.ok(def.valueType, `${key} valueType`);
  assert.ok(def.editability, `${key} editability`);
  assert.ok(def.owningDomain, `${key} owningDomain`);
  assert.ok(def.defaultValue !== undefined, `${key} default`);
}

assert.equal(getCodeDefault("import.max_file_bytes"), 5 * 1024 * 1024);
assert.equal(getCodeDefault("import.max_data_rows"), 5_000);
assert.equal(getCodeDefault("headcount.reservation_expiry_warning_days"), 14);

const idle = getSettingsParameter("session.idle_timeout_seconds");
assert.equal(idle.editability, "read_only_with_evidence");
assert.equal(idle.boundaryClass, "security_posture");
assert.ok(idle.changePathFa && idle.changePathFa.length > 0);

assert.throws(
  () => getSettingsParameter("not.a.real.key"),
  (err: unknown) =>
    err instanceof GovernedSettingsError && err.code === "SETTINGS_UNKNOWN_KEY",
);

// --- Pure: shared validate (Story 10.3) ---
const maxFileDef = getSettingsParameter("import.max_file_bytes");
assert.equal(validateSettingsValue(maxFileDef, 2 * 1024 * 1024), 2 * 1024 * 1024);
assert.equal(validateSettingsValue(maxFileDef, -1), null);
assert.equal(validateSettingsValue(maxFileDef, 1.5), null);
const allowlistDefPure = getSettingsParameter("correction.attachment_allowlist");
assert.deepEqual(validateSettingsValue(allowlistDefPure, ["pdf", "png"]), [
  "pdf",
  "png",
]);
assert.deepEqual(
  validateSettingsValue(allowlistDefPure, ["pdf", "pdf", "png"]),
  ["pdf", "png"],
  "string_list duplicates are deduped",
);
assert.equal(validateSettingsValue(allowlistDefPure, []), null);
assert.equal(validateSettingsValue(allowlistDefPure, ["exe"]), null);

// --- Pure: resolve before warm â†’ code default, no throw ---
resetSettingsCacheForTests();
const preWarm = resolveSettingNumber("import.max_file_bytes");
assert.equal(preWarm.value, 5 * 1024 * 1024);
assert.equal(preWarm.source, "code_default");
assert.equal(preWarm.degraded, true);

assert.throws(
  () => resolveSetting("totally.unknown"),
  (err: unknown) =>
    err instanceof GovernedSettingsError && err.code === "SETTINGS_UNKNOWN_KEY",
);

const notWarmedHealth = getConfigurationOpsHealthSection();
assert.equal(notWarmedHealth.status, "degraded");

assert.ok(listAdminEditableKeys().includes("import.max_file_bytes"));
assert.ok(
  !listAdminEditableKeys().includes("session.idle_timeout_seconds"),
  "security posture must not be admin_editable",
);
assert.ok(
  !listAdminEditableKeys().includes("export.custody_bulk_row_threshold"),
  "export custody threshold must stay read_only (Gate â€” no export boundary widen)",
);
assert.equal(
  getSettingsParameter("export.custody_bulk_row_threshold").editability,
  "read_only_with_evidence",
);

// security_posture entries must be read_only
for (const def of GOVERNED_SETTINGS_REGISTRY) {
  if (def.boundaryClass === "security_posture") {
    assert.equal(def.editability, "read_only_with_evidence", def.key);
  }
  if (def.editability === "read_only_with_evidence") {
    assert.ok(def.changePathFa && def.changePathFa.trim().length > 0, def.key);
  }
}

// --- Pure: environment source + secret denial (Story 10.4) ---
resetSettingsCacheForTests();
await warmSettingsCacheFromEnvOnly({
  AUTH_SESSION_IDLE_TIMEOUT_SECONDS: "3600",
  NODE_ENV: "development",
});
const idleEnv = resolveSettingNumber("session.idle_timeout_seconds");
assert.equal(idleEnv.value, 3600);
assert.equal(idleEnv.source, "environment");
assert.equal(idleEnv.degraded, false);

resetSettingsCacheForTests();
await warmSettingsCacheFromEnvOnly({ NODE_ENV: "development" });
const idleDefault = resolveSettingNumber("session.idle_timeout_seconds");
assert.equal(idleDefault.value, 8 * 60 * 60);
assert.equal(idleDefault.source, "code_default");

resetSettingsCacheForTests();
await warmSettingsCacheFromEnvOnly({
  AUTH_SESSION_IDLE_TIMEOUT_SECONDS: "not-a-number",
  NODE_ENV: "development",
});
const idleInvalid = resolveSettingNumber("session.idle_timeout_seconds");
assert.equal(idleInvalid.value, 8 * 60 * 60);
assert.equal(idleInvalid.source, "code_default");
assert.equal(idleInvalid.degraded, true);
assert.ok(getSettingsDegradedKeys().includes("session.idle_timeout_seconds"));

assert.ok(domainHasAuditIntegrity());
assert.ok(!isSecretShapedKey("session.idle_timeout_seconds"));
assert.ok(isSecretShapedKey("ldap.bind_password"));
assert.ok(valueLooksLikeSecret("postgresql://user:pass@localhost/db"));
assert.ok(valueLooksLikeSecret("-----BEGIN PRIVATE KEY-----"));
const idleDef = getSettingsParameter("session.idle_timeout_seconds");
assert.equal(serializeSettingsInventoryValue(idleDef, 3600), 3600);
assert.throws(
  () => serializeSettingsInventoryValue(idleDef, "LDAP_BIND_PASSWORD=secret"),
  (err: unknown) =>
    err instanceof GovernedSettingsError &&
    err.code === "SETTINGS_INVALID_DEFINITION",
);

assert.ok(
  !listAdminEditableKeys().includes("audit.trust_enforce"),
  "audit trust must stay RO",
);
assert.ok(
  !listAdminEditableKeys().includes("infra.pg_pool_max"),
  "pool max must stay RO",
);
assert.equal(
  getSettingsParameter("infra.baseline_boundary_date").defaultValue,
  "unset",
);

console.log("app-settings pure gates: ok");

function domainHasAuditIntegrity(): boolean {
  return GOVERNED_SETTINGS_REGISTRY.some(
    (d) => d.owningDomain === "audit_integrity",
  );
}

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("DATABASE_URL unset â€” skipping store/resolver DB gates");
  process.exit(0);
}

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: url });

try {
  const probe = await pool.query(
    `SELECT to_regclass('app_settings.parameter_override') AS reg`,
  );
  if (!probe.rows[0]?.reg) {
    console.log(
      "app_settings.parameter_override missing â€” apply 022_governed_settings.sql; skipping DB gates",
    );
    process.exit(0);
  }

  // Clean slate for selfcheck keys
  await deleteOverride(pool, "import.max_file_bytes");
  resetSettingsCacheForTests();
  await warmSettingsCache(pool);

  const baseline = resolveSettingNumber("import.max_file_bytes");
  assert.equal(baseline.value, 5 * 1024 * 1024);
  assert.equal(baseline.source, "code_default");

  // Override â†’ auto re-warm â†’ store value
  await upsertOverride(pool, {
    parameterKey: "import.max_file_bytes",
    value: 2 * 1024 * 1024,
    updatedBy: "selfcheck",
    reason: "app-settings.selfcheck",
  });
  const overridden = resolveSettingNumber("import.max_file_bytes");
  assert.equal(overridden.value, 2 * 1024 * 1024);
  assert.equal(overridden.source, "store");
  assert.equal(overridden.degraded, false);

  // Hot path: raw SQL under cache â€” resolve stays stale until invalidate
  await pool.query(
    `UPDATE app_settings.parameter_override
        SET value_json = $1::jsonb
      WHERE parameter_key = $2`,
    [JSON.stringify(3 * 1024 * 1024), "import.max_file_bytes"],
  );
  const stillCached = resolveSettingNumber("import.max_file_bytes");
  assert.equal(
    stillCached.value,
    2 * 1024 * 1024,
    "hot resolve must not re-query DB",
  );

  await invalidateSettingsCache(pool);
  assert.equal(resolveSettingNumber("import.max_file_bytes").value, 3 * 1024 * 1024);

  // OOR / empty string_list / RO â†’ reject before write (Story 10.3)
  const beforeReject = resolveSettingNumber("import.max_file_bytes").value;
  await assert.rejects(
    () =>
      upsertOverride(pool, {
        parameterKey: "import.max_file_bytes",
        value: -1,
      }),
    (err: unknown) =>
      err instanceof GovernedSettingsError &&
      err.code === "SETTINGS_INVALID_DEFINITION",
  );
  assert.equal(
    resolveSettingNumber("import.max_file_bytes").value,
    beforeReject,
    "failed upsert must not change resolved value",
  );

  const allowlistDef = getSettingsParameter("correction.attachment_allowlist");
  assert.equal(validateSettingsValue(allowlistDef, []), null);
  await assert.rejects(
    () =>
      upsertOverride(pool, {
        parameterKey: "correction.attachment_allowlist",
        value: [],
      }),
    (err: unknown) =>
      err instanceof GovernedSettingsError &&
      err.code === "SETTINGS_INVALID_DEFINITION",
  );

  await assert.rejects(
    () =>
      upsertOverride(pool, {
        parameterKey: "export.custody_bulk_row_threshold",
        value: 10,
      }),
    (err: unknown) =>
      err instanceof GovernedSettingsError &&
      err.code === "SETTINGS_INVALID_DEFINITION",
  );

  // Delete override â†’ code default restored without restart
  await deleteOverride(pool, "import.max_file_bytes");
  const afterDelete = resolveSettingNumber("import.max_file_bytes");
  assert.equal(afterDelete.value, 5 * 1024 * 1024);
  assert.equal(afterDelete.source, "code_default");
  assert.equal(afterDelete.degraded, false);

  // Warm safety net: raw invalid store row still degrades (apply path rejects)
  await pool.query(
    `INSERT INTO app_settings.parameter_override
       (parameter_key, value_json, updated_at, updated_by, reason)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP, $3, $4)
     ON CONFLICT (parameter_key) DO UPDATE SET
       value_json = EXCLUDED.value_json`,
    ["import.max_file_bytes", JSON.stringify(-1), "selfcheck", "raw-invalid"],
  );
  await invalidateSettingsCache(pool);
  const degradedWarm = resolveSettingNumber("import.max_file_bytes");
  assert.equal(degradedWarm.value, 5 * 1024 * 1024);
  assert.equal(degradedWarm.source, "code_default");
  assert.equal(degradedWarm.degraded, true);
  assert.ok(isSettingsConfigurationDegraded());
  assert.ok(getSettingsDegradedKeys().includes("import.max_file_bytes"));
  assert.equal(
    getConfigurationOpsHealthSection().detailFa,
    MSG_SETTINGS_CONFIG_DEGRADED_FA,
  );
  await deleteOverride(pool, "import.max_file_bytes");

  // Simulated unavailable store: warm with broken queryable
  resetSettingsCacheForTests();
  const broken = {
    query: async () => {
      throw new Error("simulated store down");
    },
  };
  await warmSettingsCache(broken);
  const unavailable = resolveSettingNumber("import.max_file_bytes");
  assert.equal(unavailable.value, 5 * 1024 * 1024);
  assert.equal(unavailable.source, "code_default");
  const unavailHealth = getConfigurationOpsHealthSection();
  assert.equal(unavailHealth.status, "degraded");
  assert.equal(
    unavailHealth.detailFa,
    MSG_SETTINGS_STORE_UNAVAILABLE_FA,
  );

  console.log("app-settings DB gates: ok");
} finally {
  await pool.end();
}
