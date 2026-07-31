/**
 * Leave-guard algorithm selfcheck (Story 8.7 AC #5).
 * Run via: pnpm --filter @divan/web selfcheck:leave-guard
 */
import assert from "node:assert/strict";

import {
  decideRequestNavigation,
  decideSaveGate,
  LEAVE_GUARD_SAVE_UNAVAILABLE_REASON,
} from "./leave-guard-algorithm";

assert.deepEqual(
  decideRequestNavigation({ dirtyCount: 0, hasPending: false }),
  { kind: "navigate-clean" },
);

assert.deepEqual(
  decideRequestNavigation({ dirtyCount: 0, hasPending: true }),
  { kind: "clear-pending-and-navigate" },
  "dirty cleared while dialog pending must clear waiter then navigate",
);

assert.deepEqual(
  decideRequestNavigation({ dirtyCount: 1, hasPending: false }),
  { kind: "open-dialog" },
);

assert.deepEqual(
  decideRequestNavigation({ dirtyCount: 2, hasPending: true }),
  { kind: "replace-waiter" },
  "second navigation while pending must replace waiter — never silent false",
);

assert.deepEqual(decideSaveGate({ everyDirtyHasOnSave: true }), {
  kind: "proceed",
});

const blocked = decideSaveGate({ everyDirtyHasOnSave: false });
assert.equal(blocked.kind, "blocked-no-save");
if (blocked.kind === "blocked-no-save") {
  assert.equal(blocked.reason, LEAVE_GUARD_SAVE_UNAVAILABLE_REASON);
  assert.ok(blocked.reason.length > 0, "blocked save must expose a reason");
}

console.log("leave-guard-algorithm.selfcheck: ok");
