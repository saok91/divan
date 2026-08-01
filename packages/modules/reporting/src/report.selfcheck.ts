/**
 * Report catalogue selfcheck (Story 5.5).
 * Run: pnpm --filter @divan/reporting selfcheck:report
 *
 * Covers: catalogue completeness; suppress≠empty≠zero≠unavailable;
 * Effective helpers unchanged; status-filter helpers; Import Batch stub honesty;
 * range/team helpers; assembleReportRun as-of overrides fail-closed (no DB).
 * No DB required.
 */
import assert from "node:assert/strict";

import {
  LAUNCH_REQUIRED_REPORT_KEYS,
  MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA,
  isLaunchReportKey,
  reportRequiresEffectiveDateRange,
  reportUsesTeamPopulationIntersect,
  requireLaunchReportCatalogue,
} from "./report-catalogue";
import { assembleReportRun } from "./report-run";
import {
  aggregateEventsByTypeAndStatus,
  aggregateStartsTerminations,
  filterEventsByStatus,
} from "./workforce-events";

/** Suppress ≠ empty ≠ zero ≠ unavailable oracle. */
const SUPPRESSED_FA = "داده قابل نمایش نیست";
const EMPTY_REPORT_FA =
  "در محدوده دسترسی شما داده‌ای برای این فیلتر نیست.";
const EMPTY_SEARCH_FA =
  "نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.";

assert.notEqual(SUPPRESSED_FA, EMPTY_REPORT_FA);
assert.notEqual(SUPPRESSED_FA, "0");
assert.notEqual(EMPTY_REPORT_FA, "0");
assert.notEqual(EMPTY_REPORT_FA, EMPTY_SEARCH_FA);
assert.notEqual(SUPPRESSED_FA, EMPTY_SEARCH_FA);
assert.notEqual(MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA, EMPTY_REPORT_FA);
assert.notEqual(MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA, SUPPRESSED_FA);
assert.ok(
  MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA.includes("Epic"),
  "Import Batch stub must mention Epic 6 activation",
);
assert.ok(
  !MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA.includes("۰ خطا") &&
    !/all green|success/i.test(MSG_REPORT_IMPORT_BATCH_UNAVAILABLE_FA),
  "Import Batch stub must not claim zero-error success",
);

/** Catalogue completeness — every FR-36 launch key present. */
const catalogue = requireLaunchReportCatalogue();
assert.equal(catalogue.length, LAUNCH_REQUIRED_REPORT_KEYS.length);
for (const key of LAUNCH_REQUIRED_REPORT_KEYS) {
  assert.equal(isLaunchReportKey(key), true);
  const def = catalogue.find((d) => d.key === key);
  assert.ok(def, `missing definition for ${key}`);
  assert.ok(def.subject, `missing subject for ${key}`);
  assert.ok(def.purposeFa.trim().length > 0, `missing purposeFa for ${key}`);
}
assert.ok(
  LAUNCH_REQUIRED_REPORT_KEYS.includes("import_batch_outcomes"),
  "Import Batch slot must remain in launch keys",
);
assert.equal(isLaunchReportKey("invented_cohort_30_60_90"), false);

assert.equal(reportRequiresEffectiveDateRange("starts"), true);
assert.equal(reportRequiresEffectiveDateRange("active_persons"), false);
assert.equal(reportUsesTeamPopulationIntersect("distributions"), true);
assert.equal(reportUsesTeamPopulationIntersect("org_state"), false);

/** Effective-only starts: Scheduled/Draft must NOT count. */
const events = [
  {
    eventType: "EmploymentStarted",
    effectiveDate: "2026-01-15",
    status: "Effective",
  },
  {
    eventType: "EmploymentStarted",
    effectiveDate: "2026-01-18",
    status: "Scheduled",
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
    effectiveDate: "2026-01-22",
    status: "Cancelled",
  },
  {
    eventType: "TransferRecorded",
    effectiveDate: "2026-01-28",
    status: "Reversed",
  },
];

