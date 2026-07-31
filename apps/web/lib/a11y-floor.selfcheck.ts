/**
 * Self-check: secondary button contrast + operational copy invariants + viewport gate.
 * Run: pnpm --filter @divan/web exec tsx lib/a11y-floor.selfcheck.ts
 */
import assert from "node:assert/strict";

import { shouldActivateViewportGate } from "./viewport-gate";
import {
  operationalCopy,
  staleRecalcMessage,
} from "./operational-copy";

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

/** Nudged DESIGN primary pairs used by secondary buttons in globals.css */
const LIGHT_PRIMARY = "#006dff";
const DARK_PRIMARY = "#1e6fe0";

assert.ok(
  contrastRatio("#ffffff", LIGHT_PRIMARY) >= 4.5,
  `light secondary contrast ${contrastRatio("#ffffff", LIGHT_PRIMARY)}`,
);
assert.ok(
  contrastRatio("#ffffff", DARK_PRIMARY) >= 4.5,
  `dark secondary contrast ${contrastRatio("#ffffff", DARK_PRIMARY)}`,
);

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
