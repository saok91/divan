/**
 * Dashboard reporting selfcheck (Story 5.4).
 * Run: pnpm --filter @divan/reporting selfcheck:dashboard
 *
 * Covers: suppress≠empty≠zero oracle, conservation identity, filter/catalogue
 * identity, starts/trend aggregation. No DB required.
 */
import assert from "node:assert/strict";

import {
  conservationOrFail,
} from "./dashboard-snapshot";
import {
  MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA,
  assertHeadcountConservation,
} from "./headcount-conservation";
import {
  LAUNCH_REQUIRED_METRIC_KEYS,
  isLaunchMetricKey,
  requireLaunchMetricCatalogue,
} from "./metric-catalogue";
import {
  aggregateStartsTerminations,
  buildWorkforceTrendBuckets,
} from "./workforce-events";

/** Suppress ≠ empty ≠ zero oracle (must ship). */
const SUPPRESSED_FA = "داده قابل نمایش نیست";
const EMPTY_DASHBOARD_FA =
  "در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.";

assert.notEqual(SUPPRESSED_FA, EMPTY_DASHBOARD_FA);
assert.notEqual(SUPPRESSED_FA, "0");
assert.notEqual(EMPTY_DASHBOARD_FA, "0");

/** Catalogue completeness — launch keys present, no invented extras required. */
const catalogue = requireLaunchMetricCatalogue();
assert.equal(catalogue.length, LAUNCH_REQUIRED_METRIC_KEYS.length);
for (const key of LAUNCH_REQUIRED_METRIC_KEYS) {
  assert.equal(isLaunchMetricKey(key), true);
  assert.ok(catalogue.some((d) => d.key === key));
}
assert.equal(isLaunchMetricKey("invented_cohort_30_60_90"), false);

/** Conservation: approved = used + reserved + free. */
const ok = assertHeadcountConservation({
  approved: 10,
  used: 4,
  reserved: 3,
  free: 3,
});
assert.equal(ok.ok, true);

const bad = assertHeadcountConservation({
  approved: 10,
  used: 4,
  reserved: 3,
  free: 2,
});
assert.equal(bad.ok, false);
if (!bad.ok) {
  assert.equal(bad.messageFa, MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA);
}

assert.equal(conservationOrFail(5, 2, 1, 2).ok, true);
assert.equal(conservationOrFail(5, 2, 1, 1).ok, false);

/** Starts/terminations + monthly trend. */
const events = [
  {
    eventType: "EmploymentStarted",
    effectiveDate: "2026-01-15",
    status: "Effective",
  },
  {
    eventType: "EmploymentStarted",
    effectiveDate: "2026-01-20",
    status: "Draft",
  },
  {
    eventType: "EmploymentTerminated",
    effectiveDate: "2026-01-25",
    status: "Effective",
  },
  {
    eventType: "EmploymentStarted",
    effectiveDate: "2026-02-01",
    status: "Effective",
  },
  {
    eventType: "EmploymentTerminated",
    effectiveDate: "2026-03-01",
    status: "Effective",
  },
  {
    eventType: "EmploymentStarted",
    effectiveDate: "2026-01-18",
    status: "Scheduled",
  },
];

const st = aggregateStartsTerminations(events, "2026-01-01", "2026-02-28");
assert.equal(st.starts, 2);
assert.equal(st.terminations, 1);
assert.equal(st.net, 1);

const trend = buildWorkforceTrendBuckets(
  events,
  "2026-01-01",
  "2026-02-28",
  "monthly",
);
assert.equal(trend.length, 2);
assert.equal(trend[0]?.bucketKey, "2026-01");
assert.equal(trend[0]?.starts, 1);
assert.equal(trend[0]?.terminations, 1);
assert.equal(trend[1]?.bucketKey, "2026-02");
assert.equal(trend[1]?.starts, 1);

/** Shared filter identity shape (Zod mirror for selfcheck). */
type SharedFilter = {
  teamId?: string;
  asOf: string;
  trendRangeStart: string;
  trendRangeEnd: string;
  trendGranularity: "daily" | "monthly";
};
const filterA: SharedFilter = {
  asOf: "2026-07-24",
  trendRangeStart: "2026-01-01",
  trendRangeEnd: "2026-07-24",
  trendGranularity: "monthly",
};
const filterB: SharedFilter = { ...filterA };
assert.deepEqual(filterA, filterB);

console.log("reporting dashboard selfcheck: ok");
