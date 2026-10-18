import type { SettingsParameterRowDto } from "./settings-types";
type DraftRow = Pick<SettingsParameterRowDto, "key" | "valueType" | "value">;

function valuesEqual(
  a: string | number | boolean | string[],
  b: string | number | boolean | string[],
): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
  }
  return a === b;
}

export function initialDraft(row: DraftRow): string | string[] {
  if (row.valueType === "string_list") {
    return Array.isArray(row.value) ? [...row.value] : [];
  }
  if (typeof row.value === "boolean") {
    return row.value ? "true" : "false";
  }
  return String(row.value);
}

export function isDraftDirty(
  row: DraftRow,
  draft: string | string[],
): boolean {
  if (row.valueType === "string_list") {
    const current = Array.isArray(row.value) ? row.value : [];
    const next = Array.isArray(draft) ? draft : [];
    return !valuesEqual(current, next);
  }
  if (row.valueType === "number" || row.valueType === "duration_ms") {
    return String(row.value) !== String(draft).trim();
  }
  if (row.valueType === "boolean") {
    return (row.value === true ? "true" : "false") !== draft;
  }
  return String(row.value) !== String(draft);
}

/** Compare against the previous server value, before accepting an incoming row. */
export function shouldRefreshSettingsDraft(previous: DraftRow, incoming: DraftRow, draft: string | string[], confirming: boolean): boolean {
  return previous.key !== incoming.key || (!isDraftDirty(previous, draft) && !confirming);
}
