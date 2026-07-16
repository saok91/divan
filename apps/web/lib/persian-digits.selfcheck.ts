/**
 * Self-check for Persian digit formatting helpers (no Vitest in repo yet).
 * Run: pnpm --filter @divan/web exec tsx lib/persian-digits.selfcheck.ts
 */
import assert from "node:assert/strict";

import {
  formatPersianCurrency,
  formatPersianInteger,
  normalizeDigitsForMatch,
  toLatinDigits,
  toPersianDigits,
} from "./persian-digits";

assert.equal(toPersianDigits("1280"), "۱۲۸۰");
assert.equal(toPersianDigits("١٢٣"), "۱۲۳");
assert.equal(toPersianDigits("۱۲۳"), "۱۲۳");
assert.equal(toPersianDigits(42), "۴۲");

assert.equal(toLatinDigits("۱۲۳"), "123");
assert.equal(toLatinDigits("١٢٣"), "123");
assert.equal(toLatinDigits("123"), "123");

assert.equal(normalizeDigitsForMatch("۱۲٬۳۴۵"), "12345");
assert.equal(normalizeDigitsForMatch("1,234"), "1234");
assert.equal(normalizeDigitsForMatch("کد ۱۲۳"), "کد123");

assert.equal(formatPersianInteger(3), "۳");
assert.equal(formatPersianInteger(-12), "−۱۲");

assert.equal(formatPersianCurrency(12345678), "۱۲٬۳۴۵٬۶۷۸");
assert.equal(formatPersianCurrency(-12345), "−۱۲٬۳۴۵");
assert.equal(
  formatPersianCurrency(1234, { currencyLabel: "ریال" }),
  "۱٬۲۳۴ ریال",
);

console.log("persian-digits.selfcheck: ok");
