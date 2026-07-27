/**
 * Self-check for data lifecycle domain helpers (Story 7.3).
 * Run: pnpm --filter @divan/audit-envelope selfcheck:data-lifecycle
 */
import assert from "node:assert/strict";

import {
  DATA_LIFECYCLE_DATA_CATEGORY,
  DATA_LIFECYCLE_DISPOSE_PERMISSION,
  DATA_LIFECYCLE_HOLD_PERMISSION,
  DATA_LIFECYCLE_READ_PERMISSION,
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  DataLifecycleError,
  MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
  MSG_LIFECYCLE_DENIED_FA,
  MSG_LIFECYCLE_METADATA_INCOMPLETE_FA,
  disposalActionForClass,
  evaluateAuthorization,
  isCategoryGrantable,
  parseLifecycleClass,
} from "./index";

function main() {
  assert.equal(MSG_LIFECYCLE_DENIED_FA, "دسترسی ندارید.");
  assert.equal(DATA_LIFECYCLE_READ_PERMISSION, "data.lifecycle.read");
  assert.equal(DATA_LIFECYCLE_HOLD_PERMISSION, "data.lifecycle.hold");
  assert.equal(DATA_LIFECYCLE_DISPOSE_PERMISSION, "data.lifecycle.dispose");
  assert.equal(DATA_LIFECYCLE_DATA_CATEGORY, "data.lifecycle");

  // Person health must remain disabled; lifecycle uses data.lifecycle.
  assert.equal(isCategoryGrantable(DEV_DEMO_CATEGORIES, "health"), false);
  assert.equal(
    isCategoryGrantable(DEV_DEMO_CATEGORIES, DATA_LIFECYCLE_DATA_CATEGORY),
    true,
  );

  for (const [perm, action] of [
    [DATA_LIFECYCLE_READ_PERMISSION, "read"],
    [DATA_LIFECYCLE_HOLD_PERMISSION, "write"],
    [DATA_LIFECYCLE_DISPOSE_PERMISSION, "write"],
  ] as const) {
    const allow = evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: perm,
      dataCategory: DATA_LIFECYCLE_DATA_CATEGORY,
      action,
      organizationalScope: "org:selfcheck",
    });
    assert.equal(allow, "allow", `${perm}×${action}`);
  }

  const denyWrongCat = evaluateAuthorization(
    DEV_DEMO_POLICY,
    DEV_DEMO_CATEGORIES,
    {
      permission: DATA_LIFECYCLE_READ_PERMISSION,
      dataCategory: "health",
      action: "read",
      organizationalScope: "org:selfcheck",
    },
  );
  assert.equal(denyWrongCat, "deny");

  // SoD: audit/ops permissions are not lifecycle grants
  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: "audit.investigate",
      dataCategory: DATA_LIFECYCLE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
    }),
    "deny",
  );
  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: "ops.health.read",
      dataCategory: DATA_LIFECYCLE_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
    }),
    "deny",
  );

  assert.equal(parseLifecycleClass("retain"), "retain");
  assert.equal(parseLifecycleClass("anonymize_on_end"), "anonymize_on_end");
  assert.equal(
    parseLifecycleClass("workforce-master-data retention (AR-DATA)"),
    "retain",
  );
  assert.equal(parseLifecycleClass("made-up-blurb"), null);
  assert.equal(parseLifecycleClass(""), null);

  assert.equal(disposalActionForClass("retain"), "skip");
  assert.equal(disposalActionForClass("delete_on_end"), "delete");

  let threw = false;
  try {
    disposalActionForClass("unknown-free-text");
  } catch (e) {
    threw = true;
    assert.ok(e instanceof DataLifecycleError);
    assert.equal(e.code, "LIFECYCLE_METADATA_INCOMPLETE");
    assert.equal(e.messageFa, MSG_LIFECYCLE_METADATA_INCOMPLETE_FA);
  }
  assert.equal(threw, true);

  const blocked = new DataLifecycleError(
    "DISPOSAL_BLOCKED_BY_HOLD",
    MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
  );
  assert.equal(blocked.messageFa, MSG_DISPOSAL_BLOCKED_BY_HOLD_FA);

  console.log("data-lifecycle selfcheck: ok");
}

main();
