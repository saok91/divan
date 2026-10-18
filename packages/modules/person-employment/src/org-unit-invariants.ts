/**
 * Pure Organizational Unit invariants (Story 3.5 / FR-9).
 * Reuses @divan/temporal-engine — do not fork date/interval helpers.
 */

import {
  dateOnlyInInterval,
  parseDateOnly,
} from "@divan/temporal-engine";

import {
  MSG_CHILD_OUTSIDE_PARENT_VALIDITY_FA,
  MSG_INVALID_ORG_INTERVAL_FA,
  MSG_INVALID_PARENT_TYPE_FA,
  OrgUnitError,
} from "./errors";

export const ORG_UNIT_TYPES = [
  "LEGAL_ENTITY",
  "BUSINESS_UNIT",
  "DEPARTMENT",
  "TEAM",
] as const;

export type OrgUnitType = (typeof ORG_UNIT_TYPES)[number];

export type OrgInterval = {
  startDate: string;
  endDateExclusive: string | null;
};

/** Required parent type for each child type; LE has no parent. */
export const REQUIRED_PARENT_TYPE: Record<
  OrgUnitType,
  OrgUnitType | null
> = {
  LEGAL_ENTITY: null,
  BUSINESS_UNIT: "LEGAL_ENTITY",
  DEPARTMENT: "BUSINESS_UNIT",
  TEAM: "DEPARTMENT",
};

export function isOrgUnitType(value: string): value is OrgUnitType {
  return (ORG_UNIT_TYPES as readonly string[]).includes(value);
}

/**
 * Validate date-only half-open interval [start, endExclusive).
 * Blank endExclusive → null (unbounded open).
 */
export function assertValidOrgInterval(
  start: string,
  endExclusive: string | null | undefined,
): OrgInterval {
  const startTrimmed = typeof start === "string" ? start.trim() : "";
  const startParsed = parseDateOnly(startTrimmed);
  if (!startParsed.ok) {
    throw new OrgUnitError(
      "INVALID_ORG_INTERVAL",
      MSG_INVALID_ORG_INTERVAL_FA,
      `invalid_start:${startParsed.reason}`,
    );
  }

  let endValue: string | null = null;
  if (endExclusive !== undefined && endExclusive !== null) {
    if (typeof endExclusive !== "string") {
      throw new OrgUnitError(
        "INVALID_ORG_INTERVAL",
        MSG_INVALID_ORG_INTERVAL_FA,
        "invalid_end:not_string",
      );
    }
    const trimmed = endExclusive.trim();
    if (trimmed.length === 0) {
      endValue = null;
    } else {
      const endParsed = parseDateOnly(trimmed);
      if (!endParsed.ok) {
        throw new OrgUnitError(
          "INVALID_ORG_INTERVAL",
          MSG_INVALID_ORG_INTERVAL_FA,
          `invalid_end:${endParsed.reason}`,
        );
      }
      endValue = endParsed.value;
      if (endValue <= startParsed.value) {
        throw new OrgUnitError(
          "INVALID_ORG_INTERVAL",
          MSG_INVALID_ORG_INTERVAL_FA,
          "end_not_after_start",
        );
      }
    }
  }

  return { startDate: startParsed.value, endDateExclusive: endValue };
}

/**
 * LE → no parent; BU→LE; Dept→BU; Team→Dept.
 * Rejects skip-level / wrong-type parents.
 */
export function assertValidParentType(
  childType: OrgUnitType,
  parentType: OrgUnitType | null,
): void {
  const required = REQUIRED_PARENT_TYPE[childType];
  if (required === null) {
    if (parentType !== null) {
      throw new OrgUnitError(
        "INVALID_PARENT_TYPE",
        MSG_INVALID_PARENT_TYPE_FA,
        "legal_entity_must_have_null_parent",
      );
    }
    return;
  }
  if (parentType !== required) {
    throw new OrgUnitError(
      "INVALID_PARENT_TYPE",
      MSG_INVALID_PARENT_TYPE_FA,
      `expected_parent:${required}:got:${parentType ?? "null"}`,
    );
  }
}

/**
 * Child interval must fall within parent interval (child ⊆ parent).
 * Open child cannot outlive open-or-closed parent ends.
 * For every date where child is active, parent must be active.
 */
export function assertChildWithinParent(
  child: OrgInterval,
  parent: OrgInterval,
  _asOf?: string,
): void {
  // Containment covers the full interval regardless of the viewing date.
  void _asOf;
  if (child.startDate < parent.startDate) {
    throw new OrgUnitError(
      "CHILD_OUTSIDE_PARENT_VALIDITY",
      MSG_CHILD_OUTSIDE_PARENT_VALIDITY_FA,
      "child_starts_before_parent",
    );
  }

  if (parent.endDateExclusive !== null) {
    if (child.endDateExclusive === null) {
      throw new OrgUnitError(
        "CHILD_OUTSIDE_PARENT_VALIDITY",
        MSG_CHILD_OUTSIDE_PARENT_VALIDITY_FA,
        "open_child_outlives_closed_parent",
      );
    }
    if (child.endDateExclusive > parent.endDateExclusive) {
      throw new OrgUnitError(
        "CHILD_OUTSIDE_PARENT_VALIDITY",
        MSG_CHILD_OUTSIDE_PARENT_VALIDITY_FA,
        "child_ends_after_parent",
      );
    }
  }
}

/** Active at as-of D ⇔ start ≤ D < endExclusive (null end = +∞). */
export function isOrgUnitActiveAsOf(
  unit: OrgInterval,
  asOfDate: string,
): boolean {
  const asOf = parseDateOnly(asOfDate);
  if (!asOf.ok) {
    throw new OrgUnitError(
      "INVALID_ORG_INTERVAL",
      MSG_INVALID_ORG_INTERVAL_FA,
      `invalid_as_of:${asOf.reason}`,
    );
  }
  return dateOnlyInInterval(
    asOf.value,
    unit.startDate,
    unit.endDateExclusive,
  );
}
