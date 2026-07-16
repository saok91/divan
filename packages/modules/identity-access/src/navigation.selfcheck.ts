/**
 * Self-check for Epic-1 coarse nav matrix (no Vitest in repo yet).
 * Run: pnpm --filter @divan/identity-access exec tsx src/navigation.selfcheck.ts
 */
import assert from "node:assert/strict";

import {
  canAccessPath,
  getNavItemsForRole,
  getRoleLandingPath,
  NAV_CATALOG,
  resolvePostLoginPath,
} from "./navigation";
import type { CoarseRole } from "./types";

const EXPECTED_LANDINGS: Record<CoarseRole, string> = {
  hr_operator: "/personnel",
  hr_admin: "/dashboard",
  manager: "/dashboard",
  audit_reviewer: "/audit",
  system_admin: "/operations",
};

const EXPECTED_NAV: Record<CoarseRole, string[]> = {
  hr_operator: ["/dashboard", "/personnel", "/headcount", "/reports"],
  hr_admin: [
    "/dashboard",
    "/personnel",
    "/organization",
    "/headcount",
    "/reports",
    "/import",
    "/access",
    "/correction-cases",
  ],
  manager: ["/dashboard", "/personnel", "/headcount", "/reports"],
  audit_reviewer: ["/audit"],
  system_admin: ["/operations"],
};

assert.equal(NAV_CATALOG.length, 10);

for (const role of Object.keys(EXPECTED_LANDINGS) as CoarseRole[]) {
  assert.equal(getRoleLandingPath(role), EXPECTED_LANDINGS[role], role);
  assert.deepEqual(
    getNavItemsForRole(role).map((i) => i.href),
    EXPECTED_NAV[role],
    role,
  );
}

assert.equal(canAccessPath("hr_operator", "/personnel"), true);
assert.equal(canAccessPath("hr_operator", "/personnel/abc"), true);
assert.equal(canAccessPath("hr_operator", "/operations"), false);
assert.equal(canAccessPath("audit_reviewer", "/audit"), true);
assert.equal(canAccessPath("audit_reviewer", "/dashboard"), false);
assert.equal(canAccessPath("system_admin", "/operations"), true);
assert.equal(canAccessPath("system_admin", "/personnel"), false);

assert.equal(canAccessPath("hr_operator", "/personnel/../operations"), false);
assert.equal(canAccessPath("hr_operator", "/personnel/%2e%2e/operations"), false);
assert.equal(
  canAccessPath("not_a_role" as CoarseRole, "/personnel"),
  false,
);
assert.deepEqual(getNavItemsForRole("not_a_role" as CoarseRole), []);
assert.equal(getRoleLandingPath("not_a_role" as CoarseRole), "/login");

assert.equal(
  resolvePostLoginPath("hr_operator", "/operations"),
  "/personnel",
);
assert.equal(
  resolvePostLoginPath("hr_operator", "/personnel"),
  "/personnel",
);
assert.equal(
  resolvePostLoginPath("hr_operator", "/personnel/../operations"),
  "/personnel",
);
assert.equal(
  resolvePostLoginPath("hr_admin", "//evil.example"),
  "/dashboard",
);
assert.equal(
  resolvePostLoginPath("hr_admin", "https://evil.example/x"),
  "/dashboard",
);

console.log("navigation.selfcheck: ok");
