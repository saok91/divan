/**
 * Self-check for Jalali date-only round-trip (no Vitest in repo yet).
 * Run: pnpm dlx tsx apps/web/lib/jalali.selfcheck.ts
 */
import assert from "node:assert/strict";

import {
  formatGregorianDateOnly,
  formatJalaliDisplay,
  gregorianToJalali,
  jalaliToGregorian,
  parseGregorianDateOnly,
  parseJalaliInput,
  parseTimeInput,
} from "./jalali";

const sample = parseGregorianDateOnly("2026-07-16");
assert.ok(sample);
const j = gregorianToJalali(sample!);
const back = jalaliToGregorian(j);
assert.ok(back);
assert.equal(formatGregorianDateOnly(back!), "2026-07-16");

assert.equal(formatJalaliDisplay(j).includes("/"), true);

const typed = parseJalaliInput("۱۴۰۵/۰۴/۲۵");
assert.ok(typed);
const g2 = jalaliToGregorian(typed!);
assert.ok(g2);

const typedLatin = parseJalaliInput("1405/4/25");
assert.deepEqual(typedLatin, typed);

assert.equal(parseJalaliInput("1405/13/01"), null);
assert.equal(parseGregorianDateOnly("2026-13-01"), null);

assert.equal(parseTimeInput("۰۹:۳۰"), "09:30");
assert.equal(parseTimeInput("9:30"), "09:30");
assert.equal(parseTimeInput("24:00"), null);
assert.equal(parseTimeInput("12:60"), null);

console.log("jalali.selfcheck: ok");
