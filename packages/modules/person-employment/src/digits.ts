/**
 * Digit normalization for Personnel Code / national ID uniqueness (Story 3.1).
 * Accept Latin, Persian (۰–۹), and Arabic-Indic (٠–٩); store Latin canonical.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const ANY_DIGIT_TO_LATIN: Record<string, string> = {
  ...Object.fromEntries([..."0123456789"].map((d) => [d, d])),
  ...Object.fromEntries([...PERSIAN_DIGITS].map((d, i) => [d, String(i)])),
  ...Object.fromEntries(
    [...ARABIC_INDIC_DIGITS].map((d, i) => [d, String(i)]),
  ),
};

const SEPARATORS = /[\s,٬٫,،]/g;

/** Map Persian / Arabic-Indic digits to Latin 0–9; preserve other chars. */
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => ANY_DIGIT_TO_LATIN[ch] ?? ch);
}

/** Latin digits + strip separators — canonical form for uniqueness match. */
export function normalizeDigitsForMatch(input: string): string {
  return toLatinDigits(input).replace(SEPARATORS, "");
}
