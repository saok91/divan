/**
 * Design QA gate (Story 8.10) — Epic 9/10 must pass before their baselines.
 * Run: pnpm --filter @divan/web selfcheck:design-qa
 *
 * Orchestrates Epic 8 selfchecks + artifact completeness + contrast floor.
 * No Playwright / axe / Vitest (repo pattern).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "../..");

const RESULT_OK = /^(pass|fixed|amendment)$/i;
const GATE_PASS = /^pass$/i;
const SUBCHECK_TIMEOUT_MS = 120_000;

function fail(message: string): never {
  console.error(`design-qa.selfcheck FAILED: ${message}`);
  process.exit(1);
}

function readRequired(relFromWeb: string): string {
  const abs = path.join(webRoot, relFromWeb);
  assert.ok(fs.existsSync(abs), `missing artifact: ${relFromWeb}`);
  return fs.readFileSync(abs, "utf8");
}

/** Split a markdown table row into cells (trims; drops leading/trailing empties from edge pipes). */
function tableCells(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];
  return trimmed
    .slice(1, trimmed.endsWith("|") ? -1 : undefined)
    .split("|")
    .map((c) => c.trim());
}

function findTableRow(
  markdown: string,
  matchFirstCell: (cell: string) => boolean,
): string[] | undefined {
  for (const line of markdown.split("\n")) {
    const cells = tableCells(line);
    if (cells.length === 0) continue;
    if (matchFirstCell(cells[0] ?? "")) return cells;
  }
  return undefined;
}

function assertMatrixComplete(markdown: string): void {
  const requiredScreens = [
    "Personnel list",
    "Personnel event form",
    "Person profile",
    "Reports workspace",
    "Dashboard",
    "Headcount + drawer",
    "Bulk-entry wizard",
    "Settings",
    "Chart palettes",
  ];
  for (const screen of requiredScreens) {
    const cells = findTableRow(markdown, (c) => c === screen);
    assert.ok(cells, `matrix missing row for screen: ${screen}`);
    // Screen | Mockup | Route | Result | Notes
    const result = cells[3] ?? "";
    assert.ok(
      RESULT_OK.test(result),
      `matrix row for "${screen}" must have Result ∈ {pass, fixed, amendment} (got "${result}")`,
    );
  }

  const paritySurfaces = [
    "Proof product routes",
    "Status badges",
    "Stale / break-glass banners",
    "Chart series",
  ];
  for (const surface of paritySurfaces) {
    const cells = findTableRow(markdown, (c) => c === surface);
    assert.ok(cells, `matrix missing light/dark parity row: ${surface}`);
    // Surface | Light | Dark | Notes
    const light = cells[1] ?? "";
    const dark = cells[2] ?? "";
    assert.ok(
      RESULT_OK.test(light),
      `parity "${surface}" Light must be ∈ {pass, fixed, amendment} (got "${light}")`,
    );
    assert.ok(
      RESULT_OK.test(dark),
      `parity "${surface}" Dark must be ∈ {pass, fixed, amendment} (got "${dark}")`,
    );
  }
}

function assertProbesComplete(markdown: string): void {
  const groups = ["Picker", "Tables", "Dialogs / drawers", "Icon-only"];
  for (const group of groups) {
    const cells = findTableRow(markdown, (c) => c === group);
    assert.ok(cells, `a11y probes missing group: ${group}`);
    // Probe group | Automated | Manual DoD | Result | Notes
    const result = cells[3] ?? "";
    assert.ok(
      GATE_PASS.test(result),
      `a11y probe group "${group}" must Result = pass (got "${result}")`,
    );
  }

  for (const viewport of ["1280×720", "1920×1080"]) {
    const cells = findTableRow(markdown, (c) => c === viewport);
    assert.ok(cells, `a11y probes missing viewport DoD row: ${viewport}`);
    // Viewport | Essential tasks | Page-level H-scroll | Result
    const result = cells[3] ?? "";
    assert.ok(
      GATE_PASS.test(result),
      `viewport DoD "${viewport}" must Result = pass (got "${result}")`,
    );
  }
}

function assertChecklistComplete(markdown: string): void {
  const areas = [
    "Page header",
    "Panel system",
    "Form layout",
    "Table chrome",
    "Button variants",
    "Icon mapping",
    "Feedback channel",
  ];
  for (const area of areas) {
    const cells = findTableRow(markdown, (c) => c === area);
    assert.ok(cells, `consistency checklist missing area: ${area}`);
    // Area | Automated proof | Manual residual | Gate
    const gate = cells[3] ?? "";
    assert.ok(
      GATE_PASS.test(gate),
      `consistency checklist Gate must be pass for "${area}" (got "${gate}")`,
    );
  }
  for (const script of [
    "selfcheck:control-contract",
    "selfcheck:layout-system",
    "selfcheck:entity-picker",
    "selfcheck:governed-table",
    "selfcheck:row-actions",
    "selfcheck:leave-guard",
    "selfcheck:feedback",
    "selfcheck:operational-copy",
    "selfcheck:a11y-floor",
  ]) {
    assert.ok(
      markdown.includes(script),
      `consistency checklist must list required suite entry: ${script}`,
    );
  }
}

/** Prefer package scripts so Windows/Unix path resolution stays with pnpm. */
const REQUIRED_SCRIPTS = [
  "selfcheck:control-contract",
  "selfcheck:layout-system",
  "selfcheck:entity-picker",
  "selfcheck:governed-table",
  "selfcheck:row-actions",
  "selfcheck:leave-guard",
  "selfcheck:feedback",
  "selfcheck:operational-copy",
  "selfcheck:a11y-floor",
] as const;

function runWebScript(script: string): void {
  // Single-string command avoids DEP0190 (args + shell:true) on Node 24+.
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
  const matrix = readRequired("lib/design-qa-mockup-matrix.md");
  assertMatrixComplete(matrix);

  const checklist = readRequired("lib/design-qa-consistency-checklist.md");
  assertChecklistComplete(checklist);

  const probes = readRequired("lib/design-qa-a11y-probes.md");
  assertProbesComplete(probes);

  for (const script of REQUIRED_SCRIPTS) {
    console.log(`design-qa: running ${script}…`);
    runWebScript(script);
  }

  console.log("design-qa.selfcheck: ok");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  fail(message);
}
