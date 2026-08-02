/**
 * Self-check: WCAG AA contrast floor + operational copy + viewport gate.
 * Run: pnpm --filter @divan/web selfcheck:a11y-floor
 *
 * Body 13px and column-header 10.5px are normal text → minimum 4.5:1 (WCAG 2.2 SC 1.4.3).
 */
import assert from "node:assert/strict";

import { shouldActivateViewportGate } from "./viewport-gate";
import {
  operationalCopy,
  staleRecalcMessage,
} from "./operational-copy";
import {
  CHART_CATEGORICAL_DARK,
  CHART_CATEGORICAL_LIGHT,
  assertChartPaletteClean,
} from "./chart-tokens";

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const L1 = relativeLuminance(foreground);
  const L2 = relativeLuminance(background);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

function assertAA(
  label: string,
  foreground: string,
  background: string,
  minimum = 4.5,
): void {
  const ratio = contrastRatio(foreground, background);
  assert.ok(
    ratio >= minimum,
    `${label}: ${foreground} on ${background} = ${ratio.toFixed(2)} (need ≥${minimum})`,
  );
}

/** Nudged DESIGN primary pairs used by secondary buttons in globals.css */
const LIGHT_PRIMARY = "#006dff";
const DARK_PRIMARY = "#1e6fe0";

assertAA("light secondary CTA", "#ffffff", LIGHT_PRIMARY);
assertAA("dark secondary CTA", "#ffffff", DARK_PRIMARY);

// --- Body 13px / column-header 10.5px token pairs (both themes) ---
const LIGHT_SURFACE = "#ffffff";
const LIGHT_SUBTLE = "#fafbfc";
const DARK_SURFACE = "#0a1138";
const DARK_SUBTLE = "#0d1542";

assertAA("light body primary", "#11142a", LIGHT_SURFACE);
assertAA("light body secondary", "#4a4f63", LIGHT_SURFACE);
assertAA("light tertiary", "#6b7080", LIGHT_SURFACE);
assertAA("light column-header", "#4a4f63", LIGHT_SUBTLE);

assertAA("dark body primary", "#e6e9f5", DARK_SURFACE);
assertAA("dark body secondary", "#9aa1c0", DARK_SURFACE);
assertAA("dark tertiary", "#8a91b0", DARK_SURFACE);
assertAA("dark column-header", "#9aa1c0", DARK_SUBTLE);

// --- Status badges ---
assertAA("light badge scheduled", "#1864ab", "#e7f5ff");
assertAA("light badge effective", "#1f7a32", "#d3f9d8");
assertAA("light badge cancelled", "#495057", "#f1f3f5");
assertAA("light badge reversed", "#495057", "#f1f3f5");
assertAA("light badge draft", "#a85700", "#fff9db");
assertAA("light badge override", "#862e00", "#fff3bf");

assertAA("dark badge scheduled", "#a5d8ff", "#1a3a5c");
assertAA("dark badge effective", "#8ce99a", "#1b3d2f");
assertAA("dark badge cancelled", "#ced4da", "#2e2e32");
assertAA("dark badge reversed", "#ced4da", "#2e2e32");
assertAA("dark badge draft", "#ffe066", "#3d3200");
assertAA("dark badge override", "#ffb3d1", "#3d1a2e");

// --- Banners ---
assertAA("light stale banner", "#862e00", "#fff3bf");
assertAA("light break-glass banner", "#1864ab", "#e7f5ff");
assertAA("dark stale banner", "#ffe066", "#3d3200");
assertAA("dark break-glass banner", "#a5d8ff", "#1a3a5c");

// --- Chart categorical on canvas (DESIGN 8.10-A1; SoT = chart-tokens.ts) ---
assertChartPaletteClean(CHART_CATEGORICAL_LIGHT, "light categorical");
assertChartPaletteClean(CHART_CATEGORICAL_DARK, "dark categorical");
assert.equal(
  CHART_CATEGORICAL_LIGHT[1].toUpperCase(),
  "#087A90",
  "series-2 cyan must be #087A90 (8.10-A1), not #0B8FA8",
);

