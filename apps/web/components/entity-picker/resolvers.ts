/**
 * Variant → API adapters for entity-picker (Story 8.3).
 * Search never widens beyond what sibling list/read procedures already allow.
 */

import { vanillaApi } from "@/lib/trpc/vanilla";
import { normalizeDigitsForMatch } from "@/lib/persian-digits";

import type { EntityPickerOption, EntityPickerSearchFn } from "./types";

function matchesCodeOrName(
  query: string,
  code: string,
  nameFa: string,
): boolean {
  const q = normalizeDigitsForMatch(query);
  if (!q) return false;
  const codeN = normalizeDigitsForMatch(code);
  const nameN = normalizeDigitsForMatch(nameFa);
  return codeN.includes(q) || nameN.includes(q);
}

function toCodeNameOption(
  row: { id: string; code: string; nameFa: string },
  secondaryFa?: string,
): EntityPickerOption {
  return {
    id: row.id,
    code: row.code,
    labelFa: row.nameFa,
    secondaryFa,
  };
}

function mergeExact(
  filtered: EntityPickerOption[],
  exact: EntityPickerOption | null,
): EntityPickerOption[] {
  if (!exact) return filtered;
  if (filtered.some((o) => o.id === exact.id)) return filtered;
  return [exact, ...filtered];
}

/** person.search channel=search — FR-33 scoped; empty on deny/error. */
export function createPersonSearch(): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    const q = normalizeDigitsForMatch(normalizedQuery);
    if (!q) return [];
    try {
      const result = await vanillaApi.person.search.query({
        channel: "search",
        normalizedQuery: q,
        pageSize: 100,
      });
      if (result.outcome !== "allowed") return [];
      return result.rows.map((row) => {
        const name = `${row.givenName} ${row.familyName}`.trim();
        const secondaryParts = [row.team, row.jobTitle].filter(
          (p) => p && p !== "—",
        );
        return {
          id: row.id,
          code: row.personnelCode,
          labelFa: name || row.personnelCode,
          secondaryFa:
            secondaryParts.length > 0 ? secondaryParts.join(" · ") : undefined,
        };
      });
    } catch {
      return [];
    }
  };
}

async function hydrateOrgByCode(
  code: string,
): Promise<EntityPickerOption | null> {
  try {
    const unit = await vanillaApi.organization.getByCode.query({ code });
    return toCodeNameOption(unit, unit.unitType);
  } catch {
    return null;
  }
}

/** organization.list filtered by code/name; exact code via getByCode. */
export function createOrgUnitSearch(): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    const q = normalizeDigitsForMatch(normalizedQuery);
    if (!q) return [];
    try {
      const [units, exact] = await Promise.all([
        vanillaApi.organization.list.query({}),
        hydrateOrgByCode(q),
      ]);
      const byId = new Map(units.map((u) => [u.id, u]));
      const filtered = units
        .filter((u) => matchesCodeOrName(q, u.code, u.nameFa))
        .map((u) => {
          const parent = u.parentId ? byId.get(u.parentId) : undefined;
          return toCodeNameOption(u, parent ? parent.nameFa : u.unitType);
        });
      return mergeExact(filtered, exact);
    } catch {
      return [];
    }
  };
}

async function hydrateJobRefByCode(
  kind: "organizationalRole" | "jobTitle" | "ladder" | "seniority",
  code: string,
  secondaryFa: string,
): Promise<EntityPickerOption | null> {
  try {
    const row = await vanillaApi.jobReference.getByCode.query({ kind, code });
    return toCodeNameOption(row, secondaryFa);
  } catch {
    return null;
  }
}

export function createOrganizationalRoleSearch(): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    const q = normalizeDigitsForMatch(normalizedQuery);
    if (!q) return [];
    try {
      const [rows, exact] = await Promise.all([
        vanillaApi.jobReference.listRoles.query({}),
        hydrateJobRefByCode("organizationalRole", q, "نقش سازمانی"),
      ]);
      const filtered = rows
        .filter((r) => matchesCodeOrName(q, r.code, r.nameFa))
        .map((r) => toCodeNameOption(r, "نقش سازمانی"));
      return mergeExact(filtered, exact);
    } catch {
      return [];
    }
  };
}

export function createJobTitleSearch(): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    const q = normalizeDigitsForMatch(normalizedQuery);
    if (!q) return [];
    try {
      const [rows, exact] = await Promise.all([
        vanillaApi.jobReference.listJobTitles.query({}),
        hydrateJobRefByCode("jobTitle", q, "عنوان شغلی"),
      ]);
      const filtered = rows
        .filter((r) => matchesCodeOrName(q, r.code, r.nameFa))
        .map((r) => toCodeNameOption(r, "عنوان شغلی"));
      return mergeExact(filtered, exact);
    } catch {
      return [];
    }
  };
}

export function createLadderSearch(): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    const q = normalizeDigitsForMatch(normalizedQuery);
    if (!q) return [];
    try {
      const [rows, exact] = await Promise.all([
        vanillaApi.jobReference.listLadders.query({}),
        hydrateJobRefByCode("ladder", q, "لدر"),
      ]);
      const filtered = rows
        .filter((r) => matchesCodeOrName(q, r.code, r.nameFa))
        .map((r) => toCodeNameOption(r, "لدر"));
      return mergeExact(filtered, exact);
    } catch {
      return [];
    }
  };
}

