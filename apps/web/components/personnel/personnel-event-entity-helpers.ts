/**
 * Client helpers for identifier-first personnel event form (Story 8.4).
 * Hydrates EntityPicker tokens from authorized reads — no authz widening.
 */

import { vanillaApi } from "@/lib/trpc/vanilla";
import type { EntityPickerValue } from "@/components/entity-picker";

export function entityId(value: EntityPickerValue): string {
  return value?.id?.trim() ?? "";
}

export function formatCodeName(code: string, nameFa: string): string {
  const c = code.trim();
  const n = nameFa.trim();
  if (c && n) return `${c} — ${n}`;
  return n || c || "—";
}

function formatDateRange(
  start: string,
  endExclusive: string | null,
): string {
  return endExclusive ? `${start} تا ${endExclusive}` : `${start} تاکنون`;
}

/** Hydrate person token from UUID (inbound `?person=` / snapshot restore). */
export async function hydratePersonValue(
  personId: string,
): Promise<EntityPickerValue> {
  const id = personId.trim();
  if (!id) return null;
  try {
    const person = await vanillaApi.person.getById.query({ id });
    const code = person.personnelCode?.trim() || "";
    const name = `${person.givenName ?? ""} ${person.familyName ?? ""}`.trim();
    return {
      id: person.id ?? id,
      code,
      labelFa: name || code || "پرسنل",
    };
  } catch {
    return null;
  }
}

export async function hydrateEmploymentValue(
  personId: string,
  employmentId: string,
): Promise<EntityPickerValue> {
  const pid = personId.trim();
  const eid = employmentId.trim();
  if (!pid || !eid) return null;
  try {
    const rows = await vanillaApi.person.listSelectableEmployments.query({
      personId: pid,
    });
    const row = rows.find((r) => r.id === eid);
    if (!row) return null;
    const range = formatDateRange(row.startDate, row.endDateExclusive);
    const collab = row.collaborationType?.trim();
    const labelFa = collab ? `همکاری · ${collab}` : "همکاری";
    return {
      id: row.id,
      code: "",
      labelFa: `${labelFa} (${range})`,
      secondaryFa: range,
    };
  } catch {
    return null;
  }
}

export async function hydratePrimaryAssignmentValue(
  personId: string,
  primaryAssignmentId: string,
): Promise<EntityPickerValue> {
  const pid = personId.trim();
  const paid = primaryAssignmentId.trim();
  if (!pid || !paid) return null;
  try {
    const rows =
      await vanillaApi.person.listSelectablePrimaryAssignments.query({
        personId: pid,
      });
    const row = rows.find((r) => r.id === paid);
    if (!row) return null;
    const range = formatDateRange(row.startDate, row.endDateExclusive);
    const team = row.teamNameFa ?? "تیم";
    const title = row.jobTitleNameFa;
    return {
      id: row.id,
      code: "",
      labelFa: title ? `${team} · ${title}` : team,
      secondaryFa: range,
    };
  } catch {
    return null;
  }
}

/** Resolve PA → employment id for mutation consistency (no new payload fields). */
export async function employmentIdForPrimaryAssignment(
  personId: string,
  primaryAssignmentId: string,
): Promise<string | null> {
  const pid = personId.trim();
  const paid = primaryAssignmentId.trim();
  if (!pid || !paid) return null;
  try {
    const rows =
      await vanillaApi.person.listSelectablePrimaryAssignments.query({
        personId: pid,
      });
    return rows.find((r) => r.id === paid)?.employmentId ?? null;
  } catch {
    return null;
  }
}

export async function hydrateOrgUnitValue(
  id: string,
): Promise<EntityPickerValue> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  try {
    const unit = await vanillaApi.organization.get.query({ id: trimmed });
    return {
      id: unit.id,
      code: unit.code,
      labelFa: unit.nameFa,
      secondaryFa: unit.unitType,
    };
  } catch {
    return null;
  }
}

export async function hydrateJobTitleValue(
  id: string,
): Promise<EntityPickerValue> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  try {
    const row = await vanillaApi.jobReference.getJobTitle.query({
      id: trimmed,
    });
    return {
      id: row.id,
      code: row.code,
      labelFa: row.nameFa,
      secondaryFa: "عنوان شغلی",
    };
  } catch {
    return null;
  }
}

export async function hydrateLadderValue(
  id: string,
): Promise<EntityPickerValue> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  try {
    const row = await vanillaApi.jobReference.getLadder.query({ id: trimmed });
    return {
      id: row.id,
      code: row.code,
      labelFa: row.nameFa,
      secondaryFa: "لدر",
    };
  } catch {
    return null;
  }
}

export async function hydrateGradeValue(
  id: string,
): Promise<EntityPickerValue> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  try {
    const row = await vanillaApi.jobReference.getGrade.query({ id: trimmed });
    const rank =
      "rank" in row && row.rank != null ? String(row.rank) : "";
    return {
      id: row.id,
      code: row.code,
      labelFa: row.nameFa,
      secondaryFa: rank ? `رتبه ${rank}` : "گرید",
    };
  } catch {
    return null;
  }
}

export async function hydrateOrganizationalRoleValue(
  id: string,
): Promise<EntityPickerValue> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  try {
    const row = await vanillaApi.jobReference.getRole.query({
      id: trimmed,
    });
    return {
      id: row.id,
      code: row.code,
      labelFa: row.nameFa,
      secondaryFa: "نقش سازمانی",
    };
  } catch {
    return null;
  }
}

export async function hydrateSeniorityValue(
  id: string,
): Promise<EntityPickerValue> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  try {
    const row = await vanillaApi.jobReference.getSeniority.query({
      id: trimmed,
    });
    return {
      id: row.id,
      code: row.code,
      labelFa: row.nameFa,
      secondaryFa: "ارشدیت",
    };
  } catch {
    return null;
  }
}

export type EntitySnap = {
  id: string;
  code: string;
  labelFa: string;
  secondaryFa?: string;
} | null;

export function toEntitySnap(value: EntityPickerValue): EntitySnap {
  if (!value) return null;
  return {
    id: value.id,
    code: value.code,
    labelFa: value.labelFa,
    ...(value.secondaryFa != null ? { secondaryFa: value.secondaryFa } : {}),
  };
}

export function fromEntitySnap(snap: EntitySnap): EntityPickerValue {
  if (!snap) return null;
  return {
    id: snap.id,
    code: snap.code,
    labelFa: snap.labelFa,
    ...(snap.secondaryFa != null ? { secondaryFa: snap.secondaryFa } : {}),
  };
}