for (const [i, hex] of CHART_CATEGORICAL_LIGHT.entries()) {
  assertAA(`light chart series ${i + 1}`, hex, LIGHT_SURFACE);
}
for (const [i, hex] of CHART_CATEGORICAL_DARK.entries()) {
  assertAA(`dark chart series ${i + 1}`, hex, DARK_SURFACE);
}

// CTA rule: never use brand gold `#FDB913` as text on dark canvas (policy ban).
// Accent-on-accent-foreground is the correct pattern; gold-as-fill on light is OK.
const BRAND_GOLD = "#fdb913";
const DARK_FG_TOKENS = [
  "#e6e9f5",
  "#9aa1c0",
  "#8a91b0",
  "#a5d8ff",
  "#8ce99a",
  "#ced4da",
  "#ffe066",
  "#ffb3d1",
  "#6c8cff",
  "#3bc9db",
  "#f06595",
  "#a98bff",
  "#adb5bd",
] as const;
for (const fg of DARK_FG_TOKENS) {
  assert.notEqual(
    fg.toLowerCase(),
    BRAND_GOLD,
    `dark fg token ${fg} must not be brand gold text on dark canvas`,
  );
}
// Dark theme accent fill is warmer `#fbc470`, not brand gold-as-text.
assert.notEqual("#fbc470".toLowerCase(), BRAND_GOLD);
assert.notEqual("#1a1208".toLowerCase(), BRAND_GOLD);
assertAA("light accent fill + accent-fg (CTA pattern)", "#1a1208", BRAND_GOLD);
assertAA("dark accent fill + accent-fg (CTA pattern)", "#1a1208", "#fbc470");
// Disabled / incidental pairs: WCAG SC 1.4.3 exempts inactive UI components —
// --disabled-foreground on --disabled-surface is not asserted here.

assert.equal(operationalCopy.accessDeniedTitle, "دسترسی ندارید.");
assert.equal(
  operationalCopy.emptySearch,
  "نتیجه‌ای پیدا نشد. عبارت یا فیلتر را عوض کنید.",
);
assert.equal(
  operationalCopy.ldapUnavailable,
  "اتصال به سامانه هویت برقرار نیست.",
);
assert.equal(
  staleRecalcMessage(3),
  "محاسبهٔ وضعیت جاری برای ۳ فرد هنوز کامل نشده — نهایی‌سازی رویداد و خروجی گرفتن برای این افراد موقتاً غیرفعال است. معمولاً چند دقیقه طول می‌کشد.",
);
assert.doesNotMatch(
  staleRecalcMessage(3),
  /تا\s*[۰-۹0-9]{1,2}:[۰-۹0-9]{2}/,
  "staleRecalcMessage must not embed a clock deadline",
);
assert.equal(
  operationalCopy.figureRecalculating,
  "در حال محاسبه — عدد ممکن است تغییر کند.",
);
assert.equal(operationalCopy.staleRecalcDisclosureSummary, "توضیح بیشتر");

// 200% zoom on large display: outer stays large, inner shrinks → no gate
assert.equal(
  shouldActivateViewportGate({
    innerWidth: 640,
    innerHeight: 360,
    outerWidth: 1280,
    outerHeight: 720,
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
    },
  }),
  false,
);

// Maximized on 1280×720 reference: outerHeight < 720 due to taskbar → no gate
assert.equal(
  shouldActivateViewportGate({
    innerWidth: 1280,
    innerHeight: 640,
    outerWidth: 1280,
    outerHeight: 680,
    screen: {
      width: 1280,
      height: 720,
      availWidth: 1280,
      availHeight: 680,
    },
  }),
  false,
);

// Genuine small window on large display → gate
assert.equal(
  shouldActivateViewportGate({
    innerWidth: 900,
    innerHeight: 600,
    outerWidth: 900,
    outerHeight: 600,
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
    },
  }),
  true,
);

// Small reference display → gate when CSS viewport is small
assert.equal(
  shouldActivateViewportGate({
    innerWidth: 1024,
    innerHeight: 700,
    outerWidth: 1024,
    outerHeight: 700,
    screen: {
      width: 1024,
      height: 768,
      availWidth: 1024,
      availHeight: 728,
    },
  }),
  true,
);

console.log("a11y-floor.selfcheck: ok");