/** Grades for a ladder — empty query lists all grades for the ladder. */
export function createGradeSearch(ladderId: string | null): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    if (!ladderId) return [];
    const q = normalizeDigitsForMatch(normalizedQuery);
    try {
      const [rows, exact] = await Promise.all([
        vanillaApi.jobReference.listGradesForLadder.query({ ladderId }),
        q
          ? vanillaApi.jobReference.getByCode
              .query({ kind: "grade", code: q, ladderId })
              .then((row) => {
                const rank =
                  "rank" in row && row.rank != null ? String(row.rank) : "";
                return toCodeNameOption(
                  row,
                  rank ? `رتبه ${rank}` : "گرید",
                );
              })
              .catch(() => null)
          : Promise.resolve(null),
      ]);
      const mapped = rows.map((r) => toCodeNameOption(r, `رتبه ${r.rank}`));
      if (!q) return mapped;
      const filtered = mapped.filter((r) =>
        matchesCodeOrName(q, r.code, r.labelFa),
      );
      return mergeExact(filtered, exact);
    } catch {
      return [];
    }
  };
}

export function createSenioritySearch(): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    const q = normalizeDigitsForMatch(normalizedQuery);
    if (!q) return [];
    try {
      const [rows, exact] = await Promise.all([
        vanillaApi.jobReference.listSeniorities.query({}),
        hydrateJobRefByCode("seniority", q, "ارشدیت"),
      ]);
      const filtered = rows
        .filter((r) => matchesCodeOrName(q, r.code, r.nameFa))
        .map((r) => toCodeNameOption(r, "ارشدیت"));
      return mergeExact(filtered, exact);
    } catch {
      return [];
    }
  };
}

/** headcount.listApprovals — filter by requirement / reference code. */
export function createHeadcountApprovalSearch(): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    const q = normalizeDigitsForMatch(normalizedQuery);
    if (!q) return [];
    try {
      const rows = await vanillaApi.headcount.listApprovals.query();
      return rows
        .filter((r) => {
          const code = normalizeDigitsForMatch(r.requirementCode);
          const ref = normalizeDigitsForMatch(r.approvalReference ?? "");
          return code.includes(q) || (ref && ref.includes(q));
        })
        .map((r) => ({
          id: r.id,
          code: r.requirementCode,
          labelFa: r.approvalReference?.trim() || r.requirementCode,
          secondaryFa: `${r.status} · ${r.validityStart} – ${r.validityEndExclusive}`,
        }));
    } catch {
      return [];
    }
  };
}

/** accessAdmin.listEntitlements — admin-bound inventory only. */
export function createAccountSearch(): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    const q = normalizeDigitsForMatch(normalizedQuery);
    if (!q) return [];
    try {
      const rows = await vanillaApi.accessAdmin.listEntitlements.query();
      return rows
        .filter((r) => {
          const user = normalizeDigitsForMatch(r.username);
          const name = normalizeDigitsForMatch(r.displayName);
          return user.includes(q) || name.includes(q);
        })
        .map((r) => ({
          id: r.accountId,
          code: r.username,
          labelFa: r.displayName,
          secondaryFa: r.coarseRole,
        }));
    } catch {
      return [];
    }
  };
}

function formatDateRange(
  start: string,
  endExclusive: string | null,
): string {
  return endExclusive ? `${start} تا ${endExclusive}` : `${start} تاکنون`;
}

/** Dependent: employments for a person — empty query lists all rows. */
export function createEmploymentSearch(
  personId: string | null,
): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    if (!personId) return [];
    try {
      const rows = await vanillaApi.person.listSelectableEmployments.query({
        personId,
      });
      const q = normalizeDigitsForMatch(normalizedQuery);
      return rows
        .map((r) => {
          const range = formatDateRange(r.startDate, r.endDateExclusive);
          const collab = r.collaborationType?.trim();
          const labelFa = collab ? `اشتغال · ${collab}` : "اشتغال";
          return {
            id: r.id,
            code: "",
            labelFa: `${labelFa} (${range})`,
            secondaryFa: range,
          };
        })
        .filter((opt) => {
          if (!q) return true;
          return (
            normalizeDigitsForMatch(opt.labelFa).includes(q) ||
            normalizeDigitsForMatch(opt.secondaryFa ?? "").includes(q)
          );
        });
    } catch {
      return [];
    }
  };
}

/** Dependent: primary assignments for a person — empty query lists all. */
export function createPrimaryAssignmentSearch(
  personId: string | null,
): EntityPickerSearchFn {
  return async (normalizedQuery) => {
    if (!personId) return [];
    try {
      const rows =
        await vanillaApi.person.listSelectablePrimaryAssignments.query({
          personId,
        });
      const q = normalizeDigitsForMatch(normalizedQuery);
      return rows
        .map((r) => {
          const range = formatDateRange(r.startDate, r.endDateExclusive);
          const team = r.teamNameFa ?? "تیم";
          const title = r.jobTitleNameFa;
          return {
            id: r.id,
            code: "",
            labelFa: title ? `${team} · ${title}` : team,
            secondaryFa: range,
          };
        })
        .filter((opt) => {
          if (!q) return true;
          return (
            normalizeDigitsForMatch(opt.labelFa).includes(q) ||
            normalizeDigitsForMatch(opt.secondaryFa ?? "").includes(q)
          );
        });
    } catch {
      return [];
    }
  };
}
