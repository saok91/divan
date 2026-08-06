/**
 * Self-check for Jalali date-only round-trip (no Vitest in repo yet).
 * Run: pnpm dlx tsx apps/web/lib/jalali.selfcheck.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  addJalaliMonths,
  formatGregorianDateOnly,
  formatJalaliDisplay,
  gregorianToJalali,
  jalaliMonthLength,
  jalaliMonthNames,
  jalaliToGregorian,
  jalaliYearRange,
  jalaliYearsAround,
  parseGregorianDateOnly,
  parseJalaliInput,
  parseTimeInput,
  setJalaliMonthYear,
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

// addJalaliMonths: year boundary + day clamp into shorter month
const acrossYear = addJalaliMonths({ jy: 1404, jm: 12, jd: 15 }, 1);
assert.deepEqual(acrossYear, { jy: 1405, jm: 1, jd: 15 });

const backYear = addJalaliMonths({ jy: 1405, jm: 1, jd: 10 }, -1);
assert.deepEqual(backYear, { jy: 1404, jm: 12, jd: 10 });

const esfandLen = jalaliMonthLength(1403, 12);
assert.ok(esfandLen === 29 || esfandLen === 30);
const clamped = addJalaliMonths({ jy: 1403, jm: 1, jd: 31 }, 11);
assert.equal(clamped.jy, 1403);
assert.equal(clamped.jm, 12);
assert.equal(clamped.jd, esfandLen);

const setClamped = setJalaliMonthYear({ jy: 1403, jm: 1, jd: 31 }, 12, 1403);
assert.deepEqual(setClamped, { jy: 1403, jm: 12, jd: esfandLen });

const names = jalaliMonthNames();
assert.equal(names.length, 12);
assert.equal(names[0], "فروردین");
assert.equal(names[11], "اسفند");

const range = jalaliYearRange(1405, 50);
assert.deepEqual(range, { min: 1355, max: 1455 });
const years = jalaliYearsAround(1405, 2);
assert.deepEqual(years, [1407, 1406, 1405, 1404, 1403]);

// Source chrome: logical prev → next with matching chevron + aria-label (Task 3)
const here = path.dirname(fileURLToPath(import.meta.url));
const pickerSrc = readFileSync(
  path.join(here, "../components/jalali-date-picker.tsx"),
  "utf8",
);
const prevIdx = pickerSrc.indexOf('aria-label="ماه قبل"');
const nextIdx = pickerSrc.indexOf('aria-label="ماه بعد"');
assert.ok(prevIdx >= 0, "prev month control must exist");
assert.ok(nextIdx >= 0, "next month control must exist");
assert.ok(
  prevIdx < nextIdx,
  "prev control must precede next in logical DOM order (RTL inline-start)",
);
const prevBlock = pickerSrc.slice(prevIdx, prevIdx + 220);
const nextBlock = pickerSrc.slice(nextIdx, nextIdx + 220);
assert.match(
  prevBlock,
  /ChevronRightIcon/,
  "prev («ماه قبل») must use ChevronRight (mirrored RTL chrome)",
);
assert.match(
  nextBlock,
  /ChevronLeftIcon/,
  "next («ماه بعد») must use ChevronLeft (mirrored RTL chrome)",
);
assert.match(pickerSrc, /انتخاب ماه/);
assert.match(pickerSrc, /انتخاب سال/);
assert.match(pickerSrc, /فهرست ماه‌ها/);
assert.match(pickerSrc, /فهرست سال‌ها/);
assert.match(pickerSrc, /aria-controls/);
assert.match(
  pickerSrc,
  /showMonthStep \? \(/,
  "prev/next month chrome must hide while month/year panels are open",
);

console.log("jalali.selfcheck: ok");
