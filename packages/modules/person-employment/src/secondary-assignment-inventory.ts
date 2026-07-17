/**
 * Provisional AR-SECONDARY inventory registry stub (Story 3.8 / FR-12).
 *
 * Codes below are **pending AR-SECONDARY artifact approval**. Fail-closed:
 * unknown / empty / sentinel reasonTypes are rejected. When the approved
 * inventory lands, replace provisional codes without changing schema shape.
 *
 * Labels in comments are Persian for operators; machine codes are Latin.
 */

import {
  MSG_SECONDARY_REASON_OUT_OF_INVENTORY_FA,
  MSG_SECONDARY_REASON_REQUIRED_FA,
  SecondaryAssignmentError,
} from "./errors";

/**
 * Finite provisional reason/type codes.
 * `acting_manager` — مدیر موقت / جانشین (demo seed).
 * `cross_dept_support` — پشتیبانی بین‌دپارتمانی (optional concurrent demo).
 */
export const AR_SECONDARY_INVENTORY = [
  "acting_manager",
  "cross_dept_support",
] as const;

export type ArSecondaryReasonType = (typeof AR_SECONDARY_INVENTORY)[number];

const INVENTORY_SET = new Set<string>(AR_SECONDARY_INVENTORY);

/** Normalize Latin reason/type: trim + lowercase; reject empty/sentinel. */
export function normalizeReasonType(raw: string | null | undefined): string {
  if (raw === undefined || raw === null) {
    throw new SecondaryAssignmentError(
      "SECONDARY_REASON_REQUIRED",
      MSG_SECONDARY_REASON_REQUIRED_FA,
      "null_or_undefined",
    );
  }
  if (typeof raw !== "string") {
    throw new SecondaryAssignmentError(
      "SECONDARY_REASON_REQUIRED",
      MSG_SECONDARY_REASON_REQUIRED_FA,
      "not_string",
    );
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) {
    throw new SecondaryAssignmentError(
      "SECONDARY_REASON_REQUIRED",
      MSG_SECONDARY_REASON_REQUIRED_FA,
      "empty",
    );
  }
  if (
    trimmed === "n/a" ||
    trimmed === "na" ||
    trimmed === "-" ||
    trimmed === "null" ||
    trimmed === "undefined"
  ) {
    throw new SecondaryAssignmentError(
      "SECONDARY_REASON_REQUIRED",
      MSG_SECONDARY_REASON_REQUIRED_FA,
      `sentinel:${trimmed}`,
    );
  }
  return trimmed;
}

/**
 * Fail-closed inventory gate. Returns normalized code when approved.
 */
export function assertReasonTypeInInventory(
  reasonType: string | null | undefined,
): ArSecondaryReasonType {
  const normalized = normalizeReasonType(reasonType);
  if (!INVENTORY_SET.has(normalized)) {
    throw new SecondaryAssignmentError(
      "SECONDARY_REASON_OUT_OF_INVENTORY",
      MSG_SECONDARY_REASON_OUT_OF_INVENTORY_FA,
      normalized,
    );
  }
  return normalized as ArSecondaryReasonType;
}

export function isReasonTypeInInventory(reasonType: string): boolean {
  try {
    assertReasonTypeInInventory(reasonType);
    return true;
  } catch {
    return false;
  }
}
