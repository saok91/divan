/**
 * Reports IA / workspace selfcheck (Story 9.5 / UX-DR33).
 * Run: pnpm --filter @divan/web selfcheck:reports-ia
 *
 * Filesystem heuristics — no Playwright:
 * - SECTION_TAB_SURFACES registers /reports with 5 subject tabs
 * - Index redirects via assertPageAccess + defaultTabHref
 * - Workspace host (not flat catalogue page)
 * - FeedbackMessage first-touch (no StatusMessage clones)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(webRoot, rel), "utf8");
}

const surfaces = read("lib/section-tab-surfaces.ts");
assert.match(surfaces, /root:\s*["']\/reports["']/);
assert.match(surfaces, /surfaceLabel:\s*["']گزارش‌ها["']/);
assert.match(surfaces, /ariaLabel:\s*["']بخش‌های گزارش‌ها["']/);
assert.match(surfaces, /defaultTabId:\s*["']personnel["']/);
assert.match(surfaces, /href:\s*["']\/reports\/personnel["']/);
assert.match(surfaces, /href:\s*["']\/reports\/organization["']/);
assert.match(surfaces, /href:\s*["']\/reports\/events["']/);
assert.match(surfaces, /href:\s*["']\/reports\/capacity["']/);
assert.match(surfaces, /href:\s*["']\/reports\/data-entry["']/);
assert.match(surfaces, /label:\s*["']نیروی انسانی["']/);
assert.match(surfaces, /label:\s*["']سازمان["']/);
assert.match(surfaces, /label:\s*["']رویدادها["']/);
assert.match(surfaces, /label:\s*["']ظرفیت و جذب["']/);
assert.match(surfaces, /label:\s*["']ورود داده["']/);

const indexPage = read("app/(app)/reports/page.tsx");
assert.match(indexPage, /assertPageAccess/);
assert.match(indexPage, /defaultTabHref/);
assert.doesNotMatch(indexPage, /ReportCataloguePanel|ReportWorkspace/);

const layout = read("app/(app)/reports/(tabs)/layout.tsx");
assert.match(layout, /SurfaceSectionTabsLayout/);
assert.match(layout, /کاتالوگ گزارش‌های تأییدشده/);

for (const subject of [
  "personnel",
  "organization",
  "events",
  "capacity",
  "data-entry",
]) {
  const page = read(
    `app/(app)/reports/(tabs)/${subject}/[[...slug]]/page.tsx`,
  );
  assert.match(page, /ReportWorkspace/);
  assert.match(page, new RegExp(`subject=["']${subject}["']`));
}

const workspace = read("components/reports/report-workspace.tsx");
assert.match(workspace, /FeedbackMessage/);
assert.match(workspace, /ExportArtifactPanel/);
assert.match(workspace, /DecisionPublicationPanel/);
assert.match(workspace, /GovernedDataTable/);
assert.match(workspace, /submitLabel=["']اجرا["']/);
assert.match(workspace, /data-report-run-meta|تعداد ردیف/);
assert.match(workspace, /runIntent|run===true|run === true|urlFilters\.run/);
assert.match(
  workspace,
  /disabled=\{locked \|\| fetching\}|disabled=\{locked\|\|fetching\}/,
  "locked catalogue items must be disabled (not aria-disabled-only)",
);
assert.match(
  workspace,
  /runIntent && (?:runQuery\.error|statusMessage)/,
  "run status/error FeedbackMessage must be gated by runIntent",
);
assert.doesNotMatch(workspace, /function StatusMessage/);
assert.doesNotMatch(
  workspace,
  /<p[^>]*role=["']alert["']/,
  "workspace must use FeedbackMessage, not raw alert <p>",
);

const filters = read("components/reports/report-filters.tsx");
assert.match(filters, /EntityPicker/);
assert.match(filters, /FeedbackMessage/);
assert.match(filters, /submitLabel/);

const urlHelpers = read("lib/report-url.ts");
assert.match(urlHelpers, /buildReportPath/);
assert.match(urlHelpers, /parseReportSearchParams/);
assert.match(urlHelpers, /run/);
assert.match(urlHelpers, /reportsForSubject/);
assert.match(
  urlHelpers,
  /@divan\/reporting\/catalogue/,
  "report-url must import catalogue subpath (not barrel — avoids pg in client)",
);
assert.doesNotMatch(
  urlHelpers,
  /from ["']@divan\/reporting["']/,
  "report-url must not import @divan/reporting barrel",
);

console.log("reports-ia.selfcheck: ok");
