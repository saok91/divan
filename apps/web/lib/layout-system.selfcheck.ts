/**
 * Layout-system selfcheck (Story 8.2 / UX-DR38).
 * Run: pnpm --filter @divan/web selfcheck:layout-system
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(webRoot, rel), "utf8");
}

const globals = read("app/globals.css");

assert.match(
  globals,
  /--section-tabs-height:\s*30px/,
  "globals.css must set --section-tabs-height: 30px",
);
assert.match(
  globals,
  /--content-padding-inline:\s*16px/,
  "globals.css must set --content-padding-inline: 16px",
);
assert.match(
  globals,
  /--control-height-xs:\s*24px/,
  "globals.css must define --control-height-xs: 24px",
);
assert.match(
  globals,
  /--control-height-sm:\s*28px/,
  "globals.css must define --control-height-sm: 28px",
);
assert.match(
  globals,
  /--control-height:\s*32px/,
  "globals.css must define --control-height: 32px",
);
assert.match(
  globals,
  /--form-label-column:\s*168px/,
  "globals.css must define --form-label-column: 168px",
);
assert.match(
  globals,
  /--destructive-foreground/,
  "globals.css must define --destructive-foreground",
);

const typographyRoles = [
  ".text-heading",
  ".text-heading-sm",
  ".text-body-medium",
  ".text-caption",
  ".text-column-header",
  ".text-field-label",
  ".text-tabular",
  ".text-identifier",
] as const;

for (const role of typographyRoles) {
  assert.ok(
    globals.includes(role),
    `globals.css must define typography utility ${role}`,
  );
}

const sectionTabs = read("components/section-tabs.tsx");
assert.match(
  sectionTabs,
  /border-chrome/,
  "section-tabs active border must use chrome (navy), not primary",
);
assert.doesNotMatch(
  sectionTabs,
  /selected[\s\S]{0,120}border-primary/,
  "section-tabs must not use border-primary for selected tab",
);
assert.match(
  sectionTabs,
  /text-body-medium/,
  "section-tabs labels must use text-body-medium",
);

const pageHeader = read("components/page-header.tsx");
assert.match(
  pageHeader,
  /export function PageHeader/,
  "PageHeader module must export PageHeader",
);
assert.doesNotMatch(
  pageHeader,
  /variant=["']primary["']|Button/,
  "PageHeader must not host a primary Button CTA slot",
);

const surfaceLayout = read("components/surface-section-tabs-layout.tsx");
assert.match(
  surfaceLayout,
  /PageHeader/,
  "SurfaceSectionTabsLayout must compose PageHeader",
);
assert.match(
  surfaceLayout,
  /flex min-h-0 flex-1 flex-col bg-surface-page/,
  "SurfaceSectionTabsLayout root must flex-fill main so form hosts can fill remaining height",
);
assert.match(
  surfaceLayout,
  /flex min-h-0 min-w-0 flex-1 flex-col/,
  "tabpanel must be a flex column that grows so FormSurfaceHost can flex-1",
);

const button = read("components/ui/button.tsx");
assert.match(
  button,
  /text-destructive-foreground/,
  "destructive Button must use text-destructive-foreground",
);
assert.match(
  button,
  /h-control-height/,
  "Button default size must use h-control-height token",
);

const formLayout = read("components/form-layout/index.tsx");
assert.match(formLayout, /export function FormLayout/);
assert.match(formLayout, /export function FormFooter/);
assert.match(formLayout, /export function FormField/);
assert.match(
  formLayout,
  /FieldHelpIcon/,
  "FormField must use FieldHelpIcon for compact label-adjacent help",
);
assert.doesNotMatch(
  formLayout,
  /help \? \(\s*<p id=\{helpId\} className="text-caption text-text-tertiary">/,
  "FormField must not render always-visible under-control help paragraph",
);
assert.match(
  formLayout,
  /border-t border-hairline-strong bg-surface/,
  "FormFooter must use content surface + strong hairline (mockup .fbar), not surface-subtle band",
);
assert.doesNotMatch(
  formLayout,
  /FormFooter[\s\S]*?bg-surface-subtle/,
  "FormFooter default chrome must not use bg-surface-subtle",
);

const fieldHelp = read("components/form-layout/field-help.tsx");
assert.match(fieldHelp, /export function FieldHelpIcon/);
assert.match(fieldHelp, /\bInfo\b/);
assert.match(fieldHelp, /variant=["']ghost["']/);
assert.match(fieldHelp, /aria-label/);
assert.match(
  fieldHelp,
  /FILTER_FIELD_LABEL_CLASS/,
  "field-help must export fixed-height filter label class for baseline alignment",
);
  assert.match(
  fieldHelp,
  /h-5 min-h-5/,
  "filter label row must use fixed h-5 so controls share one baseline",
);
assert.match(
  fieldHelp,
  /<div className=\{cn\(FILTER_FIELD_LABEL_CLASS[\s\S]*?<label htmlFor=\{htmlFor\}[\s\S]*?<FieldHelpIcon/,
  "LabelWithHelp must keep FieldHelpIcon as sibling outside <label>",
);

const panel = read("components/layout/panel-section.tsx");
assert.match(panel, /Full-bleed table/);
assert.match(panel, /max-w-4xl/);
assert.match(
  panel,
  /export function FormSurfaceHost/,
  "panel-section must export FormSurfaceHost for form tab content plane",
);
assert.match(
  panel,
  /data-slot="form-surface-host"/,
  "FormSurfaceHost must expose data-slot for contract asserts",
);
assert.match(
  panel,
  /min-h-0 min-w-0 flex-1 bg-surface/,
  "FormSurfaceHost must fill remaining tab height with content surface (mockup .main)",
);
assert.match(
  panel,
  /FormSurfaceHost/,
  "panel docs must document FormSurfaceHost for form tabs",
);
assert.match(
  panel,
  /do \*\*not\*\* nest Panel fill|do not nest Panel fill/i,
  "panel docs must forbid nested Panel fill around form body",
);

const peForm = read("components/personnel/personnel-event-form.tsx");
assert.match(peForm, /FormLayout/);
assert.match(peForm, /FormFooter/);
assert.doesNotMatch(
  peForm,
  /import \{ Panel \} from ["']@\/components\/layout\/panel-section["']/,
  "PE form must not import Panel — form sits on FormSurfaceHost, not nested Panel fill",
);
assert.doesNotMatch(
  peForm,
  /<Panel[\s>]/,
  "PE form must not nest <Panel> around the form body",
);

const peRegister = read(
  "app/(app)/personnel-events/(tabs)/register/page.tsx",
);
assert.match(
  peRegister,
  /FormSurfaceHost/,
  "PE register tab must host form on FormSurfaceHost content plane",
);

const hcCreate = read("app/(app)/headcount/(tabs)/create/page.tsx");
assert.match(
  hcCreate,
  /FormSurfaceHost/,
  "headcount create tab must host form on FormSurfaceHost content plane",
);

const iconContract = read("components/icons/icon-contract.md");
assert.match(iconContract, /lucide-react/);
assert.match(iconContract, /12px/);
assert.match(
  iconContract,
  /FieldHelpIcon|field help|label info/i,
  "icon-contract must document field-help Info icon",
);

const gallery = read("app/(app)/dev/gallery/page.tsx");
assert.match(
  gallery,
  /NODE_ENV === ["']production["']/,
  "gallery must gate production with notFound/redirect",
);
assert.match(
  gallery,
  /FormSurfaceHost/,
  "gallery Form layout demo must show FormSurfaceHost aligned surface",
);

const dashboardFilters = read("components/dashboard/dashboard-filters.tsx");
assert.match(
  dashboardFilters,
  /LabelWithHelp|FieldHelpIcon/,
  "dashboard filters must use shared label-adjacent help",
);
assert.doesNotMatch(
  dashboardFilters,
  /dashboardTeamFilterHint[\s\S]{0,80}<\/p>/,
  "dashboard team hint must not sit in under-control <p>",
);
assert.match(
  dashboardFilters,
  /helperText=["']["']/,
  "dashboard as-of/range pickers must suppress under-control helperText where compact",
);

const reportFilters = read("components/reports/report-filters.tsx");
assert.match(
  reportFilters,
  /LabelWithHelp|FieldHelpIcon/,
  "report filters must use shared label-adjacent help",
);
assert.doesNotMatch(
  reportFilters,
  /reportTeamFilterHint[\s\S]{0,80}<\/p>/,
  "report team hint must not sit in under-control <p>",
);

const eventsListFilters = read(
  "components/personnel/personnel-events-list-panel.tsx",
);
assert.match(
  eventsListFilters,
  /FieldHelpIcon|LabelWithHelp/,
  "personnel-events list filters must use shared label-adjacent help",
);
assert.doesNotMatch(
  eventsListFilters,
  /عضویت اصلی فرد[\s\S]{0,80}<\/p>/,
  "personnel-events team hint must not sit in under-control <p>",
);

// اطلاعات پرسنلی foreshadow keeps under-control helper (explicit exclusion)
const personnelInfoForeshadow = read(
  "components/personnel/current-person-state-foreshadow.tsx",
);
assert.match(
  personnelInfoForeshadow,
  /helperText=["']خالی = امروز/,
  "personnel info foreshadow may keep under-control Jalali helperText",
);

const touched = [
  "components/personnel/personnel-event-form.tsx",
  "app/(app)/import/page.tsx",
  "components/surface-section-tabs-layout.tsx",
  "components/page-header.tsx",
  "app/(app)/dev/gallery/page.tsx",
] as const;

for (const rel of touched) {
  const src = read(rel);
  assert.doesNotMatch(
    src,
    /\btext-title(?:-medium|-small|-sm)?\b/,
    `${rel} must not use legacy text-title* classes`,
  );
  assert.doesNotMatch(
    src,
    /\btext-heading-md\b/,
    `${rel} must not use text-heading-md`,
  );
}

console.log("layout-system selfcheck: ok");
