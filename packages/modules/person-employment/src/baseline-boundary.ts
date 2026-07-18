/**
 * Shared Baseline boundary reader (Story 4.10 / FR-26).
 * Single source for write-path conflict policy (when omitted) and as-of disclosure.
 * Do not invent a default epoch when unset.
 * Invalid env fails closed (throw) — never silently disable the gate.
 */

import { parseDateOnly } from "@divan/temporal-engine";

import {
  MSG_BASELINE_BOUNDARY_INVALID_FA,
  PersonIdentityError,
} from "./errors";

export const BASELINE_BOUNDARY_ENV = "DIVAN_BASELINE_BOUNDARY_DATE";

/**
 * Resolve configured Baseline boundary date-only, or null when unset.
 * Throws PersonIdentityError when env is present but not date-only.
 * Callers that pass an explicit `ConflictPolicy.baselineBoundaryDate` override this.
 */
export function getBaselineBoundaryDate(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env[BASELINE_BOUNDARY_ENV]?.trim();
  if (!raw) return null;
  const parsed = parseDateOnly(raw);
  if (!parsed.ok) {
    throw new PersonIdentityError(
      "VALIDATION",
      MSG_BASELINE_BOUNDARY_INVALID_FA,
      `invalid ${BASELINE_BOUNDARY_ENV}: ${parsed.reason}`,
    );
  }
  return parsed.value;
}