const st = aggregateStartsTerminations(events, "2026-01-01", "2026-01-31");
assert.equal(st.starts, 1, "Scheduled/Draft/Cancelled must not inflate starts");
assert.equal(st.terminations, 1);

/** Status filters: Scheduled and Cancelled/Reversed are first-class. */
const scheduled = filterEventsByStatus(
  events,
  ["Scheduled"],
  "2026-01-01",
  "2026-01-31",
);
assert.equal(scheduled.length, 1);
assert.equal(scheduled[0]?.status, "Scheduled");

const cancelledReversed = filterEventsByStatus(
  events,
  ["Cancelled", "Reversed"],
  "2026-01-01",
  "2026-01-31",
);
assert.equal(cancelledReversed.length, 2);

const byTypeStatus = aggregateEventsByTypeAndStatus(
  events,
  ["Scheduled", "Cancelled", "Reversed"],
  "2026-01-01",
  "2026-01-31",
);
assert.ok(byTypeStatus.some((r) => r.status === "Scheduled" && r.count === 1));
assert.ok(byTypeStatus.some((r) => r.status === "Cancelled" && r.count === 1));
assert.ok(byTypeStatus.some((r) => r.status === "Reversed" && r.count === 1));

/** Effective starts must still exclude Scheduled after status helpers exist. */
assert.equal(
  aggregateStartsTerminations(scheduled, "2026-01-01", "2026-01-31").starts,
  0,
);

/** as-of overrides fail closed (injected overrides — branch before DB). */
const fakePool = {} as import("@divan/db").Pool;
const overridesAsOf = await assembleReportRun({
  reportKey: "overrides",
  subjectIds: ["00000000-0000-4000-8000-000000000001"],
  retrievalOutcome: "allowed",
  emptyMessageFa: EMPTY_REPORT_FA,
  filter: {
    asOf: "2026-01-15",
    evaluationMode: "as_of",
  },
  caps: {
    hasOrganizationRead: true,
    hasHeadcountApprovalRead: true,
    hasCompensationRead: true,
  },
  eventDb: fakePool,
  overrides: [],
});
assert.equal(overridesAsOf.outcome, "unavailable");
assert.ok(
  (overridesAsOf.messageFa ?? "").includes("as-of") ||
    (overridesAsOf.messageFa ?? "").includes("مبنا"),
);

/** Event key without range → error. */
const startsNoRange = await assembleReportRun({
  reportKey: "starts",
  subjectIds: ["00000000-0000-4000-8000-000000000001"],
  retrievalOutcome: "allowed",
  emptyMessageFa: EMPTY_REPORT_FA,
  filter: {
    asOf: "2026-01-15",
    evaluationMode: "current",
  },
  caps: {
    hasOrganizationRead: true,
    hasHeadcountApprovalRead: true,
    hasCompensationRead: true,
  },
  eventDb: fakePool,
});
assert.equal(startsNoRange.outcome, "error");

/** Overrides at list limit → truncation error. */
const manyOverrides = Array.from({ length: 500 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  teamId: "00000000-0000-4000-8000-000000000099",
  violatedRule: "capacity",
  status: "active" as const,
  reason: "t",
}));
const overridesTrunc = await assembleReportRun({
  reportKey: "overrides",
  subjectIds: ["00000000-0000-4000-8000-000000000001"],
  retrievalOutcome: "allowed",
  emptyMessageFa: EMPTY_REPORT_FA,
  filter: {
    asOf: "2026-01-15",
    evaluationMode: "current",
  },
  caps: {
    hasOrganizationRead: true,
    hasHeadcountApprovalRead: true,
    hasCompensationRead: true,
  },
  eventDb: fakePool,
  overrides: manyOverrides as never,
});
assert.equal(overridesTrunc.outcome, "error");

console.log("reporting report selfcheck: ok");
