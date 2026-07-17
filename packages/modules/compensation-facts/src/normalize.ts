/**
 * Empty-optional normalization for compensation/contractual strings (Story 3.4).
 * Empty → null; sentinel stand-ins rejected — never stored.
 */

import {
  CompensationError,
  MSG_SENTINEL_OPTIONAL_FA,
} from "./errors";

const SENTINEL_OPTIONALS = new Set([
  "0",
  "N/A",
  "n/a",
  "N/a",
  "verified absence",
  "Verified Absence",
  "VERIFIED ABSENCE",
]);

const PERSIAN_ZERO = "۰";
const ARABIC_INDIC_ZERO = "٠";

function isSentinelOptional(trimmed: string): boolean {
  if (SENTINEL_OPTIONALS.has(trimmed)) return true;
  if (trimmed === PERSIAN_ZERO || trimmed === ARABIC_INDIC_ZERO) return true;
  return false;
}

/**
 * Normalize an optional string field.
 * - undefined / null / blank → null
 * - sentinel stand-ins → throw SENTINEL_VALUE
 * - otherwise trimmed value
 */
export function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (isSentinelOptional(trimmed)) {
    throw new CompensationError("SENTINEL_VALUE", MSG_SENTINEL_OPTIONAL_FA);
  }
  return trimmed;
}
