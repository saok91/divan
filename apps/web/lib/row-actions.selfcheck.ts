/**
 * Row-action affordance / inert-action selfcheck (Story 8.7 / FR-58 / UX-DR30).
 * Run: pnpm --filter @divan/web selfcheck:row-actions
 *
 * Filesystem/AST heuristics (no Playwright):
 * - Primitives enforce aria-label + stopPropagation + required onClick + disabledReason
 * - Table/tree consumers prefer RowActionButton / RowActionCluster
 * - Call sites must not ship enabled controls without onClick / onSelect
 * - Raw text-only `variant="rowAction"` Buttons banned outside allowlisted primitives
 * - Leave-guard silent paths closed
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

/** Extract JSX attribute blocks for a component tag (self-closing or open). */
function jsxAttrBlocks(src: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b([\\s\\S]*?)(?:\\/>|>)`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push(m[1] ?? "");
  }
  return out;
}

function isDisabledAttrs(attrs: string): boolean {
  return (
    /\bdisabled(?:\s*=\s*\{?\s*true\s*\}?)?(?:\s|$|\/)/.test(attrs) ||
    /\bdisabled=\{(?!\s*false\s*\})[^}]+\}/.test(attrs)
  );
}

// --- Primitives ---
const rowBtn = read("components/ui/row-action-button.tsx");
assert.match(rowBtn, /aria-label=\{label\}/, "RowActionButton requires aria-label");
assert.match(rowBtn, /stopPropagation/, "RowActionButton must stopPropagation");
assert.match(rowBtn, /disabledReason/, "RowActionButton must support disabledReason");
assert.match(rowBtn, /variant="rowAction"/, "RowActionButton uses rowAction variant");
assert.match(rowBtn, /Tooltip/, "RowActionButton must wrap with Tooltip");
assert.match(
  rowBtn,
  /disabledReason is required when disabled/,
  "RowActionButton must reject disabled without reason",
);
assert.match(
  rowBtn,
  /label is required \(non-empty\)/,
  "RowActionButton must reject empty label",
);
assert.match(
  rowBtn,
  /onClick:\s*\(event/,
  "RowActionButton onClick must be required (not optional)",
);
assert.doesNotMatch(
  rowBtn,
  /onClick\?:/,
  "RowActionButton must not type onClick as optional",
);

const overflow = read("components/ui/row-action-overflow.tsx");
assert.match(overflow, /RowActionOverflow|Ellipsis/, "overflow uses Ellipsis");
assert.match(overflow, /اقدامات بیشتر/, "overflow trigger has Persian label");
assert.match(overflow, /slice\(0,\s*2\)/, "cluster keeps at most two visible icons");
assert.match(overflow, /stopPropagation/, "overflow/cluster stopPropagation");
assert.match(
  overflow,
  /disabledReason is required when disabled/,
  "cluster/overflow must fail closed without disabledReason",
);
assert.doesNotMatch(
  overflow,
  /این اقدام در حال حاضر در دسترس نیست/,
  "must not soft-default a fake disabledReason",
);
assert.match(
  overflow,
  /TooltipProvider/,
  "RowActionCluster supplies one TooltipProvider for the strip",
);

const dropdown = read("components/ui/dropdown-menu.tsx");
assert.match(dropdown, /from "radix-ui"/, "dropdown-menu uses unified radix-ui package");
assert.doesNotMatch(
  dropdown,
  /@radix-ui\/react-dropdown-menu/,
  "do not add separate @radix-ui/react-dropdown-menu dep",
);

const iconContract = read("components/icons/icon-contract.md");
for (const name of [
  "Pencil",
  "CalendarPlus",
  "Shield",
  "MapPinned",
  "CircleCheck",
  "Ban",
  "Eye",
  "FileSearch",
  "Ellipsis",
]) {
  assert.match(
    iconContract,
    new RegExp(name),
    `icon-contract.md must document ${name}`,
  );
}

// --- GovernedDataTable onRowClick ---
const gdtTypes = read("components/governed-data-table/types.ts");
assert.match(gdtTypes, /onRowClick\??:/, "GovernedDataTableProps must expose onRowClick");
assert.match(
  gdtTypes,
  /rowActivateLabel\??:/,
  "GovernedDataTableProps must expose rowActivateLabel",
);

const gdt = read("components/governed-data-table/governed-data-table.tsx");
assert.match(gdt, /onRowClick/, "governed-data-table must wire onRowClick");
assert.match(
  gdt,
  /event\.target\s*===\s*event\.currentTarget/,
  "row Enter/Space must require target === currentTarget",
);
assert.match(
  gdt,
  /getSelection/,
  "row click must ignore text selection",
);
assert.match(
  gdt,
  /aria-description/,
  "activatable rows must expose aria-description",
);
assert.match(
  gdt,
  /stopPropagation/,
  "actions cell must stopPropagation from row click",
);

// --- Leave-guard honesty ---
const leaveAlgo = read("components/leave-guard/leave-guard-algorithm.ts");
assert.match(leaveAlgo, /replace-waiter/, "algorithm has replace-waiter path");
assert.match(
  leaveAlgo,
  /clear-pending-and-navigate/,
  "algorithm clears pending when dirty is gone",
);
assert.match(
  leaveAlgo,
  /blocked-no-save/,
  "algorithm has blocked-no-save path",
);

const leaveProvider = read("components/leave-guard/leave-guard-provider.tsx");
assert.match(
  leaveProvider,
  /decideRequestNavigation/,
  "provider must use decideRequestNavigation",
);
assert.match(
  leaveProvider,
  /clear-pending-and-navigate|clearPendingAndNavigate/,
  "provider must clear pending before clean navigate",
);
assert.match(
  leaveProvider,
  /replace-waiter|focusLeaveDialog/,
  "provider must not silent-false on pending",
);
assert.match(
  leaveProvider,
  /requestAnimationFrame/,
  "focusLeaveDialog must wait for paint before focusing Stay",
);
assert.doesNotMatch(
  leaveProvider,
  /if \(pendingRef\.current\) \{\s*return Promise\.resolve\(false\);\s*\}/,
  "silent pending early-return must be removed",
);
assert.match(
  leaveProvider,
  /decideSaveGate/,
  "provider must use decideSaveGate for Save",
);

const leaveDialog = read("components/leave-guard/leave-guard-dialog.tsx");
assert.match(
  leaveDialog,
  /saveBlockedReason/,
  "dialog must surface saveBlockedReason",
);
assert.match(leaveDialog, /role="status"/, "blocked reason uses role=status");

// --- Consumer migrations ---
const mandatoryConsumers: { rel: string; needle: RegExp }[] = [
  {
    rel: "components/personnel/personnel-list-panel.tsx",
    needle: /RowActionCluster/,
  },
  {
    rel: "components/personnel/personnel-list-panel.tsx",
    needle: /onRowClick/,
  },
  {
    rel: "components/personnel/personnel-events-list-panel.tsx",
    needle: /RowActionCluster/,
  },
  {
    rel: "components/personnel/personnel-events-list-panel.tsx",
    needle: /onRowClick/,
  },
  {
    rel: "components/access/access-people-panel.tsx",
    needle: /RowActionCluster/,
  },
  {
    rel: "components/organization/org-flat-job-ref-panel.tsx",
    needle: /RowActionCluster/,
  },
  {
    rel: "components/audit/audit-investigation-panel.tsx",
    needle: /RowActionButton/,
  },
  {
    rel: "components/correction-cases/correction-cases-panel.tsx",
    needle: /RowActionButton/,
  },
  {
    rel: "components/reports/report-workspace.tsx",
    needle: /RowActionButton/,
  },
];

for (const { rel, needle } of mandatoryConsumers) {
  assert.match(read(rel), needle, `${rel} must match ${needle}`);
}

// Access people: 3 actions → overflow (activate is #3)
{
  const src = read("components/access/access-people-panel.tsx");
  assert.match(src, /فعال‌سازی/, "access people still has activate action");
  assert.match(src, /RowActionCluster/, "access people uses cluster for overflow");
}

// --- Call-site honesty: RowActionButton must have onClick; disabled ⇒ disabledReason ---
for (const file of walkTsx(webRoot)) {
  const rel = path.relative(webRoot, file).replaceAll("\\", "/");
  if (rel.includes("dev/gallery/")) continue;
  if (
    rel === "components/ui/row-action-button.tsx" ||
    rel === "components/ui/row-action-overflow.tsx"
  ) {
    continue;
  }
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes("RowActionButton")) continue;

  for (const attrs of jsxAttrBlocks(src, "RowActionButton")) {
    if (isDisabledAttrs(attrs)) {
      assert.match(
        attrs,
        /disabledReason=/,
        `${rel}: disabled RowActionButton missing disabledReason`,
      );
    } else {
      assert.match(
        attrs,
        /onClick=/,
        `${rel}: enabled RowActionButton missing onClick`,
      );
    }
  }
}

// --- Ban raw text-only rowAction Buttons outside primitives / allowlist ---
const ALLOW_RAW_ROW_ACTION = new Set([
  path.normalize(path.join(webRoot, "components/ui/row-action-button.tsx")),
  path.normalize(path.join(webRoot, "components/ui/row-action-overflow.tsx")),
  path.normalize(path.join(webRoot, "components/ui/button.tsx")),
  path.normalize(path.join(webRoot, "lib/control-contract.selfcheck.ts")),
]);

const RAW_ROW_ACTION_RE = /variant\s*=\s*(?:\{)?["']rowAction["'](?:\})?/;

for (const file of walkTsx(webRoot)) {
  const rel = path.relative(webRoot, file).replaceAll("\\", "/");
  if (rel.endsWith(".selfcheck.ts")) continue;
  if (ALLOW_RAW_ROW_ACTION.has(path.normalize(file))) continue;
  // Gallery may still mention rowAction in docs; prefer primitives
  if (rel.includes("dev/gallery/")) continue;

  const src = fs.readFileSync(file, "utf8");
  if (!RAW_ROW_ACTION_RE.test(src)) continue;

  // Fail if a Button with variant=rowAction appears outside the shared primitive
  assert.fail(
    `${rel}: raw variant="rowAction" Button found — use RowActionButton / RowActionCluster`,
  );
}

console.log("row-actions.selfcheck: ok");
