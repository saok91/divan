/**
 * No-dead-end IA gate (Story 9.9 / FR59 / UX-DR3).
 * Run: pnpm --filter @divan/web selfcheck:no-dead-end-ia
 *
 * Filesystem/AST heuristics — no Playwright / Vitest:
 * - Every NAV_CATALOG + SECTION_TAB_SURFACES href resolves to a functional page
 * - Placeholder component/string banned on gated pages
 * - Host = defaultTabHref redirect or non-chrome @/components import
 * - Layout filters via getNavItemsForRole; sidebar maps navItems only
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COARSE_ROLES,
  NAV_CATALOG,
  getNavItemsForRole,
  type CoarseRole,
} from "@divan/identity-access";

import { SECTION_TAB_SURFACES } from "./section-tab-surfaces";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "../..");
const appRoot = path.join(webRoot, "app", "(app)");

const PLACEHOLDER_BANNED =
  /SectionTabPlaceholder|section-tab-placeholder|SECTION_TAB_PLACEHOLDER|محتوای این بخش در استوری بعدی تکمیل می‌شود/;

/**
 * Chrome / shell imports that must not alone satisfy the host signal
 * (PageHeader, SectionTabs, ui/*, layout shells, gallery helpers).
 */
const CHROME_COMPONENT_PREFIXES = [
  "@/components/ui/",
  "@/components/layout/",
  "@/components/glossary/",
] as const;
const CHROME_COMPONENT_EXACT = new Set([
  "@/components/page-header",
  "@/components/section-tabs",
  "@/components/form-layout",
  "@/components/platform-status-provider",
  "@/components/stale-recalc-banner",
  "@/components/access-denied",
]);

const SUBCHECK_TIMEOUT_MS = 120_000;

/** Strip // and /* *\/ comments so host/placeholder scans ignore commented scaffolding. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function isChromeComponent(mod: string): boolean {
  if (CHROME_COMPONENT_EXACT.has(mod)) return true;
  return CHROME_COMPONENT_PREFIXES.some((p) => mod.startsWith(p));
}

/** Redirect roots (defaultTabHref) or a non-chrome @/components host. */
function hasHostSignal(source: string): boolean {
  const code = stripComments(source);
  if (/defaultTabHref/.test(code)) return true;
  const importRe = /from\s+["'](@\/components\/[^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(code)) !== null) {
    const mod = match[1] ?? "";
    if (mod && !isChromeComponent(mod)) return true;
  }
  return false;
}

function fail(message: string): never {
  console.error(`no-dead-end-ia.selfcheck FAILED: ${message}`);
  process.exit(1);
}

function readWeb(relFromWeb: string): string {
  const abs = path.join(webRoot, relFromWeb);
  assert.ok(fs.existsSync(abs), `missing file: ${relFromWeb}`);
  return fs.readFileSync(abs, "utf8");
}

function containedUnder(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  return (
    resolved === resolvedRoot ||
    resolved.startsWith(resolvedRoot + path.sep)
  );
}

/** Walk page.tsx files and map URL pathname → absolute page path. */
function buildHrefToPageMap(): Map<string, string> {
  const map = new Map<string, string>();

  function walk(dir: string): void {
    assert.ok(containedUnder(appRoot, dir), `path escaped app root: ${dir}`);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (entry.name !== "page.tsx") continue;

      const rel = path.relative(appRoot, abs).split(path.sep).join("/");
      const segments = rel
        .split("/")
        .filter((seg) => {
          if (seg === "page.tsx") return false;
          // Drop route groups: (tabs), (app) already outside
          if (seg.startsWith("(") && seg.endsWith(")")) return false;
          // Drop dynamic / optional catch-all for base href
          if (seg.startsWith("[") && seg.endsWith("]")) return false;
          return true;
        });
      const href = segments.length === 0 ? "/" : `/${segments.join("/")}`;
      // Prefer the first mapping; catch-all pages share the tab href.
      if (!map.has(href)) map.set(href, abs);
    }
  }

  walk(appRoot);
  return map;
}

