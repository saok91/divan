import assert from "node:assert/strict";
import { collaborationTypeLabel } from "./collaboration-type";
import { initialDraft, shouldRefreshSettingsDraft } from "./settings-draft";
import { writeTablePreferences } from "./table-preferences-storage";
const previous = { key: "test", valueType: "number", value: 10 };
const incoming = { ...previous, value: 20 };
assert.equal(shouldRefreshSettingsDraft(previous, incoming, "10", false), true);
assert.equal(initialDraft(incoming), "20");
assert.equal(shouldRefreshSettingsDraft(previous, incoming, "15", false), false);
assert.equal(shouldRefreshSettingsDraft(previous, incoming, "10", true), false);
assert.equal(shouldRefreshSettingsDraft(previous, { ...incoming, key: "other" }, "15", true), true);
assert.equal(collaborationTypeLabel("employee"), "کارمند");
for (const value of ["__proto__", "constructor", "toString", "custom"]) assert.equal(collaborationTypeLabel(value), value);
// An existing readable preference must not imply that persistence succeeds.
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
try {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: { setItem() { throw new Error("quota"); } },
  } });
  assert.equal(writeTablePreferences("a", "t", { density: "comfortable", hiddenColumnIds: [] }), false);
} finally {
  if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
  else Reflect.deleteProperty(globalThis, "window");
}
console.log("Product UI boundary checks passed.");
