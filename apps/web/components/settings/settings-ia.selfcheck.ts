/**
 * Settings IA selfcheck (Story 10.2) — role→tab matrix + empty-domain omit +
 * SECTION_TAB_SURFACES parity.
 * Run: pnpm --filter @divan/web exec tsx components/settings/settings-ia.selfcheck.ts
 * (or selfcheck:settings-ia)
 */
import assert from "node:assert/strict";

import { GOVERNED_SETTINGS_REGISTRY } from "@divan/app-settings";

import { SECTION_TAB_SURFACES } from "../../lib/section-tab-surfaces";
import {
  defaultSettingsTabHref,
  domainHasRegistryKeys,
  domainsForRole,
  registryKeyCountForDomain,
  SETTINGS_DOMAIN_TABS,
  visibleDomainsForRole,
  visibleSettingsTabsForRole,
} from "../../lib/settings-domain-map";

assert.equal(SETTINGS_DOMAIN_TABS.length, 7);

const settingsSurface = SECTION_TAB_SURFACES.find((s) => s.root === "/settings");
assert.ok(settingsSurface, "SECTION_TAB_SURFACES must register /settings");
assert.equal(settingsSurface!.tabs.length, 7);
const surfaceTabs = settingsSurface!.tabs;
for (const domainTab of SETTINGS_DOMAIN_TABS) {
  const matched = surfaceTabs.find((t) => t.id === domainTab.id);
  assert.ok(matched, `missing surface tab id=${domainTab.id}`);
  assert.equal(matched!.label, domainTab.labelFa, `label drift id=${domainTab.id}`);
  assert.equal(matched!.href, domainTab.href, `href drift id=${domainTab.id}`);
}
for (const orphanCandidate of surfaceTabs) {
  assert.ok(
    SETTINGS_DOMAIN_TABS.some((t) => t.id === orphanCandidate.id),
    `orphan surface tab id=${orphanCandidate.id}`,
  );
}

assert.deepEqual([...domainsForRole("hr_admin")], [
  "general_display",
  "data_retention",
  "import_export",
  "capacity_hiring",
]);
assert.deepEqual([...domainsForRole("system_admin")], [
  "general_display",
  "access_session",
  "audit_integrity",
  "infrastructure",
]);
assert.deepEqual([...domainsForRole("hr_operator")], []);
assert.deepEqual([...domainsForRole("manager")], []);
assert.deepEqual([...domainsForRole("audit_reviewer")], []);

assert.equal(registryKeyCountForDomain("audit_integrity"), 0);
assert.equal(domainHasRegistryKeys("audit_integrity"), false);
assert.ok(domainHasRegistryKeys("general_display"));
assert.ok(domainHasRegistryKeys("import_export"));

assert.ok(
  !visibleDomainsForRole("system_admin").includes("audit_integrity"),
  "capabilities-facing visibleDomains must omit empty domains",
);

const hrTabs = visibleSettingsTabsForRole("hr_admin");
assert.ok(hrTabs.every((t) => t.id !== "audit-integrity"));
assert.ok(hrTabs.every((t) => t.id !== "infrastructure"));
assert.ok(hrTabs.every((t) => t.id !== "access-session"));
assert.ok(hrTabs.some((t) => t.id === "general-display"));
assert.ok(hrTabs.some((t) => t.id === "import-export"));

const sysTabs = visibleSettingsTabsForRole("system_admin");
assert.ok(sysTabs.every((t) => t.id !== "data-retention"));
assert.ok(sysTabs.every((t) => t.id !== "import-export"));
assert.ok(sysTabs.every((t) => t.id !== "capacity-hiring"));
assert.ok(sysTabs.every((t) => t.id !== "audit-integrity"), "empty domain omitted");
assert.ok(sysTabs.some((t) => t.id === "general-display"));
assert.ok(sysTabs.some((t) => t.id === "infrastructure"));

assert.equal(defaultSettingsTabHref("hr_admin"), "/settings/general-display");
assert.equal(defaultSettingsTabHref("system_admin"), "/settings/general-display");
assert.equal(defaultSettingsTabHref("hr_operator"), null);

const importKeys = GOVERNED_SETTINGS_REGISTRY.filter(
  (d) => d.owningDomain === "import_export",
).map((d) => d.key);
assert.ok(importKeys.length > 0);
assert.ok(importKeys.includes("import.max_file_bytes"));

console.log("settings-ia.selfcheck: ok");
