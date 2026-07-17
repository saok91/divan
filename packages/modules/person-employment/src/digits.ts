/**
 * Digit normalization for Personnel Code / national ID / mobile (Stories 3.1–3.3).
 * Accept Latin, Persian (۰–۹), and Arabic-Indic (٠–٩); store Latin canonical.
 */

import {
  MSG_MOBILE_PHONE_FORMAT_FA,
  PersonIdentityError,
} from "./errors";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const ANY_DIGIT_TO_LATIN: Record<string, string> = {
  ...Object.fromEntries([..."0123456789"].map((d) => [d, d])),
  ...Object.fromEntries([...PERSIAN_DIGITS].map((d, i) => [d, String(i)])),
  ...Object.fromEntries(
    [...ARABIC_INDIC_DIGITS].map((d, i) => [d, String(i)]),
  ),
};

/** Whitespace / locale separators only — do not strip `-`/`.` (Personnel Code / national ID). */
const SEPARATORS = /[\s,٬٫,،]/g;

/** Map Persian / Arabic-Indic digits to Latin 0–9; preserve other chars. */
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => ANY_DIGIT_TO_LATIN[ch] ?? ch);
}

/** Latin digits + strip separators — canonical form for uniqueness match. */
export function normalizeDigitsForMatch(input: string): string {
  return toLatinDigits(input).replace(SEPARATORS, "");
}

/**
 * Iranian mobile product rule (dictionary format metadata / Story 3.3).
 * Canonical store: `09XXXXXXXXX` (11 Latin digits).
 * Accepts Persian/Arabic-Indic digits; normalizes `+98` / `98` / `0098` prefixes.
 */
export function normalizeIranianMobilePhone(raw: string): string {
  const latin = toLatinDigits(raw.trim());
  let digits = latin.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0098")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("98") && digits.length >= 12) {
    digits = `0${digits.slice(2)}`;
  }
  // 9XXXXXXXXX (10 digits without leading 0) → 09XXXXXXXXX
  if (/^9\d{9}$/.test(digits)) digits = `0${digits}`;

  if (!/^09\d{9}$/.test(digits)) {
    throw new PersonIdentityError(
      "MOBILE_PHONE_FORMAT",
      MSG_MOBILE_PHONE_FORMAT_FA,
    );
  }
  return digits;
}
