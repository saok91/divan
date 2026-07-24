/**
 * Dashboard filter + copy oracle selfcheck (Story 5.4).
 * Run: pnpm --filter @divan/web selfcheck:dashboard
 *
 * Complements @divan/reporting selfcheck:dashboard (conservation / trend).
 */
import assert from "node:assert/strict";

import { operationalCopy } from "@/lib/operational-copy";

import { dashboardFilterSchema } from "./dashboard";

assert.equal(operationalCopy.suppressedCohort, "داده قابل نمایش نیست");
assert.equal(
  operationalCopy.emptyDashboardScope,
  "در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.",
);
assert.equal(operationalCopy.dashboardLoadError, "بارگذاری داشبورد ممکن نشد.");
assert.notEqual(
  operationalCopy.dashboardLoadError,
  operationalCopy.accessDeniedTitle,
);
assert.notEqual(
  operationalCopy.suppressedCohort,
  operationalCopy.emptyDashboardScope,
);
assert.notEqual(operationalCopy.suppressedCohort, "0");
assert.notEqual(operationalCopy.emptyDashboardScope, operationalCopy.emptySearch);

/** Shared filter identity — valid monthly range. */
const parsed = dashboardFilterSchema.safeParse({
  evaluationMode: "current",
  trendRangeStart: "2026-01-01",
  trendRangeEnd: "2026-07-24",
  trendGranularity: "monthly",
});
assert.equal(parsed.success, true);
if (parsed.success) {
  assert.equal(parsed.data.trendGranularity, "monthly");
}

/** Inverted range rejected. */
const badRange = dashboardFilterSchema.safeParse({
  trendRangeStart: "2026-07-24",
  trendRangeEnd: "2026-01-01",
});
assert.equal(badRange.success, false);

/** Invalid asOf rejected. */
const badAsOf = dashboardFilterSchema.safeParse({
  evaluationMode: "as_of",
  asOfDate: "not-a-date",
  trendRangeStart: "2026-01-01",
  trendRangeEnd: "2026-07-24",
});
assert.equal(badAsOf.success, false);

/** as_of without asOfDate rejected. */
const missingAsOf = dashboardFilterSchema.safeParse({
  evaluationMode: "as_of",
  trendRangeStart: "2026-01-01",
  trendRangeEnd: "2026-07-24",
});
assert.equal(missingAsOf.success, false);

/** as_of with valid asOfDate accepted. */
const okAsOf = dashboardFilterSchema.safeParse({
  evaluationMode: "as_of",
  asOfDate: "2026-07-01",
  trendRangeStart: "2026-01-01",
  trendRangeEnd: "2026-07-24",
});
assert.equal(okAsOf.success, true);

console.log("web dashboard selfcheck: ok");
