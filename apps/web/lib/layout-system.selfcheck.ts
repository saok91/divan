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

const panel = read("components/layout/panel-section.tsx");
assert.match(panel, /Full-bleed table/);
assert.match(panel, /max-w-4xl/);

const iconContract = read("components/icons/icon-contract.md");
assert.match(iconContract, /lucide-react/);
assert.match(iconContract, /12px/);

const gallery = read("app/(app)/dev/gallery/page.tsx");
assert.match(
  gallery,
  /NODE_ENV === ["']production["']/,
  "gallery must gate production with notFound/redirect",
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
