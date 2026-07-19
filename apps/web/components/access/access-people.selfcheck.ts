/**
 * Selfcheck for Access people helpers (Story 4b.5).
 * Run: pnpm --filter @divan/web selfcheck:access-people
 */
import assert from "node:assert/strict";

import {
  directoryLinkStatus,
  hasNoEntitlementAssignments,
  joinPersianList,
  PEOPLE_SECTION_DEFAULT_FILTERS,
  primaryRoleCode,
} from "./access-people-helpers";

const emptyRows = [
  {
    accessRoleIds: [] as string[],
    organizationalScopeIds: [] as string[],
    accessRoleCodes: [] as string[],
    externalDirectoryId: null as string | null,
  },
];

assert.equal(hasNoEntitlementAssignments(emptyRows), true);
assert.equal(
  hasNoEntitlementAssignments([
    {
      ...emptyRows[0]!,
      accessRoleIds: ["r1"],
      accessRoleCodes: ["admin"],
    },
  ]),
  false,
);
assert.equal(
  hasNoEntitlementAssignments([
    {
      ...emptyRows[0]!,
      organizationalScopeIds: ["s1"],
    },
  ]),
  false,
);

assert.equal(directoryLinkStatus(null), "unlinked");
assert.equal(directoryLinkStatus("ldap-1"), "linked");
assert.equal(directoryLinkStatus("   "), "unlinked");
assert.equal(directoryLinkStatus("\t"), "unlinked");

assert.equal(primaryRoleCode([]), "");
assert.equal(primaryRoleCode(["admin", "ops"]), "admin");

assert.equal(joinPersianList([]), "—");
assert.equal(joinPersianList(["a", "b"]), "a، b");

assert.deepEqual(PEOPLE_SECTION_DEFAULT_FILTERS, { status: ["active"] });

console.log("access-people selfcheck: ok");
