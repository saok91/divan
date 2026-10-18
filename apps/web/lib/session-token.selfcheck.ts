import assert from "node:assert/strict";
import type { SessionContext } from "@divan/identity-access";
import { refreshSessionToken } from "./session-token";

async function main() {
  const context: SessionContext = {
    accountId: "test", username: "test", displayName: "Test", coarseRole: "hr_operator",
    humanIdentityId: "test-human", organizationalScopeIds: ["current-scope"],
    organizationalScopeCodes: ["current-code"], accessRoleIds: [],
    authzBindingFingerprint: "current", breakGlass: { active: false, expiresAt: null, incidentId: null, grantId: null },
  };
  let loads = 0;
  const load = async () => { loads++; return context; };
  const base = { accountId: "test", absoluteExp: 2000, lastActivityAt: 950, authzBindingFingerprint: "login" };
  for (const trigger of [undefined, "update"]) {
    for (const invalid of [
      { absoluteExp: 1000 }, { absoluteExp: 999 }, { absoluteExp: NaN },
      { lastActivityAt: 900 }, { lastActivityAt: 1001 }, { lastActivityAt: Infinity },
      { accountId: "" }, { absoluteExp: undefined }, { lastActivityAt: undefined },
    ]) {
      assert.equal(await refreshSessionToken({ ...base, ...invalid }, trigger, 1000, { idleTimeoutSeconds: 100 }, load), null);
    }
  }
  assert.equal(loads, 0, "Expired updates must not reach identity loading");
  const normal = await refreshSessionToken({ ...base }, undefined, 1000, { idleTimeoutSeconds: 100 }, load);
  assert.equal(normal?.authzBindingFingerprint, "login", "Keep mid-session change detection on reads");
  assert.deepEqual(normal?.organizationalScopeIds, ["current-scope"]);
  const updated = await refreshSessionToken({ ...base }, "update", 1000, { idleTimeoutSeconds: 100 }, load);
  assert.equal(updated?.authzBindingFingerprint, "current");
  assert.equal(updated?.absoluteExp, 2000, "Updates cannot extend absolute lifetime");
  assert.equal(updated?.lastActivityAt, 1000);
  assert.equal(loads, 2);
  assert.equal(await refreshSessionToken({ ...base }, "update", 1000, { idleTimeoutSeconds: 100 }, async () => null), null);
  console.log("session-token.selfcheck: ok");
}
void main();
