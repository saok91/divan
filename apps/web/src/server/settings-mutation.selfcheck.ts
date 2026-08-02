/**
 * Settings mutation selfcheck (Story 10.3) — static + pure gates.
 * Covers: RO reject wiring, OOR validate, role domain deny, reset path,
 * write soft-deny, FormLayout first-touch on edit chrome.
 * Run: pnpm --filter @divan/web selfcheck:settings-mutation
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SETTINGS_CONFIGURATION_DATA_CATEGORY,
  SETTINGS_READ_PERMISSION,
  SETTINGS_WRITE_PERMISSION,
} from "@divan/audit-envelope";
import {
  assertValidSettingsValue,
  getSettingsParameter,
  listAdminEditableKeys,
  validateSettingsValue,
  GovernedSettingsError,
} from "@divan/app-settings";

import { operationalCopy } from "../../lib/operational-copy";
import { roleMaySeeDomain } from "../../lib/settings-domain-map";

const here = dirname(fileURLToPath(import.meta.url));
const routerSrc = readFileSync(join(here, "settings.ts"), "utf8");
const editorSrc = readFileSync(
  join(here, "../../components/settings/settings-parameter-editor.tsx"),
  "utf8",
);
const rowSrc = readFileSync(
  join(here, "../../components/settings/settings-parameter-row.tsx"),
  "utf8",
);
const panelSrc = readFileSync(
  join(here, "../../components/settings/settings-domain-panel.tsx"),
  "utf8",
);

assert.equal(SETTINGS_READ_PERMISSION, "settings.read");
assert.equal(SETTINGS_WRITE_PERMISSION, "settings.write");
assert.equal(SETTINGS_CONFIGURATION_DATA_CATEGORY, "settings.configuration");

// --- Pure: OOR / empty allowlist reject ---
const maxFile = getSettingsParameter("import.max_file_bytes");
assert.equal(validateSettingsValue(maxFile, -1), null);
assert.throws(
  () => assertValidSettingsValue(maxFile, -1),
  (err: unknown) =>
    err instanceof GovernedSettingsError &&
    err.code === "SETTINGS_INVALID_DEFINITION",
);

const allowlist = getSettingsParameter("correction.attachment_allowlist");
assert.equal(validateSettingsValue(allowlist, []), null);
assert.equal(validateSettingsValue(allowlist, ["exe"]), null);
assert.deepEqual(validateSettingsValue(allowlist, ["pdf"]), ["pdf"]);

// --- Pure: RO custody stays read_only ---
const custody = getSettingsParameter("export.custody_bulk_row_threshold");
assert.equal(custody.editability, "read_only_with_evidence");
assert.ok(!listAdminEditableKeys().includes(custody.key));

for (const key of [
  "session.idle_timeout_seconds",
  "identity.ldap_configured",
  "audit.trust_enforce",
  "audit.inference_bulk_enabled",
  "infra.pg_pool_max",
  "infra.baseline_boundary_date",
] as const) {
  const def = getSettingsParameter(key);
  assert.equal(def.editability, "read_only_with_evidence", key);
  assert.ok(!listAdminEditableKeys().includes(key), key);
}

// --- Pure: role domain deny for write-relevant keys ---
assert.equal(
  roleMaySeeDomain("hr_admin", "access_session"),
  false,
  "hr_admin must not mutate entitlement.recert_window_ms domain",
);
assert.equal(roleMaySeeDomain("system_admin", "access_session"), true);
assert.equal(roleMaySeeDomain("system_admin", "import_export"), false);
assert.equal(roleMaySeeDomain("hr_admin", "import_export"), true);

// --- Router: apply/reset + write soft deny ---
assert.match(routerSrc, /applyParameter:\s*governedProcedure/);
assert.match(routerSrc, /reset:\s*governedProcedure/);
assert.match(routerSrc, /SETTINGS_WRITE_PERMISSION/);
assert.match(routerSrc, /actorHoldsSettingsWrite/);
assert.match(routerSrc, /permission_set_missing/);
assert.match(routerSrc, /operation:\s*"settings\.apply"/);
assert.match(routerSrc, /operation:\s*"settings\.reset"/);
assert.match(routerSrc, /action:\s*"write"/);
assert.match(routerSrc, /assertValidSettingsValue/);
assert.match(routerSrc, /upsertOverride/);
assert.match(routerSrc, /deleteOverride/);
assert.match(routerSrc, /isSettingsStoreUnavailable/);
assert.match(routerSrc, /warmSettingsCache/);
assert.match(routerSrc, /if\s*\(\s*!deleted\s*\)/);
assert.match(routerSrc, /editability !== "admin_editable"/);
assert.match(routerSrc, /roleMaySeeDomain/);
assert.match(routerSrc, /PRECONDITION_FAILED/);
assert.match(routerSrc, /settingsStoreUnavailableApply/);
assert.match(routerSrc, /highImpact/);
assert.match(routerSrc, /blastRadiusFa/);
assert.doesNotMatch(routerSrc, /effectAt.*scheduling/);
assert.match(routerSrc, /effectAt:\s*null/);

// --- UI: FormLayout + RowActionButton + leave-guard + FeedbackMessage ---
assert.match(editorSrc, /data-slot="form-layout"|FormLayout/);
assert.match(editorSrc, /FormLayout/);
assert.match(editorSrc, /RowActionButton/);
assert.match(editorSrc, /useLeaveGuardRegistration/);
assert.match(editorSrc, /lastChangedAtIso == null/);
assert.match(editorSrc, /busyRef/);
assert.match(editorSrc, /type=\{row\.valueType === "duration_ms" \? "text" : "number"\}/);
assert.match(editorSrc, /blastRadiusFa|data-settings-blast-radius/);
assert.match(editorSrc, /settingsApplyCta|settingsApplyOpenConfirm/);
assert.match(rowSrc, /SettingsParameterEditor/);
assert.match(rowSrc, /read_only_with_evidence/);
assert.match(panelSrc, /FeedbackMessage/);
assert.match(panelSrc, /onRowUpdated/);
assert.match(panelSrc, /exportInventory/);
assert.match(panelSrc, /settingsInventoryExportCta/);
assert.match(routerSrc, /exportInventory:\s*governedProcedure/);
assert.match(routerSrc, /settings\.inventory\.view/);
assert.match(routerSrc, /settings\.inventory\.export/);
assert.match(routerSrc, /createExportArtifact/);
assert.match(routerSrc, /settings_inventory/);
assert.match(routerSrc, /serializeSettingsInventoryValue/);
assert.doesNotMatch(editorSrc, /مشاهده در ممیزی/);
assert.doesNotMatch(panelSrc, /مشاهده در ممیزی/);
assert.ok(
  !listAdminEditableKeys().some((k) =>
    /password|secret|database_url|bind_dn|tls_ca/i.test(k),
  ),
  "no secret-shaped admin keys",
);

// --- Copy honesty ---
assert.ok(operationalCopy.settingsReasonHelp.includes("۱۰"));
assert.ok(operationalCopy.settingsStoreUnavailableApply.includes("مخزن"));
assert.ok(
  !operationalCopy.settingsSurfacePurpose.includes("فقط مشاهده"),
  "surface purpose must reflect edit wave",
);

console.log("settings-mutation selfcheck: ok");
