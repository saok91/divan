/**
 * Self-check for LDAP auth routing + outage copy invariants (no Vitest in repo yet).
 * Run: pnpm --filter @divan/identity-access exec tsx src/ldap-auth.selfcheck.ts
 *
 * Does not require a live directory — exercises config fail-closed + provider routing.
 */
import assert from "node:assert/strict";

import {
  getIdentityProvider,
  getLdapConfig,
} from "./config";
import type { Entry } from "ldapts";

import {
  MSG_LDAP_UNAVAILABLE,
  attrString,
  buildUserFilter,
  escapeLdapFilterValue,
} from "./ldap-client";

const FREEZE_OUTAGE = "اتصال به سامانه هویت برقرار نیست.";

assert.equal(MSG_LDAP_UNAVAILABLE, FREEZE_OUTAGE);

// --- Provider routing ---
assert.equal(getIdentityProvider({ IDENTITY_PROVIDER: "seeded" }), "seeded");
assert.equal(getIdentityProvider({ IDENTITY_PROVIDER: "ldap" }), "ldap");
assert.equal(getIdentityProvider({ IDENTITY_PROVIDER: "LDAP" }), "ldap");
assert.equal(getIdentityProvider({}), "seeded");
assert.equal(getIdentityProvider({ IDENTITY_PROVIDER: "passport" }), null);
assert.equal(getIdentityProvider({ IDENTITY_PROVIDER: "" }), null);

// --- LDAP config: missing required → null (unavailable, never seeded) ---
assert.equal(getLdapConfig({}), null);
assert.equal(
  getLdapConfig({
    LDAP_URL: "ldaps://ldap.example:636",
    LDAP_BIND_DN: "cn=svc",
    LDAP_BIND_PASSWORD: "x",
    LDAP_BASE_DN: "dc=example,dc=com",
    LDAP_USER_FILTER: "(uid={{username}})",
    // missing LDAP_ID_ATTRIBUTE
  }),
  null,
);

const validEnv = {
  LDAP_URL: "ldaps://ldap.example:636",
  LDAP_BIND_DN: "cn=svc,dc=example,dc=com",
  LDAP_BIND_PASSWORD: "secret",
  LDAP_BASE_DN: "dc=example,dc=com",
  LDAP_USER_FILTER: "(uid={{username}})",
  LDAP_ID_ATTRIBUTE: "entryUUID",
  LDAP_LOGIN_ATTRIBUTE: "uid",
  LDAP_DISPLAY_NAME_ATTRIBUTE: "cn",
};

const cfg = getLdapConfig(validEnv);
assert.ok(cfg);
assert.equal(cfg.url, "ldaps://ldap.example:636");
assert.equal(cfg.idAttribute, "entryUUID");
assert.equal(cfg.tlsRejectUnauthorized, true);
assert.equal(cfg.createMapping.size, 0);

// Filter without {{username}} → invalid
assert.equal(
  getLdapConfig({ ...validEnv, LDAP_USER_FILTER: "(uid=alice)" }),
  null,
);

// Bad create mapping JSON → invalid
assert.equal(
  getLdapConfig({
    ...validEnv,
    LDAP_CREATE_MAPPING_JSON: "{not-json",
  }),
  null,
);

// Invalid coarse role in mapping → invalid
assert.equal(
  getLdapConfig({
    ...validEnv,
    LDAP_CREATE_MAPPING_JSON: JSON.stringify({ alice: "superuser" }),
  }),
  null,
);

const mapped = getLdapConfig({
  ...validEnv,
  LDAP_CREATE_MAPPING_JSON: JSON.stringify({
    alice: "hr_operator",
    "550e8400-e29b-41d4-a716-446655440000": "manager",
  }),
});
assert.ok(mapped);
assert.equal(mapped.createMapping.get("alice"), "hr_operator");
assert.equal(
  mapped.createMapping.get("550e8400-e29b-41d4-a716-446655440000"),
  "manager",
);

// Filter escaping — no injection via special chars
assert.equal(escapeLdapFilterValue("a*b(c)"), "a\\2ab\\28c\\29");
assert.equal(
  buildUserFilter("(uid={{username}})", "a*b"),
  "(uid=a\\2ab)",
);

// Binary directory ids → lowercase hex (not utf8)
const guidBytes = Buffer.from("00112233445566778899aabbccddeeff", "hex");
const binaryEntry = { dn: "cn=x", objectGUID: guidBytes } as unknown as Entry;
assert.equal(attrString(binaryEntry, "objectGUID"), "00112233445566778899aabbccddeeff");
assert.equal(
  attrString({ dn: "cn=y", entryUUID: "abc-123" } as unknown as Entry, "entryUUID"),
  "abc-123",
);

console.log("ldap-auth.selfcheck: ok");
