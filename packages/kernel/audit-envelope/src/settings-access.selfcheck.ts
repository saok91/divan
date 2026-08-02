/**
 * Self-check for settings surface access helpers (Story 10.2).
 * Run: pnpm --filter @divan/audit-envelope selfcheck:settings-access
 */
import assert from "node:assert/strict";

import {
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  MSG_SETTINGS_DENIED_FA,
  SETTINGS_CONFIGURATION_DATA_CATEGORY,
  SETTINGS_READ_PERMISSION,
  evaluateAuthorization,
  isCategoryGrantable,
} from "./index";

assert.equal(MSG_SETTINGS_DENIED_FA, "دسترسی ندارید.");
assert.equal(SETTINGS_READ_PERMISSION, "settings.read");
assert.equal(SETTINGS_CONFIGURATION_DATA_CATEGORY, "settings.configuration");

assert.equal(isCategoryGrantable(DEV_DEMO_CATEGORIES, "health"), false);
assert.equal(
  isCategoryGrantable(DEV_DEMO_CATEGORIES, SETTINGS_CONFIGURATION_DATA_CATEGORY),
  true,
);

const allow = evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
  permission: SETTINGS_READ_PERMISSION,
  dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
  action: "read",
  organizationalScope: "org:selfcheck",
});
assert.equal(allow, "allow");

const denyExport = evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
  permission: SETTINGS_READ_PERMISSION,
  dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY,
  action: "export",
  organizationalScope: "org:selfcheck",
});
assert.equal(denyExport, "deny");

const denyWrongCategory = evaluateAuthorization(
  DEV_DEMO_POLICY,
  DEV_DEMO_CATEGORIES,
  {
    permission: SETTINGS_READ_PERMISSION,
    dataCategory: "ops.platform",
    action: "read",
    organizationalScope: "org:selfcheck",
  },
);
assert.equal(denyWrongCategory, "deny");

console.log("settings-access selfcheck: ok");
