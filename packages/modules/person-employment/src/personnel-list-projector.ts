/**
 * Personnel list-row projector (Story 5.1 / FR-33).
 * Maps Epic 4 current-state assembler output → list columns.
 * No parallel SoT — consumers must pass authorized Person ids only.
 */

/** Soft list cap via AD-7 resolver (Story 10.1). */
import { resolveSettingNumber } from "@divan/app-settings";
import type { CurrentPersonState } from "./current-person-state";

export function PERSONNEL_LIST_MAX_ROWS(): number {
  return resolveSettingNumber("list.personnel_max_rows").value;
}

/** UUID v4-ish Person.id shape (not fixture `person:a1`). */
export function isPersonUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export type PersonnelListRowDto = {
  id: string;
  personnelCode: string;
  givenName: string;
  familyName: string;
  team: string;
  role: string;
  /** Job title label — independent of organizational role for search. */
  jobTitle: string;
  ladder: string;
  grade: string;
  collaborationType: string;
  /** Empty string when compensation category omitted (never null-as-zero theater). */
  compensation: string;
  /** Empty when compensation category omitted; never "—" placeholder theater. */
  contractEndDate: string;
  contractParty: string;
  currentColleague: "yes" | "no";
  mobilePhone?: string;
  /** Present only when actor has compensation.read and value was projected. */
  compensationPermitted: boolean;
  /** True when operational fields were disposed — never fabricate prior values. */
  disposalLimited: boolean;
  /** Persian disclosure when disposalLimited; null otherwise. */
  disposalMessageFa: string | null;
};

export type PersonnelListLabelBundle = {
  teamNameById: ReadonlyMap<string, string>;
  roleNameById: ReadonlyMap<string, string>;
  jobTitleNameById: ReadonlyMap<string, string>;
  ladderNameById: ReadonlyMap<string, string>;
  gradeNameById: ReadonlyMap<string, string>;
};

const EMPTY_LABELS: PersonnelListLabelBundle = {
  teamNameById: new Map(),
  roleNameById: new Map(),
  jobTitleNameById: new Map(),
  ladderNameById: new Map(),
  gradeNameById: new Map(),
};

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : "—";
}

/**
 * `currentColleague` = yes when active Employment (and thus current membership
 * semantics) exist as-of the assembler facts date. Scheduled future must not
 * invent current columns — assembler already keeps facts at today for planned.
 */
export function currentColleagueFromState(
  state: CurrentPersonState,
): "yes" | "no" {
  return state.employment != null ? "yes" : "no";
}

/**
 * Project one authorized current-state snapshot into a list row.
 * Freshness-blocked results must not reach this helper (caller excludes them).
 * Disposed operational fields are omitted (dash/empty) with explicit disclosure.
 */
export function projectPersonnelListRow(
  state: CurrentPersonState,
  labels: PersonnelListLabelBundle = EMPTY_LABELS,
): PersonnelListRowDto {
  const person = state.person;
  const primary = state.primaryAssignment;
  const teamId = state.teamMembership?.teamId ?? primary?.teamId;
  const roleId = primary?.organizationalRoleId;
  const jobTitleId = primary?.jobTitleId;
  const ladderId = primary?.ladderId;
  const gradeId = primary?.gradeId;

  const disposed = new Set(state.disposalDisclosure.disposedFieldKeys);
  const disposalLimited = state.disposalDisclosure.limited;
  const fieldOrDash = (
    key: string,
    value: string | null | undefined,
  ): string => {
    if (disposed.has(key)) return "—";
    return dash(value);
  };

  const hasCompensation = state.compensation !== undefined;
  const amount = hasCompensation
    ? (state.compensation?.amount ?? null)
    : null;
  const contractual = hasCompensation ? state.contractual : undefined;

  const jobTitle = jobTitleId
    ? dash(labels.jobTitleNameById.get(jobTitleId))
    : "—";
  const role = roleId ? dash(labels.roleNameById.get(roleId)) : "—";

  const mobile =
    disposed.has("mobilePhone") || !person.mobilePhone?.trim()
      ? undefined
      : person.mobilePhone.trim();

  return {
    id: state.personId,
    personnelCode: fieldOrDash("personnelCode", person.personnelCode),
    givenName: fieldOrDash("givenName", person.givenName),
    familyName: fieldOrDash("familyName", person.familyName),
    team: teamId ? dash(labels.teamNameById.get(teamId)) : "—",
    role,
    jobTitle,
    ladder: ladderId ? dash(labels.ladderNameById.get(ladderId)) : "—",
    grade: gradeId ? dash(labels.gradeNameById.get(gradeId)) : "—",
    collaborationType: dash(
      state.employment?.collaborationType ??
        contractual?.collaborationType ??
        null,
    ),
    compensation: hasCompensation ? (amount?.trim() ? amount : "—") : "",
    compensationPermitted: hasCompensation,
    contractEndDate: hasCompensation
      ? dash(contractual?.contractEndDateExclusive)
      : "",
    contractParty: hasCompensation
      ? dash(contractual?.contractingEntity)
      : "",
    currentColleague: currentColleagueFromState(state),
    mobilePhone: mobile,
    disposalLimited,
    disposalMessageFa: disposalLimited
      ? state.disposalDisclosure.messageFa
      : null,
  };
}

/** Deterministic order: personnelCode ASC, id ASC (stable tie-break). */
export function comparePersonnelListRows(
  a: Pick<PersonnelListRowDto, "personnelCode" | "id">,
  b: Pick<PersonnelListRowDto, "personnelCode" | "id">,
): number {
  const code = a.personnelCode.localeCompare(b.personnelCode, "en");
  if (code !== 0) return code;
  return a.id.localeCompare(b.id, "en");
}

/**
 * Filter palette / server text query against permitted identifier fields.
 * Forbidden categories must already be omitted from the row DTO.
 */
export function rowMatchesPersonnelQuery(
  row: PersonnelListRowDto,
  normalizedQuery: string,
): boolean {
  const q = normalizedQuery.trim().toLowerCase();
  if (!q) return true;
  const haystacks = [
    row.personnelCode,
    row.givenName,
    row.familyName,
    row.team,
    row.role,
    row.jobTitle,
    row.ladder,
    row.grade,
    row.collaborationType,
    row.mobilePhone ?? "",
  ];
  return haystacks.some((h) => h.toLowerCase().includes(q));
}
