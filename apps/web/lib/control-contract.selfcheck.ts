/**
 * Control-contract selfcheck (Story 8.1 / UX-DR30 / FR-58).
 * Run: pnpm --filter @divan/web selfcheck:control-contract
 *
 * Classifies `ghost` by usage context (not file path alone):
 * - Fail when ghost appears inside rowActions / pagination chrome / surface toolbars
 * - Allow dialog/sheet cancel·dismiss, sensitive-confirmation cancel, jalali month chrome
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

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsx(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".selfcheck.ts")) {
      out.push(full);
    }
  }
  return out;
}

// --- Variant union on Button ---
const buttonSrc = read("components/ui/button.tsx");
const requiredVariants = [
  "primary",
  "secondary",
  "tertiary",
  "rowAction",
  "destructive",
  "ghost",
  "link",
  "outline",
] as const;

for (const v of requiredVariants) {
  assert.match(
    buttonSrc,
    new RegExp(`${v}:\\s*\\n?\\s*["']`),
    `buttonVariants must export variant "${v}"`,
  );
}

assert.match(
  buttonSrc,
  /UX-DR30|FR-58/,
  "button.tsx must document UX-DR30 / FR-58 control contract",
);
assert.match(
  buttonSrc,
  /disabledReason\??:/,
  "Button must accept optional disabledReason",
);

// --- Ghost usage classification ---
type GhostHit = {
  file: string;
  index: number;
  snippet: string;
  kind: "allowed" | "retired";
  reason: string;
};

const ALLOWED_FILE_HINTS = [
  "sensitive-confirmation-dialog.tsx",
  "personnel-quick-create-dialog.tsx",
  "personnel-quick-edit-modal.tsx",
  "jalali-date-picker.tsx",
  "form-layout/field-help.tsx",
  "dev/gallery/page.tsx",
];

const CANCEL_LABEL_RE =
  /انصراف|بستن|cancelLabel|publicationConfirmCancel|exportClose|importCancelPreview|importClosePreview|importConfirmDismiss|correctionCaseCancel|lifecycleCancel/;

const GHOST_VARIANT_RE =
  /variant\s*=\s*["']ghost["']|variant\s*=\s\{\s*["']ghost["']\s*\}|buttonVariants\s*\(\s*\{[^}]*variant\s*:\s*["']ghost["']/;

function classifyGhost(file: string, src: string, index: number): GhostHit {
  const rel = path.relative(webRoot, file).replaceAll("\\", "/");
  const beforeWide = src.slice(Math.max(0, index - 800), index);
  const afterWide = src.slice(index, Math.min(src.length, index + 900));
  const snippet = src
    .slice(index, Math.min(src.length, index + 80))
    .replace(/\s+/g, " ");

  // Hard fail: inside rowActions / renderRowEnd callback body
  const rowIdx = Math.max(
    beforeWide.lastIndexOf("rowActions"),
    beforeWide.lastIndexOf("renderRowEnd"),
  );
  if (rowIdx >= 0) {
    const region = beforeWide.slice(rowIdx);
    const opens = (region.match(/\{/g) ?? []).length;
    const closes = (region.match(/\}/g) ?? []).length;
    if (opens > closes) {
      return {
        file: rel,
        index,
        snippet,
        kind: "retired",
        reason: "ghost inside rowActions/renderRowEnd",
      };
    }
  }

  if (
    /aria-label="صفحه‌بندی/.test(beforeWide) &&
    !/<\/nav>/.test(beforeWide.slice(beforeWide.lastIndexOf('aria-label="صفحه‌بندی')))
  ) {
    return {
      file: rel,
      index,
      snippet,
      kind: "retired",
      reason: "ghost in pagination chrome",
    };
  }

  if (rel.includes("leave-guard/")) {
    return {
      file: rel,
      index,
      snippet,
      kind: "retired",
      reason: "ghost in leave-guard (Discard must be tertiary)",
    };
  }

  if (ALLOWED_FILE_HINTS.some((h) => rel.endsWith(h))) {
    return {
      file: rel,
      index,
      snippet,
      kind: "allowed",
      reason: "allowlisted inline-dismiss / dialog chrome",
    };
  }

  if (rel.endsWith("components/ui/dialog.tsx")) {
    return {
      file: rel,
      index,
      snippet,
      kind: "allowed",
      reason: "DialogFooter built-in dismiss",
    };
  }

  const cancelish = CANCEL_LABEL_RE.test(afterWide);
  const inFooter =
    /DialogFooter|SheetFooter|DialogPrimitive\.Close/.test(beforeWide) ||
    /DialogFooter|SheetFooter/.test(afterWide.slice(0, 200));

  if (cancelish && inFooter) {
    return {
      file: rel,
      index,
      snippet,
      kind: "allowed",
      reason: "dialog/sheet cancel or dismiss",
    };
  }

  // Form footers without DialogFooter wrapper (FormFooter / data-slot only)
  if (
    cancelish &&
    (/FormFooter|data-slot="form-footer"/.test(beforeWide) ||
      /FormFooter|data-slot="form-footer"/.test(afterWide.slice(0, 200)))
  ) {
    return {
      file: rel,
      index,
      snippet,
      kind: "allowed",
      reason: "form footer cancel",
    };
  }

  if (cancelish && rel.endsWith("personnel-event-form.tsx")) {
    return {
      file: rel,
      index,
      snippet,
      kind: "allowed",
      reason: "form cancel",
    };
  }

  if (cancelish && rel.endsWith("decision-publication-panel.tsx")) {
    return {
      file: rel,
      index,
      snippet,
      kind: "allowed",
      reason: "publication confirm cancel",
    };
  }

  // import-wizard: only SheetFooter / DialogFooter ghost cancels — not surface toolbar
  if (cancelish && rel.endsWith("import-wizard.tsx")) {
    if (inFooter) {
      return {
        file: rel,
        index,
        snippet,
        kind: "allowed",
        reason: "import sheet/dialog dismiss",
      };
    }
    return {
      file: rel,
      index,
      snippet,
      kind: "retired",
      reason: "import surface-toolbar ghost (use tertiary)",
    };
  }

  if (cancelish && rel.endsWith("audit-investigation-panel.tsx")) {
    return {
      file: rel,
      index,
      snippet,
      kind: "allowed",
      reason: "dialog dismiss",
    };
  }

  return {
    file: rel,
    index,
    snippet,
    kind: "retired",
    reason: "unclassified ghost — treat as retired until allowlisted",
  };
}

const hits: GhostHit[] = [];
for (const file of walkTsx(webRoot)) {
  const src = fs.readFileSync(file, "utf8");
  const re = new RegExp(GHOST_VARIANT_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    hits.push(classifyGhost(file, src, m.index));
  }
}

const retired = hits.filter((h) => h.kind === "retired");
const allowed = hits.filter((h) => h.kind === "allowed");

assert.ok(
  allowed.length >= 8,
  `expected several allowed ghost survivors, got ${allowed.length}`,
);

if (retired.length > 0) {
  const detail = retired
    .map((h) => `  - ${h.file}: ${h.reason} :: ${h.snippet}`)
    .join("\n");
  assert.fail(`Retired ghost usages must be migrated:\n${detail}`);
}

// Fixture: known migrated row/toolbar sites must not contain ghost
const mustNotGhost = [
  "components/personnel/personnel-list-panel.tsx",
  "components/organization/org-flat-job-ref-panel.tsx",
  "components/organization/org-ladder-grade-panel.tsx",
  "components/organization/org-hierarchy-panel.tsx",
  "components/access/access-people-panel.tsx",
  "components/access/entitlement-grants-panel.tsx",
  "components/audit/audit-investigation-panel.tsx",
  "components/reports/report-workspace.tsx",
  "components/leave-guard/leave-guard-dialog.tsx",
];

for (const rel of mustNotGhost) {
  const src = read(rel);
  if (rel.includes("audit-investigation")) {
    // detail dialog dismiss may keep ghost — only forbid inside rowActions
    const rowBlock = src.match(/rowActions\s*=\s*\{[\s\S]*?\n\s*\}/);
    assert.ok(rowBlock, `${rel} should define rowActions`);
    assert.doesNotMatch(
      rowBlock[0],
      /variant\s*=\s*["']ghost["']/,
      `${rel} rowActions must not use ghost`,
    );
    continue;
  }
  if (
    rel.includes("org-flat") ||
    rel.includes("org-ladder") ||
    rel.includes("org-hierarchy") ||
    rel.includes("access-people")
  ) {
    // dialog cancels may keep ghost — forbid ghost only in rowActions / renderRowEnd
    const rowish = src.match(
      /(rowActions|renderRowEnd)\s*=\s*\{[\s\S]*?\n\s*\}/,
    );
    assert.ok(
      rowish,
      `${rel} should define rowActions or renderRowEnd for ghost fixture`,
    );
    assert.doesNotMatch(
      rowish[0],
      /variant\s*=\s*["']ghost["']/,
      `${rel} row/renderRowEnd must not use ghost`,
    );
    continue;
  }
  assert.doesNotMatch(
    src,
    /variant\s*=\s*["']ghost["']/,
    `${rel} must not use ghost (migrated surface)`,
  );
}

// org-flat drift: all row actions use shared icon-only primitive (8.7)
{
  const src = read("components/organization/org-flat-job-ref-panel.tsx");
  const rowBlock = src.match(/rowActions\s*=\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(rowBlock, "org-flat rowActions present");
  assert.match(
    rowBlock[0],
    /RowActionCluster|RowActionButton/,
    "org-flat rowActions must use RowActionCluster/RowActionButton",
  );
  assert.doesNotMatch(rowBlock[0], /variant="(ghost|outline|tertiary)"/);
}

// leave-guard Discard is tertiary (or outline alias), Stay is sole primary
{
  const src = read("components/leave-guard/leave-guard-dialog.tsx");
  assert.doesNotMatch(src, /variant\s*=\s*["']ghost["']/);
  assert.match(src, /variant="tertiary"/);
  const primaries = [...src.matchAll(/variant="primary"/g)];
  assert.equal(primaries.length, 1, "leave-guard must have exactly one primary (Stay)");
}

// import-wizard: surface toolbar must not use ghost; sheet may keep ghost dismiss
{
  const src = read("components/import/import-wizard.tsx");
  const sheetIdx = src.indexOf("<SheetFooter>");
  assert.ok(sheetIdx > 0, "import-wizard SheetFooter present");
  const toolbar = src.slice(0, sheetIdx);
  assert.doesNotMatch(
    toolbar,
    /variant\s*=\s*["']ghost["']/,
    "import-wizard surface toolbar must not use ghost",
  );
}

console.log(
  `control-contract selfcheck OK — ${allowed.length} allowed ghost, 0 retired ghost`,
);
