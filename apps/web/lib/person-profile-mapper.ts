/**
 * Person profile DTO helpers (Story 5.2 / FR-34).
 * Pure omit / prior / Scheduled≠current contracts — no Prisma, no parallel SoT.
 */

import type {
  CurrentPersonState,
  EmploymentRecord,
  EnabledProfileField,
  PersonProfileFieldKey,
  ScheduledFutureChange,
} from "@divan/person-employment";

export type ProfileIdentityFieldRow = {
  personFieldKey: PersonProfileFieldKey;
  labelFa: string;
  value: string;
  sensitivity: string | null;
};

export type ProfilePriorEmploymentRow = {
  id: string;
  startDate: string;
  endDateExclusive: string;
  collaborationType: string | null;
  terminationReason: string | null;
};

export type ProfileOrgJobLabels = {
  teamNameById: Record<string, string>;
  roleNameById: Record<string, string>;
  jobTitleNameById: Record<string, string>;
  ladderNameById: Record<string, string>;
  gradeNameById: Record<string, string>;
  orgUnitNameById: Record<string, string>;
};

export type ProfileDictionaryElement = {
  elementId: string;
  disposition: string;
  enabled: boolean;
  labelFa: string;
  sensitivity: string | null;
};

/** Fallback when dictionary row missing — matches compensation category registry. */
export const COMPENSATION_CATEGORY_SENSITIVITY = "sensitive";

const EMPTY_ORG_JOB_LABELS: ProfileOrgJobLabels = {
  teamNameById: {},
  roleNameById: {},
  jobTitleNameById: {},
  ladderNameById: {},
  gradeNameById: {},
  orgUnitNameById: {},
};

function hasPresentNestedField(
  block: object | null | undefined,
  key: string,
): boolean {
  if (!block || typeof block !== "object") return false;
  if (!Object.hasOwn(block, key)) return false;
  const raw = (block as Record<string, unknown>)[key];
  if (raw === undefined || raw === null) return false;
  return String(raw).trim() !== "";
}

/**
 * True when compensation/contractual facts have at least one present field to render.
 * Key present with `null` (assembler: permitted, no facts) ⇒ false.
 */
export function stateHasCompensationCategory(
  state: CurrentPersonState,
): boolean {
  const compensation = Object.hasOwn(state, "compensation")
    ? state.compensation
    : undefined;
  const contractual = Object.hasOwn(state, "contractual")
    ? state.contractual
    : undefined;
  if (
    hasPresentNestedField(compensation, "amount") ||
    hasPresentNestedField(compensation, "currency")
  ) {
    return true;
  }
  if (
    hasPresentNestedField(contractual, "contractingEntity") ||
    hasPresentNestedField(contractual, "contractEndDateExclusive") ||
    hasPresentNestedField(contractual, "collaborationType")
  ) {
    return true;
  }
  return false;
}

/** Resolve labelFa + sensitivity from enabled+approved dictionary rows. */
export function dictionaryFieldMeta(
  elements: readonly ProfileDictionaryElement[],
  elementId: string,
  fallbackLabelFa: string,
): { labelFa: string; sensitivity: string } {
  const row = elements.find(
    (e) =>
      e.elementId === elementId &&
      e.enabled &&
      e.disposition === "approve",
  );
  const sensitivity =
    row?.sensitivity?.trim() || COMPENSATION_CATEGORY_SENSITIVITY;
  return {
    labelFa: row?.labelFa?.trim() || fallbackLabelFa,
    sensitivity,
  };
}

/**
 * Identity rows for profile: dictionary-enabled ∩ present person keys only.
 * Missing permission / disabled fields ⇒ no row (DOM omit contract).
 */
export function presentIdentityFieldRows(
  person: CurrentPersonState["person"],
  enabledFields: readonly EnabledProfileField[],
): ProfileIdentityFieldRow[] {
  const rows: ProfileIdentityFieldRow[] = [];
  for (const field of enabledFields) {
    const key = field.personFieldKey;
    if (!Object.hasOwn(person, key)) continue;
    const raw = person[key as keyof typeof person];
    if (raw === undefined || raw === null) continue;
    const value = typeof raw === "string" ? raw.trim() : String(raw);
    if (!value) continue;
    rows.push({
      personFieldKey: key,
      labelFa: field.labelFa,
      value,
      sensitivity: field.sensitivity,
    });
  }
  return rows;
}

/** Header display name only from dictionary-present identity rows (DOM omit). */
export function displayNameFromIdentityRows(
  rows: readonly ProfileIdentityFieldRow[],
): string {
  const given = rows.find((r) => r.personFieldKey === "givenName")?.value;
  const family = rows.find((r) => r.personFieldKey === "familyName")?.value;
  return [given, family].filter((p): p is string => Boolean(p?.trim())).join(" ");
}

/**
 * Prior employments = closed intervals ended on/before asOf.
 * Open intervals and future endDateExclusive (still current as of asOf) excluded.
 */
export function filterPriorEmployments(
  employments: readonly EmploymentRecord[],
  asOf: string,
): ProfilePriorEmploymentRow[] {
  return employments
    .filter((e) => {
      const end = e.endDateExclusive?.trim() ?? "";
      if (!end) return false;
      return end <= asOf;
    })
    .map((e) => ({
      id: e.id,
      startDate: e.startDate,
      endDateExclusive: e.endDateExclusive as string,
      collaborationType: e.collaborationType,
      terminationReason: e.terminationReason,
    }));
}

/**
 * Scheduled futures must never appear as current Employment/Assignment facts.
 * Returns false when any scheduled id collides with current employment id
 * (assembler contract regression guard for selfcheck).
 */
export function scheduledChangesAreSeparateFromCurrent(
  state: CurrentPersonState,
): boolean {
  const currentEmpId = state.employment?.id ?? null;
  const allScheduled: ScheduledFutureChange[] = [
    ...state.scheduledChanges,
    ...state.plannedChangesThroughAsOf,
  ];
  if (allScheduled.some((c) => c.resolvedStatus !== "Scheduled")) {
    return false;
  }
  if (
    currentEmpId &&
    allScheduled.some((c) => c.id === currentEmpId)
  ) {
    return false;
  }
  return true;
}

export function labelLookup(
  map: Record<string, string>,
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  const name = map[id]?.trim();
  return name ? name : null;
}

export function emptyProfileOrgJobLabels(): ProfileOrgJobLabels {
  return { ...EMPTY_ORG_JOB_LABELS };
}

export function mapsToProfileOrgJobLabels(input: {
  teamNameById: ReadonlyMap<string, string>;
  roleNameById: ReadonlyMap<string, string>;
  jobTitleNameById: ReadonlyMap<string, string>;
  ladderNameById: ReadonlyMap<string, string>;
  gradeNameById: ReadonlyMap<string, string>;
  orgUnitNameById?: ReadonlyMap<string, string>;
}): ProfileOrgJobLabels {
  const toRecord = (m: ReadonlyMap<string, string>) =>
    Object.fromEntries([...m.entries()]);
  return {
    teamNameById: toRecord(input.teamNameById),
    roleNameById: toRecord(input.roleNameById),
    jobTitleNameById: toRecord(input.jobTitleNameById),
    ladderNameById: toRecord(input.ladderNameById),
    gradeNameById: toRecord(input.gradeNameById),
    orgUnitNameById: toRecord(input.orgUnitNameById ?? new Map()),
  };
}
