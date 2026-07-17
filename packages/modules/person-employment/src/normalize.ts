/**
 * Empty-optional normalization (Story 3.1 / FR-5).
 * Empty → null; sentinel stand-ins are rejected — never stored.
 */

import { toLatinDigits } from "./digits";
import {
  MSG_SENTINEL_OPTIONAL_FA,
  PersonIdentityError,
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

function isSentinelOptional(trimmed: string): boolean {
  if (SENTINEL_OPTIONALS.has(trimmed)) return true;
  // Persian/Arabic-Indic zero must match Latin sentinel "0"
  return SENTINEL_OPTIONALS.has(toLatinDigits(trimmed));
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
    throw new PersonIdentityError(
      "SENTINEL_VALUE",
      MSG_SENTINEL_OPTIONAL_FA,
    );
  }
  return trimmed;
}

/** Required non-empty string — blank rejected. */
export function requireNonEmpty(
  value: string | null | undefined,
  messageFa: string,
): string {
  if (value === undefined || value === null) {
    throw new PersonIdentityError("VALIDATION", messageFa);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new PersonIdentityError("VALIDATION", messageFa);
  }
  if (isSentinelOptional(trimmed)) {
    throw new PersonIdentityError(
      "SENTINEL_VALUE",
      MSG_SENTINEL_OPTIONAL_FA,
    );
  }
  return trimmed;
}