function assertFunctionalPage(
  href: string,
  pageAbs: string,
  hrefToPage: Map<string, string>,
): void {
  assert.ok(
    containedUnder(appRoot, pageAbs),
    `${href}: page path outside app/(app)`,
  );
  const source = fs.readFileSync(pageAbs, "utf8");
  const code = stripComments(source);

  assert.doesNotMatch(
    code,
    PLACEHOLDER_BANNED,
    `${href}: page must not use SectionTabPlaceholder / placeholder copy`,
  );

  assert.ok(
    hasHostSignal(source),
    `${href}: page must redirect via defaultTabHref or host a non-chrome @/components module`,
  );

  // Surface roots that only redirect: default tab must also be functional.
  if (/defaultTabHref/.test(code) && /redirect\s*\(/.test(code)) {
    assert.match(
      code,
      /redirect\s*\(\s*defaultTabHref\s*\(/,
      `${href}: redirect root must call redirect(defaultTabHref(...))`,
    );
    const surface = SECTION_TAB_SURFACES.find((s) => s.root === href);
    assert.ok(
      surface,
      `${href}: redirect root must match a SECTION_TAB_SURFACES root`,
    );
    const defaultTab = surface.tabs.find((t) => t.id === surface.defaultTabId);
    assert.ok(defaultTab, `${href}: missing default tab ${surface.defaultTabId}`);
    const defaultPage = hrefToPage.get(defaultTab.href);
    assert.ok(
      defaultPage,
      `${href}: default tab ${defaultTab.href} has no page.tsx`,
    );
    const defaultSource = fs.readFileSync(defaultPage, "utf8");
    const defaultCode = stripComments(defaultSource);
    assert.doesNotMatch(
      defaultCode,
      PLACEHOLDER_BANNED,
      `${href}: default tab ${defaultTab.href} must not be placeholder`,
    );
    assert.ok(
      hasHostSignal(defaultSource),
      `${href}: default tab ${defaultTab.href} must host real content`,
    );
  }
}

function runWebScript(script: string): void {
  const result = spawnSync(`pnpm --filter @divan/web run ${script}`, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
    env: process.env,
    timeout: SUBCHECK_TIMEOUT_MS,
  });
  if (result.error) {
    fail(`subcheck "${script}" failed to spawn/complete: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(
      `subcheck "${script}" exited ${result.status}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
}

try {
  const hrefToPage = buildHrefToPageMap();

  // --- Catalog inventory + ≥1 role ---
  assert.equal(NAV_CATALOG.length, 11, "NAV_CATALOG length must stay 11");
  assert.ok(
    !NAV_CATALOG.some((item) => item.href === "/settings" || item.label === "تنظیمات"),
    "Settings («تنظیمات») must stay out of NAV_CATALOG (Epic 10)",
  );

  for (const item of NAV_CATALOG) {
    const rolesWithItem = COARSE_ROLES.filter((role: CoarseRole) =>
      getNavItemsForRole(role).some((nav) => nav.href === item.href),
    );
    assert.ok(
      rolesWithItem.length >= 1,
      `catalog href ${item.href} must appear in ≥1 ROLE_NAV_HREFS role`,
    );

    const pageAbs = hrefToPage.get(item.href);
    assert.ok(pageAbs, `catalog href ${item.href} has no page.tsx under app/(app)`);
    assertFunctionalPage(item.href, pageAbs, hrefToPage);
  }

  // --- Section tabs ---
  const tabHrefs: string[] = [];
  for (const surface of SECTION_TAB_SURFACES) {
    for (const tab of surface.tabs) {
      tabHrefs.push(tab.href);
      const pageAbs = hrefToPage.get(tab.href);
      assert.ok(
        pageAbs,
        `section tab ${tab.href} has no page.tsx under app/(app)`,
      );
      assertFunctionalPage(tab.href, pageAbs, hrefToPage);
    }
  }
  assert.ok(tabHrefs.length > 0, "SECTION_TAB_SURFACES must expose tabs");

  // --- UX-DR3 wiring ---
  const layout = readWeb("app/(app)/layout.tsx");
  assert.match(
    layout,
    /getNavItemsForRole\s*\(\s*coarseRole\s*\)/,
    "layout must build navItems via getNavItemsForRole",
  );
  assert.match(
    layout,
    /navItems=\{navItems\}/,
    "layout must pass filtered navItems to shell",
  );
  assert.doesNotMatch(
    layout,
    /NAV_CATALOG/,
    "layout must not render unfiltered NAV_CATALOG",
  );

  const sidebar = readWeb("components/app-sidebar.tsx");
  assert.match(
    sidebar,
    /navItems\.map\s*\(/,
    "AppSidebar must map the navItems prop only",
  );
  assert.doesNotMatch(
    sidebar,
    /NAV_CATALOG/,
    "AppSidebar must not import/render NAV_CATALOG",
  );
  assert.doesNotMatch(
    sidebar,
    /disabled\s*=|aria-disabled\s*=/,
    "AppSidebar must not render disabled / aria-disabled stub nav entries",
  );

  // Placeholder module must not remain as a navigable footgun (deleted or unused).
  const placeholderComponent = path.join(
    webRoot,
    "components",
    "section-tab-placeholder.tsx",
  );
  assert.ok(
    !fs.existsSync(placeholderComponent),
    "section-tab-placeholder.tsx must be deleted (quarantine)",
  );
  const surfacesSource = readWeb("lib/section-tab-surfaces.ts");
  assert.doesNotMatch(
    surfacesSource,
    /SECTION_TAB_PLACEHOLDER/,
    "SECTION_TAB_PLACEHOLDER export must be retired",
  );

  // Compose focused IA gates to avoid assert drift.
  console.log("no-dead-end-ia: running selfcheck:headcount-ia…");
  runWebScript("selfcheck:headcount-ia");
  console.log("no-dead-end-ia: running selfcheck:reports-ia…");
  runWebScript("selfcheck:reports-ia");

  console.log(
    `no-dead-end-ia.selfcheck: ok (${NAV_CATALOG.length} catalog + ${tabHrefs.length} tabs)`,
  );
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  fail(message);
}
