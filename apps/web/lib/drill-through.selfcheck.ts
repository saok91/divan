/**
 * Cross-surface drill-through structural selfcheck (Story 9.7).
 * Run: pnpm --filter @divan/web selfcheck:drill-through
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const repoRoot = path.resolve(webRoot, "../..");

function read(relFromWeb: string): string {
  return fs.readFileSync(path.join(webRoot, relFromWeb), "utf8");
}

function readRepo(relFromRepo: string): string {
  return fs.readFileSync(path.join(repoRoot, relFromRepo), "utf8");
}

const hrefHelper = read("lib/personnel-profile-href.ts");
assert.match(hrefHelper, /export function profileHref/);
assert.match(hrefHelper, /eventId/);

const list = read("components/personnel/personnel-list-panel.tsx");
assert.match(list, /navigateProfile/);
assert.match(list, /onRowClick=\{\(row\)\s*=>\s*navigateProfile/);
assert.match(list, /useSearchParams/);
assert.match(list, /teamId:\s*appliedTeamId/);
assert.match(list, /FeedbackMessage/);
assert.match(list, /EntityPicker/);
assert.match(list, /from "@\/lib\/is-uuid"/);
assert.doesNotMatch(
  list,
  /from "@divan\/person-employment"/,
  "list panel must not import person-employment (pg) into client",
);

const profilePage = read("app/(app)/personnel/profile/[personId]/page.tsx");
assert.match(profilePage, /getPersonByPersonnelCode/);
assert.match(profilePage, /redirect\(profileHref/);
assert.match(profilePage, /searchParams/);
assert.match(profilePage, /focusEventId/);

const profileView = read("components/personnel/person-profile-view.tsx");
assert.match(profileView, /profileCorrectionRequestCta/);
assert.match(profileView, /correction-cases\?person=/);
assert.match(profileView, /focusEventId/);
assert.match(profileView, /correctionCase\.capabilities/);

const timeline = read("components/personnel/personnel-event-timeline.tsx");
assert.match(timeline, /focusEventId/);
assert.match(timeline, /scrollIntoView/);
assert.match(timeline, /profileEventFocusMissing/);

const row = read("components/personnel/event-timeline-row.tsx");
assert.match(row, /id=\{`event-\$\{row\.event\.id\}`\}/);
assert.match(row, /highlighted/);
assert.match(row, /aria-current/);

const events = read("components/personnel/personnel-events-list-panel.tsx");
assert.match(events, /useSearchParams/);
assert.match(events, /effectiveFrom/);
assert.match(events, /from "@\/lib\/personnel-profile-href"/);
assert.match(events, /from "@\/lib\/is-uuid"/);
assert.doesNotMatch(
  events,
  /from "@divan\/person-employment"/,
  "events panel must not import person-employment (pg) into client",
);

const correction = read("components/correction-cases/correction-cases-panel.tsx");
assert.match(correction, /useSearchParams/);
assert.match(correction, /open=1|get\("open"\)/);
assert.match(correction, /profileCorrectionRequestDenied/);
assert.match(correction, /from "@\/lib\/is-uuid"/);
assert.doesNotMatch(
  correction,
  /from "@divan\/person-employment"/,
  "correction panel must not import person-employment (pg) into client",
);
const capacityPage = read("app/(app)/headcount/(tabs)/capacity/page.tsx");
assert.match(capacityPage, /initialTeamId/);
assert.match(capacityPage, /teamId/);

const capacityTable = read("components/headcount/headcount-approvals-table.tsx");
assert.match(capacityTable, /initialTeamId/);
assert.match(capacityTable, /listApprovals\.useQuery/);

const reconcile = readRepo(
  "packages/modules/reporting/src/reconcile-href.ts",
);
assert.match(reconcile, /eventsReconcileHref/);
assert.match(reconcile, /personnelListReconcileHref/);
assert.match(reconcile, /capacityReconcileHref/);

const dashboard = readRepo(
  "packages/modules/reporting/src/dashboard-snapshot.ts",
);
assert.match(dashboard, /eventsReconcileHref/);
assert.match(dashboard, /personnelListReconcileHref/);

const reportRun = readRepo("packages/modules/reporting/src/report-run.ts");
assert.match(reportRun, /startsHref|eventsReconcileHref/);
assert.match(reportRun, /listHref|personnelListReconcileHref/);

const copy = read("lib/operational-copy.ts");
assert.match(copy, /profileCorrectionRequestCta:\s*"ثبت درخواست اصلاح"/);

console.log("drill-through.selfcheck: ok");
