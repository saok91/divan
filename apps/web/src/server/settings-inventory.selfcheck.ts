/**
 * Settings inventory selfcheck (Story 10.4) — static + pure gates.
 * Covers: environment source wiring, secret denial, view audit, export path,
 * RO mutate still forbidden, hr_admin domain matrix.
 * Run: pnpm --filter @divan/web selfcheck:settings-inventory
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GOVERNED_SETTINGS_REGISTRY,
  getSettingsParameter,
  isSecretShapedKey,
  listAdminEditableKeys,
  resetSettingsCacheForTests,
  resolveSetting,
  serializeSettingsInventoryValue,
  valueLooksLikeSecret,
  warmSettingsCacheFromEnvOnly,
  GovernedSettingsError,
} from "@divan/app-settings";

import { roleMaySeeDomain } from "../../lib/settings-domain-map";
import { operationalCopy } from "../../lib/operational-copy";

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const routerSrc = readFileSync(join(here, "settings.ts"), "utf8");
  const panelSrc = readFileSync(
    join(here, "../../components/settings/settings-domain-panel.tsx"),
    "utf8",
  );
  const matrixSrc = readFileSync(
    join(here, "../../lib/design-qa-mockup-matrix.md"),
    "utf8",
  );

  const inventoryFamilies = [
    "session.idle_timeout_seconds",
    "session.absolute_timeout_seconds",
    "identity.provider_mode",
    "identity.ldap_configured",
    "identity.ldap_url_scheme",
    "audit.inference_bulk_enabled",
    "audit.trust_enforce",
    "audit.envelope_category_count",
    "infra.pg_pool_max",
    "infra.baseline_boundary_date",
  ] as const;

  for (const key of inventoryFamilies) {
    const def = getSettingsParameter(key);
    assert.equal(def.editability, "read_only_with_evidence", key);
    assert.ok(def.changePathFa && def.changePathFa.trim().length > 0, key);
    assert.ok(!listAdminEditableKeys().includes(key), key);
    assert.ok(!isSecretShapedKey(key), key);
  }

  assert.ok(
    GOVERNED_SETTINGS_REGISTRY.some((d) => d.owningDomain === "audit_integrity"),
  );

  // Environment producer
  resetSettingsCacheForTests();
  await warmSettingsCacheFromEnvOnly({
    AUTH_SESSION_IDLE_TIMEOUT_SECONDS: "7200",
    IDENTITY_PROVIDER: "ldap",
    DIVAN_PG_POOL_MAX: "12",
    DIVAN_BASELINE_BOUNDARY_DATE: "2024-01-15",
    NODE_ENV: "development",
  });
  assert.equal(
    resolveSetting("session.idle_timeout_seconds").source,
    "environment",
  );
  assert.equal(resolveSetting("session.idle_timeout_seconds").value, 7200);
  assert.equal(resolveSetting("identity.provider_mode").source, "environment");
  assert.equal(resolveSetting("identity.provider_mode").value, "ldap");
  assert.equal(resolveSetting("infra.pg_pool_max").source, "environment");
  assert.equal(resolveSetting("infra.pg_pool_max").value, 12);
  assert.equal(
    resolveSetting("infra.baseline_boundary_date").source,
    "environment",
  );
  assert.equal(resolveSetting("infra.baseline_boundary_date").value, "2024-01-15");

  resetSettingsCacheForTests();
  await warmSettingsCacheFromEnvOnly({ NODE_ENV: "development" });
  assert.equal(
    resolveSetting("session.idle_timeout_seconds").source,
    "code_default",
  );
  assert.equal(resolveSetting("infra.baseline_boundary_date").value, "unset");

  resetSettingsCacheForTests();
  await warmSettingsCacheFromEnvOnly({
    AUDIT_INFERENCE_BULK_ENABLED: "false",
    NODE_ENV: "development",
  });
  assert.equal(
    resolveSetting("audit.inference_bulk_min_cohort").value,
    Number.MAX_SAFE_INTEGER,
  );
  assert.equal(resolveSetting("audit.inference_bulk_enabled").value, false);

  resetSettingsCacheForTests();
  await warmSettingsCacheFromEnvOnly({
    DIVAN_BASELINE_BOUNDARY_DATE: "2024-02-31",
    NODE_ENV: "development",
  });
  assert.equal(resolveSetting("infra.baseline_boundary_date").value, "unset");
  assert.equal(resolveSetting("infra.baseline_boundary_date").degraded, true);

  // Secret denial
  assert.ok(valueLooksLikeSecret("postgresql://x:y@h/db"));
  assert.ok(valueLooksLikeSecret("-----BEGIN RSA PRIVATE KEY-----"));
  const poolDef = getSettingsParameter("infra.pg_pool_max");
  assert.throws(
    () =>
      serializeSettingsInventoryValue(
        { ...poolDef, key: "infra.database_url" },
        "postgresql://x:y@h/db",
      ),
    (err: unknown) =>
      err instanceof GovernedSettingsError &&
      err.code === "SETTINGS_INVALID_DEFINITION",
  );

  // Role matrix
  assert.equal(roleMaySeeDomain("hr_admin", "audit_integrity"), false);
  assert.equal(roleMaySeeDomain("hr_admin", "infrastructure"), false);
  assert.equal(roleMaySeeDomain("system_admin", "audit_integrity"), true);
  assert.equal(roleMaySeeDomain("system_admin", "infrastructure"), true);

  // Router / UI wiring
  assert.match(routerSrc, /settings\.inventory\.view/);
  assert.match(routerSrc, /exportInventory/);
  assert.match(routerSrc, /downloadInventoryExport/);
  assert.match(routerSrc, /createExportArtifact/);
  assert.match(routerSrc, /downloadExportArtifact/);
  assert.match(routerSrc, /sourceSurface:\s*"settings_inventory"/);
  assert.match(routerSrc, /serializeSettingsInventoryValue/);
  assert.match(routerSrc, /editability !== "admin_editable"/);
  assert.doesNotMatch(
    routerSrc,
    /Prefer list visibility; soft append failure must not block read/,
  );
  assert.match(panelSrc, /exportInventory/);
  assert.match(panelSrc, /downloadInventoryExport/);
  assert.match(panelSrc, /settingsInventoryExportCta/);
  assert.match(panelSrc, /FeedbackMessage/);
  assert.match(panelSrc, /Dialog/);
  assert.doesNotMatch(
    panelSrc,
    /\u0645\u0634\u0627\u0647\u062f\u0647 \u062f\u0631 \u0645\u0645\u06cc\u0632\u06cc/,
  );
  assert.ok(
    !GOVERNED_SETTINGS_REGISTRY.some(
      (d) =>
        /password|secret|database_url|bind_password|tls_ca|bind_dn/i.test(d.key) ||
        (typeof d.defaultValue === "string" &&
          valueLooksLikeSecret(d.defaultValue)),
    ),
    "registry must not inventory secrets",
  );
  assert.match(matrixSrc, /10\.4/);
  assert.ok(
    operationalCopy.settingsInventoryExportCta.includes(
      "\u0645\u0648\u062c\u0648\u062f\u06cc",
    ),
  );
  assert.ok(
    operationalCopy.settingsSourceEnvironment.includes("\u0645\u062d\u06cc\u0637"),
  );
  assert.ok(
    operationalCopy.settingsInventorySectionHint.includes(
      "\u06a9\u0644 \u0645\u0648\u062c\u0648\u062f\u06cc",
    ),
  );

  console.log("settings-inventory selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
