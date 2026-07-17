/**
 * Provisional AR-ACCESS management-role registry stub (Story 3.9 / FR-13).
 *
 * Role codes below are **pending AR-ACCESS artifact approval**. Fail-closed:
 * empty / sentinel codes rejected at assert helpers. Unknown Role codes are
 * simply not a manager designation (not an error by themselves).
 *
 * When AR-ACCESS lands, replace provisional codes without inventing
 * acting / interim / co-manager / reorg winner policies here.
 */

import type { OrgUnitType } from "./org-unit-invariants";
import {
  ManagementRelationshipError,
  MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
} from "./errors";

/**
 * Provisional middle / senior manager Role codes + approved senior target types.
 * `ROLE-MID-MGR` — مدیر میانی (Team manager via Primary on TEAM).
 * `ROLE-SNR-MGR` — مدیر ارشد (Department-parent subtree scope — see README).
 */
export const AR_MANAGEMENT_ROLE_REGISTRY = {
  middleManagerRoleCodes: ["ROLE-MID-MGR"] as const,
  seniorManagerRoleCodes: ["ROLE-SNR-MGR"] as const,
  /**
   * BR-ORG-017 approved organization levels for senior-manager targeting.
   * MVP senior rule scopes to DEPARTMENT (parent of manager's Team) — see
   * `resolveSeniorManagerScopeOrgUnitAsOf`.
   */
  seniorManagerTargetUnitTypes: [
    "TEAM",
    "DEPARTMENT",
    "BUSINESS_UNIT",
    "LEGAL_ENTITY",
  ] as const satisfies readonly OrgUnitType[],
} as const;

export type ArMiddleManagerRoleCode =
  (typeof AR_MANAGEMENT_ROLE_REGISTRY.middleManagerRoleCodes)[number];

export type ArSeniorManagerRoleCode =
  (typeof AR_MANAGEMENT_ROLE_REGISTRY.seniorManagerRoleCodes)[number];

const MIDDLE_SET = new Set<string>(
  AR_MANAGEMENT_ROLE_REGISTRY.middleManagerRoleCodes,
);
const SENIOR_SET = new Set<string>(
  AR_MANAGEMENT_ROLE_REGISTRY.seniorManagerRoleCodes,
);
const SENIOR_TARGET_SET = new Set<string>(
  AR_MANAGEMENT_ROLE_REGISTRY.seniorManagerTargetUnitTypes,
);

/** Reject empty / sentinel Role code strings at registry assert helpers. */
export function normalizeManagementRoleCode(
  raw: string | null | undefined,
): string {
  if (raw === undefined || raw === null) {
    throw new ManagementRelationshipError(
      "MANAGEMENT_ROLE_REGISTRY_INVALID",
      MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
      "null_or_undefined",
    );
  }
  if (typeof raw !== "string") {
    throw new ManagementRelationshipError(
      "MANAGEMENT_ROLE_REGISTRY_INVALID",
      MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
      "not_string",
    );
  }
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.length === 0) {
    throw new ManagementRelationshipError(
      "MANAGEMENT_ROLE_REGISTRY_INVALID",
      MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
      "empty",
    );
  }
  if (
    trimmed === "N/A" ||
    trimmed === "NA" ||
    trimmed === "-" ||
    trimmed === "NULL" ||
    trimmed === "UNDEFINED"
  ) {
    throw new ManagementRelationshipError(
      "MANAGEMENT_ROLE_REGISTRY_INVALID",
      MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
      `sentinel:${trimmed}`,
    );
  }
  return trimmed;
}

export function isMiddleManagerRoleCode(roleCode: string): boolean {
  try {
    return MIDDLE_SET.has(normalizeManagementRoleCode(roleCode));
  } catch {
    return false;
  }
}

export function isSeniorManagerRoleCode(roleCode: string): boolean {
  try {
    return SENIOR_SET.has(normalizeManagementRoleCode(roleCode));
  } catch {
    return false;
  }
}

export function isApprovedSeniorManagerTargetUnitType(
  unitType: string,
): boolean {
  return SENIOR_TARGET_SET.has(unitType);
}

/**
 * Assert registry integrity at load/selfcheck time.
 * Rejects empty/sentinel entries in role code lists.
 */
export function assertManagementRoleRegistryValid(): void {
  const middle = [
    ...AR_MANAGEMENT_ROLE_REGISTRY.middleManagerRoleCodes,
  ] as string[];
  const senior = [
    ...AR_MANAGEMENT_ROLE_REGISTRY.seniorManagerRoleCodes,
  ] as string[];
  if (middle.length === 0) {
    throw new ManagementRelationshipError(
      "MANAGEMENT_ROLE_REGISTRY_INVALID",
      MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
      "empty_middle_codes",
    );
  }
  if (senior.length === 0) {
    throw new ManagementRelationshipError(
      "MANAGEMENT_ROLE_REGISTRY_INVALID",
      MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
      "empty_senior_codes",
    );
  }
  const middleNorm = middle.map((c) => normalizeManagementRoleCode(c));
  const seniorNorm = senior.map((c) => normalizeManagementRoleCode(c));
  const seniorSet = new Set(seniorNorm);
  for (const code of middleNorm) {
    if (seniorSet.has(code)) {
      throw new ManagementRelationshipError(
        "MANAGEMENT_ROLE_REGISTRY_INVALID",
        MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
        `overlap_middle_senior:${code}`,
      );
    }
  }
  const allowedTargets = new Set<string>([
    "TEAM",
    "DEPARTMENT",
    "BUSINESS_UNIT",
    "LEGAL_ENTITY",
  ]);
  for (const t of AR_MANAGEMENT_ROLE_REGISTRY.seniorManagerTargetUnitTypes) {
    if (!allowedTargets.has(t)) {
      throw new ManagementRelationshipError(
        "MANAGEMENT_ROLE_REGISTRY_INVALID",
        MSG_MANAGEMENT_ROLE_REGISTRY_INVALID_FA,
        `bad_target_type:${t}`,
      );
    }
  }
}
