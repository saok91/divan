/**
 * Headcount IA restructure selfcheck (Story 9.4 / UX-DR34).
 * Run: pnpm --filter @divan/web selfcheck:headcount-ia
 *
 * Filesystem heuristics — no Playwright:
 * - Capacity hosts one approvals table (no stacked exemption/override/historical)
 * - Create tab hosts FormLayout form (not SectionTabPlaceholder)
 * - Record-drawer Sheet: side=right, --drawer-width, focus return
 * - First-touch FeedbackMessage (no StatusMessage clones in rewritten modules)
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

const capacityPage = read("app/(app)/headcount/(tabs)/capacity/page.tsx");
assert.match(
  capacityPage,
  /HeadcountApprovalsTable|headcount-approvals-table/,
  "capacity page must host approvals GovernedDataTable",
);
assert.doesNotMatch(
  capacityPage,
  /HeadcountExemptionPanel|HeadcountOverridePanel|HistoricalOrgHeadcountForeshadow/,
  "capacity page must not stack exemption/override/historical panels",
);

const createPage = read("app/(app)/headcount/(tabs)/create/page.tsx");
assert.doesNotMatch(
  createPage,
  /SectionTabPlaceholder/,
  "create tab must not use SectionTabPlaceholder",
);
assert.match(
  createPage,
  /FormSurfaceHost/,
  "create tab must wrap form in FormSurfaceHost (Story 11.5 content plane)",
);
assert.match(
  createPage,
  /HeadcountApprovalCreateForm|headcount-approval-create-form/,
  "create tab must host approval create form",
);

const createForm = read("components/headcount/headcount-approval-create-form.tsx");
assert.match(createForm, /FormLayout/, "create form must use FormLayout");
assert.match(createForm, /FormField/, "create form must use FormField");
assert.match(createForm, /FormFooter/, "create form must use FormFooter");
assert.match(createForm, /EntityPicker/, "create form must use EntityPicker");
assert.match(createForm, /FeedbackMessage/, "create form must use FeedbackMessage");
assert.match(
  createForm,
  /activateApproval/,
  "create form must wire activateApproval after create (Story 11.6)",
);
assert.match(
  createForm,
  /ثبت و فعال‌سازی/,
  "create form must expose ثبت و فعال‌سازی CTA",
);
assert.match(
  createForm,
  /ثبت پیش‌نویس/,
  "create form must expose ثبت پیش‌نویس CTA",
);
assert.doesNotMatch(
  createForm,
  /فعال‌سازی از فهرست هدکانت انجام می‌شود/,
  "create form must not mandate activation-only-from-list (Story 11.6)",
);
assert.match(
  createForm,
  /تلاش مجدد فعال‌سازی/,
  "create form must offer activate retry after partial failure (Story 11.6)",
);
assert.doesNotMatch(
  createForm,
  /function StatusMessage/,
  "create form must not clone StatusMessage",
);
assert.doesNotMatch(
  createForm,
  /<select[\s\S]*teamId|<select[\s\S]*jobTitleId/,
  "create form must not use UUID <select> for team/title",
);

const table = read("components/headcount/headcount-approvals-table.tsx");
assert.match(table, /GovernedDataTable/, "approvals table must use GovernedDataTable");
assert.match(table, /RowActionCluster/, "approvals table must use RowActionCluster");
assert.match(table, /FeedbackMessage/, "approvals table must use FeedbackMessage");
assert.match(
  table,
  /\/headcount\/create/,
  "toolbar create must navigate to /headcount/create",
);
assert.doesNotMatch(
  table,
  /function StatusMessage/,
  "approvals table must not clone StatusMessage",
);

const drawer = read("components/headcount/headcount-approval-record-drawer.tsx");
assert.match(drawer, /side=["']right["']/, "record-drawer must use side=right");
assert.match(
  drawer,
  /drawer-width|--drawer-width|w-\[var\(--drawer-width\)\]/,
  "record-drawer must force --drawer-width (480px)",
);
assert.match(
  drawer,
  /onCloseAutoFocus/,
  "record-drawer must restore focus via onCloseAutoFocus",
);
assert.match(drawer, /معافیت|exemption/i, "drawer must include exemptions section");
assert.match(drawer, /بازنویسی|override/i, "drawer must include overrides section");
assert.match(
  drawer,
  /تاریخی|HistoricalOrgHeadcountForeshadow/,
  "drawer must include historical reconstruction",
);
assert.match(
  drawer,
  /مصرف‌شده/,
  "drawer chrome must surface مصرف‌شده (Story 11.6)",
);
assert.match(
  drawer,
  /رزرو/,
  "drawer chrome must surface رزرو (Story 11.6)",
);
assert.match(
  drawer,
  /GlossaryTerm/,
  "drawer must use GlossaryTerm for quantity/lifecycle tips (Story 11.6)",
);
assert.match(drawer, /FeedbackMessage/, "drawer must use FeedbackMessage");
assert.doesNotMatch(
  drawer,
  /function StatusMessage/,
  "drawer must not clone StatusMessage",
);

const bulkPage = read("app/(app)/headcount/(tabs)/bulk-import/page.tsx");
assert.match(
  bulkPage,
  /BulkImportCatalogueHost|bulk-import/,
  "bulk-import tab must remain 9.3 host",
);

console.log("headcount-ia.selfcheck: ok");
