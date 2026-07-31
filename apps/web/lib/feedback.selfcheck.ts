/**
 * Feedback / loading / motion selfcheck (Story 8.8 / UX-DR39 / FR-58).
 * Run: pnpm --filter @divan/web selfcheck:feedback
 *
 * Filesystem heuristics (no Playwright):
 * - Skeleton uses skeleton token + pulse class (reduced-motion gated in CSS)
 * - Duration tokens present; toast slide uses duration token
 * - Single Toaster host under AppShell
 * - GovernedDataTable exposes loading / TableSkeleton path
 * - No framer-motion dependency for this contract
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
  /--duration-fast:\s*150ms/,
  "globals.css must define --duration-fast: 150ms",
);
assert.match(
  globals,
  /--duration-state:\s*200ms/,
  "globals.css must define --duration-state: 200ms",
);
assert.match(
  globals,
  /--duration-enter:\s*250ms/,
  "globals.css must define --duration-enter: 250ms",
);
assert.match(
  globals,
  /@keyframes divan-skeleton-pulse/,
  "skeleton must use opacity pulse keyframes",
);
assert.match(
  globals,
  /\.animate-skeleton-pulse/,
  "globals must define .animate-skeleton-pulse",
);
assert.match(
  globals,
  /prefers-reduced-motion: reduce[\s\S]*?\.animate-skeleton-pulse/,
  "reduced-motion must disable skeleton pulse",
);
assert.match(
  globals,
  /animate-toast-slide[\s\S]*?var\(--duration-state\)/,
  "toast slide must use --duration-state",
);
assert.doesNotMatch(
  globals,
  /animate-skeleton-shimmer/,
  "shimmer class must be removed (pulse replaces it)",
);

const skeleton = read("components/ui/skeleton.tsx");
assert.match(skeleton, /bg-skeleton/, "Skeleton default fill must use bg-skeleton");
assert.match(
  skeleton,
  /animate-skeleton-pulse/,
  "Skeleton must apply animate-skeleton-pulse",
);
assert.doesNotMatch(
  skeleton,
  /bg-muted/,
  "Skeleton must not default to bg-muted",
);

const toast = read("components/ui/toast.tsx");
assert.match(toast, /export function toastBackground/, "toastBackground API required");
assert.match(toast, /export function Toaster/, "Toaster host export required");
assert.match(
  toast,
  /illegal for ordinary form/,
  "toast module must document form-save ban",
);

const shell = read("components/app-shell.tsx");
assert.match(shell, /<Toaster\s*\/>/, "AppShell must mount a single Toaster");
assert.match(shell, /from ["']@\/components\/ui\/toast["']/, "Toaster import from ui/toast");

const tableTypes = read("components/governed-data-table/types.ts");
assert.match(tableTypes, /loading\?:/, "GovernedDataTableProps must expose loading?");
assert.match(
  tableTypes,
  /loadingRowCount\?:/,
  "GovernedDataTableProps must expose loadingRowCount?",
);

const table = read("components/governed-data-table/governed-data-table.tsx");
assert.match(table, /TableSkeleton/, "GovernedDataTable must render TableSkeleton");
assert.match(table, /loading\s*=\s*false/, "loading prop default false (additive)");

const tableSkeleton = read("components/governed-data-table/table-skeleton.tsx");
assert.match(
  tableSkeleton,
  /export function TableSkeleton/,
  "TableSkeleton export required",
);

const sheet = read("components/ui/sheet.tsx");
assert.match(
  sheet,
  /duration-\[var\(--duration-enter\)\]/,
  "sheet open enter must use --duration-enter (≤250ms)",
);
assert.doesNotMatch(
  sheet,
  /duration-300/,
  "sheet must not use duration-300 open enter",
);

const feedbackMsg = read("components/ui/feedback-message.tsx");
assert.match(
  feedbackMsg,
  /export function FeedbackMessage/,
  "FeedbackMessage primitive required",
);

const precedence = read("components/feedback/FEEDBACK.md");
assert.match(precedence, /Toast/, "FEEDBACK.md must document toast channel");
assert.match(precedence, /Banner/, "FEEDBACK.md must document banner channel");
assert.match(precedence, /Inline/, "FEEDBACK.md must document inline channel");

const importWizard = read("components/import/import-wizard.tsx");
assert.match(
  importWizard,
  /toastBackground/,
  "import execute success must use toastBackground",
);

const personnelList = read("components/personnel/personnel-list-panel.tsx");
assert.match(
  personnelList,
  /loading=\{coldLoading\}/,
  "personnel list must wire GovernedDataTable loading",
);

const pkg = read("package.json");
assert.match(
  pkg,
  /"selfcheck:feedback"/,
  "package.json must wire selfcheck:feedback",
);

// Ban framer-motion for this feedback contract (CSS-only motion).
const packageJson = JSON.parse(pkg) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
assert.ok(
  !packageJson.dependencies?.["framer-motion"] &&
    !packageJson.devDependencies?.["framer-motion"],
  "framer-motion must not be introduced for feedback/motion",
);

console.log("selfcheck:feedback OK");
