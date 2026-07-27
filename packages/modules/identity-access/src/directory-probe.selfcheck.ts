/**
 * Self-check for directory connectivity probe (Story 7.2).
 * Run: pnpm --filter @divan/identity-access selfcheck:directory-probe
 */
import assert from "node:assert/strict";

import { MSG_LDAP_UNAVAILABLE } from "./ldap-client";
import { probeDirectoryConnectivity } from "./directory-probe";

async function main() {
  assert.equal(MSG_LDAP_UNAVAILABLE, "اتصال به سامانه هویت برقرار نیست.");

  const seeded = await probeDirectoryConnectivity({
    IDENTITY_PROVIDER: "seeded",
  });
  assert.equal(seeded.status, "not_configured");
  assert.ok(seeded.detailFa.includes("seeded"));

  const unknown = await probeDirectoryConnectivity({
    IDENTITY_PROVIDER: "weird-provider",
  });
  assert.equal(unknown.status, "unavailable");
  assert.equal(unknown.detailFa, MSG_LDAP_UNAVAILABLE);

  // LDAP mode without config → not_configured / unavailable honesty, not fake green.
  const ldapMissing = await probeDirectoryConnectivity({
    IDENTITY_PROVIDER: "ldap",
  });
  assert.ok(
    ldapMissing.status === "not_configured" ||
      ldapMissing.status === "unavailable" ||
      ldapMissing.status === "red",
  );
  assert.notEqual(ldapMissing.status, "ok");

  // Redaction: probe result must not contain secret-looking keys.
  const json = JSON.stringify(ldapMissing);
  assert.ok(!/"bindPassword"\s*:/i.test(json));
  assert.ok(!/"password"\s*:/i.test(json));

  console.log("directory-probe selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
