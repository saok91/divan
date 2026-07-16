/** Persian (Eastern Arabic) digits ۰–۹ */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
/** Arabic-Indic digits ٠–٩ */
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const LATIN_TO_PERSIAN: Record<string, string> = Object.fromEntries(
  [..."0123456789"].map((d, i) => [d, PERSIAN_DIGITS[i]!]),
);

const ANY_DIGIT_TO_LATIN: Record<string, string> = {
  ...Object.fromEntries([..."0123456789"].map((d) => [d, d])),
  ...Object.fromEntries(
    [...PERSIAN_DIGITS].map((d, i) => [d, String(i)]),
  ),
  ...Object.fromEntries(
    [...ARABIC_INDIC_DIGITS].map((d, i) => [d, String(i)]),
  ),
};

/** Common thousand / decimal separators to strip for match normalization. */
const SEPARATORS = /[\s,٬٫,،]/g;

/**
 * Map Latin and Arabic-Indic digits to Persian digits (۰–۹).
 * Non-digit characters are preserved.
 */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9٠-٩]/g, (ch) => {
    const latin = ANY_DIGIT_TO_LATIN[ch];
    if (latin === undefined) return ch;
    return LATIN_TO_PERSIAN[latin] ?? ch;
  });
}

/**
 * Map Persian / Arabic-Indic digits to Latin 0–9.
 * Non-digit characters are preserved.
 */
export function toLatinDigits(input: string | number): string {
  return String(input).replace(/[۰-۹٠-٩]/g, (ch) => ANY_DIGIT_TO_LATIN[ch] ?? ch);
}

/**
 * Strip separators and map all digit scripts to Latin for comparison/matching.
 */
export function normalizeDigitsForMatch(input: string): string {
  return toLatinDigits(input).replace(SEPARATORS, "");
}

/** Display counts/codes with Persian digits (no grouping). */
export function formatPersianInteger(n: number): string {
  if (!Number.isFinite(n)) return toPersianDigits("0");
  const rounded = Math.trunc(n);
  const sign = rounded < 0 ? "−" : "";
  return sign + toPersianDigits(String(Math.abs(rounded)));
}

export type FormatPersianCurrencyOptions = {
  /** Optional suffix label (e.g. «ریال») — appended after the amount. */
  currencyLabel?: string;
};

/**
 * Persian digits + thousand separator `٬`.
 * Negatives use minus prefix `−` (OQ-5 parentheses policy deferred).
 */
export function formatPersianCurrency(
  n: number,
  options: FormatPersianCurrencyOptions = {},
): string {
  if (!Number.isFinite(n)) {
    const zero = toPersianDigits("0");
    return options.currencyLabel ? `${zero} ${options.currencyLabel}` : zero;
  }

  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(Math.trunc(n));
  const grouped = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  const amount = sign + toPersianDigits(grouped);

  return options.currencyLabel
    ? `${amount} ${options.currencyLabel}`
    : amount;
}
