/**
 * Chart visual quality selfcheck (Story 9.10 / UX-DR40).
 * Run: pnpm --filter @divan/web selfcheck:chart-visual
 *
 * AST / filesystem heuristics (no Playwright):
 * - DESIGN chart CSS vars present (incl. #087A90 series-2)
 * - Forbidden gold/status hex absent from chart module
 * - Dashboard + reports import shared chrome
 * - Metric card uses Panel / data-slot="panel"
 * - Suppress string exact (never zero masquerade)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CHART_CATEGORICAL_DARK,
  CHART_CATEGORICAL_LIGHT,
  CHART_FORBIDDEN_AS_DATA,
  CHART_SEQUENTIAL,
  assertChartPaletteClean,
  isForbiddenChartDataColor,
} from "./chart-tokens";
import { operationalCopy } from "./operational-copy";
import { extractReportCategoricalDistribution } from "../components/charts/report-chart-distribution";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(webRoot, rel), "utf8");
}

// --- Token SoT ---
assertChartPaletteClean(CHART_CATEGORICAL_LIGHT, "light categorical");
assertChartPaletteClean(CHART_CATEGORICAL_DARK, "dark categorical");
assertChartPaletteClean(CHART_SEQUENTIAL, "sequential");
assert.equal(CHART_CATEGORICAL_LIGHT[1].toUpperCase(), "#087A90");
assert.notEqual(CHART_CATEGORICAL_LIGHT[1].toUpperCase(), "#0B8FA8");

const globals = read("app/globals.css");
assert.match(
  globals,
  /--chart-categorical-2:\s*#087a90/i,
  "globals must wire series-2 cyan #087A90",
);
assert.match(globals, /--chart-categorical-1:/);
assert.match(globals, /--chart-sequential-7:/);
assert.match(globals, /--chart-gridline:/);
assert.match(globals, /--color-chart-categorical-1:\s*var\(--chart-categorical-1\)/);
assert.doesNotMatch(
  globals,
  /--chart-categorical-2:\s*#0[Bb]8[Ff][Aa]8/,
  "must not regress to #0B8FA8",
);

// Full light token ↔ CSS hex parity (SoT drift guard)
for (let i = 0; i < CHART_CATEGORICAL_LIGHT.length; i++) {
  const hex = CHART_CATEGORICAL_LIGHT[i]!.toLowerCase();
  const re = new RegExp(
    `--chart-categorical-${i + 1}:\\s*${hex}`,
    "i",
  );
  assert.match(
    globals,
    re,
    `globals light categorical-${i + 1} must match chart-tokens ${hex}`,
  );
}
for (let i = 0; i < CHART_SEQUENTIAL.length; i++) {
  const hex = CHART_SEQUENTIAL[i]!.toLowerCase();
  const re = new RegExp(
    `--chart-sequential-${i + 1}:\\s*${hex}`,
    "i",
  );
  assert.match(
    globals,
    re,
    `globals sequential-${i + 1} must match chart-tokens ${hex}`,
  );
}
assert.match(
  globals,
  /--chart-gridline:\s*#e8eaef/i,
  "globals light gridline must match CHART_GRIDLINE_LIGHT",
);

// Dark theme overrides categorical
assert.match(
  globals,
  /\.dark\s*\{[\s\S]*?--chart-categorical-1:\s*#6c8cff/i,
);
for (let i = 0; i < CHART_CATEGORICAL_DARK.length; i++) {
  const hex = CHART_CATEGORICAL_DARK[i]!.toLowerCase();
  const re = new RegExp(
    `\\.dark\\s*\\{[\\s\\S]*?--chart-categorical-${i + 1}:\\s*${hex}`,
    "i",
  );
  assert.match(
    globals,
    re,
    `globals dark categorical-${i + 1} must match chart-tokens ${hex}`,
  );
}

// --- Forbidden colors absent from chart components ---
const chartFiles = [
  "components/charts/chart-frame.tsx",
  "components/charts/categorical-line-chart.tsx",
  "components/charts/categorical-bar-chart.tsx",
  "components/charts/index.ts",
  "lib/chart-tokens.ts",
];
for (const rel of chartFiles) {
  const src = read(rel);
  // Skip the forbidden-list definition itself in chart-tokens
  if (rel.endsWith("chart-tokens.ts")) {
    for (const hex of CHART_CATEGORICAL_LIGHT) {
      assert.ok(
        !isForbiddenChartDataColor(hex),
        `categorical light ${hex} must not be forbidden`,
      );
    }
    continue;
  }
  for (const forbidden of CHART_FORBIDDEN_AS_DATA) {
    const re = new RegExp(forbidden.replace("#", "#?"), "i");
    assert.doesNotMatch(
      src,
      re,
      `${rel} must not hardcode forbidden data color ${forbidden}`,
    );
  }
  assert.doesNotMatch(src, /#0[Bb]8[Ff][Aa]8/, `${rel}: no #0B8FA8`);
}

assert.ok(
  CHART_FORBIDDEN_AS_DATA.some((h) => h === "#fdb913"),
  "gold must be in forbidden set",
);

// --- Shared chrome consumers ---
const dashboardPanel = read("components/dashboard/dashboard-panel.tsx");
assert.match(
  dashboardPanel,
  /from ["']@\/components\/charts["']/,
  "dashboard-panel must import shared charts",
);
assert.match(dashboardPanel, /CategoricalLineChart/);
assert.match(dashboardPanel, /FeedbackMessage/);
assert.doesNotMatch(
  dashboardPanel,
  /<p\s+role=["'](alert|status)["']/,
  "dashboard-panel must not use raw alert/status <p>",
);

const metricCard = read("components/dashboard/dashboard-metric-card.tsx");
assert.match(
  metricCard,
  /from ["']@\/components\/layout\/panel-section["']/,
  "metric card must adopt Panel",
);
assert.match(metricCard, /<Panel[\s\S]*?>/);
assert.match(metricCard, /FeedbackMessage/);
assert.match(metricCard, /lastCalculatedAt/);
assert.doesNotMatch(
  metricCard,
  /rounded-md border border-border/,
  "metric card must drop bordered-card spam",
);

const reportWorkspace = read("components/reports/report-workspace.tsx");
assert.match(
  reportWorkspace,
  /from ["']@\/components\/charts["']/,
  "report-workspace must import shared charts",
);
assert.match(reportWorkspace, /extractReportCategoricalDistribution/);
assert.match(reportWorkspace, /CategoricalBarChart/);

const gallery = read("app/(app)/dev/gallery/page.tsx");
assert.match(gallery, /gallery-charts/);
assert.match(gallery, /CategoricalLineChart/);

// --- Suppress copy exact ---
assert.equal(operationalCopy.suppressedCohort, "داده قابل نمایش نیست");
assert.match(
  metricCard,
  /operationalCopy\.suppressedCohort/,
  "metric card must use suppressedCohort SoT",
);

// --- Distribution heuristic honesty ---
const dist = extractReportCategoricalDistribution(
  "distributions",
  [
    { id: "dimension", headerFa: "بُعد" },
    { id: "key", headerFa: "کلید" },
    { id: "count", headerFa: "تعداد" },
  ],
  [
    { id: "1", cells: { dimension: "role", key: "eng", count: 3 } },
    { id: "2", cells: { dimension: "role", key: "ops", count: 1 } },
  ],
);
assert.ok(dist);
assert.equal(dist!.length, 2);
assert.equal(dist![0]!.value, 3);

const skipped = extractReportCategoricalDistribution(
  "active_persons",
  [
    { id: "personnelCode", headerFa: "کد" },
    { id: "displayName", headerFa: "نام" },
  ],
  [{ id: "1", cells: { personnelCode: "1", displayName: "آ" } }],
);
assert.equal(skipped, null, "list reports must not invent chart series");

const org = extractReportCategoricalDistribution(
  "org_state",
  [
    { id: "unitType", headerFa: "نوع" },
    { id: "count", headerFa: "تعداد" },
  ],
  [{ id: "1", cells: { unitType: "TEAM", count: 4 } }],
);
assert.ok(org);
assert.equal(org![0]!.label, "TEAM");

const rejectsNullCount = extractReportCategoricalDistribution(
  "distributions",
  [
    { id: "key", headerFa: "کلید" },
    { id: "count", headerFa: "تعداد" },
  ],
  [
    { id: "1", cells: { key: "a", count: null } },
    { id: "2", cells: { key: "b", count: true } },
  ],
);
assert.equal(rejectsNullCount, null, "null/boolean counts must not invent buckets");

const aggregatesDupes = extractReportCategoricalDistribution(
  "distributions",
  [
    { id: "key", headerFa: "کلید" },
    { id: "count", headerFa: "تعداد" },
  ],
  [
    { id: "1", cells: { key: "eng", count: 2 } },
    { id: "2", cells: { key: "eng", count: 3 } },
  ],
);
assert.ok(aggregatesDupes);
assert.equal(aggregatesDupes!.length, 1);
assert.equal(aggregatesDupes![0]!.value, 5);

console.log("chart-visual.selfcheck: ok");
