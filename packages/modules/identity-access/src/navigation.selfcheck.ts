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
  hr_operator: "/personnel/list",
  hr_admin: "/dashboard",
  manager: "/dashboard",
  audit_reviewer: "/audit",
  system_admin: "/operations",
};

const EXPECTED_NAV: Record<CoarseRole, string[]> = {
  hr_operator: [
    "/dashboard",
    "/personnel",
    "/personnel-events",
    "/headcount",
    "/reports",
  ],
  hr_admin: [
    "/dashboard",
    "/personnel",
    "/personnel-events",
    "/organization",
    "/headcount",
    "/reports",
    "/import",
    "/access",
    "/correction-cases",
  ],
  manager: [
    "/dashboard",
    "/personnel",
    "/personnel-events",
    "/headcount",
    "/reports",
  ],
  audit_reviewer: ["/audit"],
  system_admin: ["/operations"],
};

const EXPECTED_CATALOG_ORDER = [
  "/dashboard",
  "/personnel",
  "/personnel-events",
  "/organization",
  "/headcount",
  "/reports",
  "/import",
  "/access",
  "/audit",
  "/operations",
  "/correction-cases",
] as const;

assert.equal(NAV_CATALOG.length, 11);
assert.deepEqual(
  NAV_CATALOG.map((i) => i.href),
  [...EXPECTED_CATALOG_ORDER],
);
assert.equal(NAV_CATALOG[1]?.label, "اطلاعات پرسنلی");
assert.equal(NAV_CATALOG[2]?.label, "رویدادهای پرسنلی");
assert.equal(
  NAV_CATALOG.find((i) => i.href === "/correction-cases")?.label,
  "اصلاح اطلاعات",
);

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
assert.equal(canAccessPath("hr_operator", "/personnel-events"), true);
assert.equal(canAccessPath("hr_operator", "/personnel-events/anything"), true);
assert.equal(canAccessPath("hr_operator", "/operations"), false);
assert.equal(canAccessPath("audit_reviewer", "/audit"), true);
assert.equal(canAccessPath("audit_reviewer", "/dashboard"), false);
assert.equal(canAccessPath("audit_reviewer", "/personnel-events"), false);
assert.equal(canAccessPath("system_admin", "/operations"), true);
assert.equal(canAccessPath("system_admin", "/personnel"), false);
assert.equal(canAccessPath("system_admin", "/personnel-events"), false);

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
  "/personnel/list",
);
assert.equal(
  resolvePostLoginPath("hr_operator", null),
  "/personnel/list",
);
assert.equal(
  resolvePostLoginPath("hr_operator", "/personnel"),
  "/personnel",
);
assert.equal(
  resolvePostLoginPath("hr_operator", "/personnel/list"),
  "/personnel/list",
);
assert.equal(
  resolvePostLoginPath("hr_operator", "/personnel/../operations"),
  "/personnel/list",
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
