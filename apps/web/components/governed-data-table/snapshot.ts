import { normalizeDigitsForMatch } from "@/lib/persian-digits";

import type {
  FilterValue,
  GovernedColumn,
  SortState,
  TableFilters,
} from "./types";

export function visibleColumns<T>(
  columns: readonly GovernedColumn<T>[],
): GovernedColumn<T>[] {
  return columns.filter((column) => column.permitted !== false);
}

/**
 * Keep at most one sticky identifier and one sticky actions column
 * (first wins). Spec: "at most one of each".
 */
export function dedupeStickyColumns<T>(
  columns: readonly GovernedColumn<T>[],
): GovernedColumn<T>[] {
  let seenIdentifier = false;
  let seenActions = false;
  return columns.filter((column) => {
    if (column.sticky === "identifier") {
      if (seenIdentifier) return false;
      seenIdentifier = true;
    }
    if (column.sticky === "actions") {
      if (seenActions) return false;
      seenActions = true;
    }
    return true;
  });
}

/** Drop filter keys that are not among currently visible columns. */
export function scrubFilters<T>(
  filters: TableFilters,
  columns: readonly GovernedColumn<T>[],
): TableFilters {
  const allowed = new Set(visibleColumns(columns).map((c) => c.id));
  const next: TableFilters = {};
  for (const [key, value] of Object.entries(filters)) {
    if (allowed.has(key)) next[key] = value;
  }
  return next;
}

/** Drop sort when the sort column is omitted / not visible. */
export function scrubSort<T>(
  sort: SortState,
  columns: readonly GovernedColumn<T>[],
): SortState {
  if (sort === null) return null;
  const visible = visibleColumns(columns);
  return visible.some((c) => c.id === sort.columnId) ? sort : null;
}

export function sanitizePageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize < 1) return 1;
  return Math.floor(pageSize);
}

function cellString(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function matchesTextFilter(
  cell: string,
  query: string,
): boolean {
  const needle = normalizeDigitsForMatch(query).toLowerCase();
  if (!needle) return true;
  const haystack = normalizeDigitsForMatch(cell).toLowerCase();
  return haystack.includes(needle);
}

function matchesEnumFilter(
  cell: string,
  selected: string[],
): boolean {
  if (selected.length === 0) return true;
  return selected.includes(cell);
}

function coerceTextFilter(raw: FilterValue): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0] ?? "";
  return "";
}

function coerceEnumFilter(raw: FilterValue): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.length > 0) return [raw];
  return [];
}

export function applyFilters<T>(
  rows: readonly T[],
  columns: readonly GovernedColumn<T>[],
  filters: TableFilters,
): T[] {
  const visible = visibleColumns(columns);
  const active = scrubFilters(filters, visible);

  return rows.filter((row) =>
    visible.every((column) => {
      const raw = active[column.id];
      if (raw === undefined) return true;
      const cell = cellString(column.accessor(row));

      if (column.filter === "text") {
        return matchesTextFilter(cell, coerceTextFilter(raw));
      }

      if (column.filter === "enum") {
        return matchesEnumFilter(cell, coerceEnumFilter(raw));
      }

      return true;
    }),
  );
}

function compareValues(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
  direction: "asc" | "desc",
): number {
  const mul = direction === "asc" ? 1 : -1;

  if (typeof a === "number" && typeof b === "number") {
    if (a === b) return 0;
    return a < b ? -1 * mul : 1 * mul;
  }

  const sa = cellString(a);
  const sb = cellString(b);
  const cmp = sa.localeCompare(sb, "fa", { sensitivity: "base", numeric: true });
  return cmp * mul;
}

export function applySort<T>(
  rows: readonly T[],
  columns: readonly GovernedColumn<T>[],
  sort: SortState,
  getRowId: (row: T) => string,
): T[] {
  const sorted = [...rows];
  const activeSort = scrubSort(sort, columns);
  const column =
    activeSort === null
      ? undefined
      : visibleColumns(columns).find((c) => c.id === activeSort.columnId);

  sorted.sort((a, b) => {
    if (column && activeSort) {
      const primary = compareValues(
        column.accessor(a),
        column.accessor(b),
        activeSort.direction,
      );
      if (primary !== 0) return primary;
    }
    const idA = getRowId(a);
    const idB = getRowId(b);
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });

  return sorted;
}

export function paginate<T>(
  rows: readonly T[],
  pageIndex: number,
  pageSize: number,
): T[] {
  const size = sanitizePageSize(pageSize);
  const start = Math.max(0, pageIndex) * size;
  return rows.slice(start, start + size);
}

/** Stable identity for filter+sort snapshot (page resets when this changes). */
export function snapshotIdentity(
  filters: TableFilters,
  sort: SortState,
): string {
  const filterKeys = Object.keys(filters).sort();
  const filterPart = filterKeys
    .map((key) => {
      const value = filters[key];
      if (Array.isArray(value)) {
        return `${key}=[${[...value].sort().join(",")}]`;
      }
      return `${key}=${value ?? ""}`;
    })
    .join("&");
  const sortPart =
    sort === null ? "none" : `${sort.columnId}:${sort.direction}`;
  return `${filterPart}|${sortPart}`;
}

export function cycleSort(
  current: SortState,
  columnId: string,
): SortState {
  if (current === null || current.columnId !== columnId) {
    return { columnId, direction: "asc" };
  }
  if (current.direction === "asc") {
    return { columnId, direction: "desc" };
  }
  return null;
}

export function pageCount(total: number, pageSize: number): number {
  const size = sanitizePageSize(pageSize);
  if (total <= 0) return 1;
  return Math.ceil(total / size);
}

export function cloneFilters(source: TableFilters): TableFilters {
  const next: TableFilters = {};
  for (const [key, value] of Object.entries(source)) {
    next[key] = Array.isArray(value) ? [...value] : value;
  }
  return next;
}

/** Normalize section defaults; coerce string↔array using column filter kinds when provided. */
export function normalizeDefaultFilters<T = unknown>(
  defaults: Record<string, string | string[]>,
  columns?: readonly GovernedColumn<T>[],
): TableFilters {
  const next: TableFilters = {};
  for (const [key, value] of Object.entries(defaults)) {
    const column = columns?.find((c) => c.id === key);
    if (column?.filter === "enum") {
      next[key] = Array.isArray(value)
        ? [...value]
        : value.length > 0
          ? [value]
          : [];
    } else if (column?.filter === "text") {
      next[key] = typeof value === "string" ? value : (value[0] ?? "");
    } else if (Array.isArray(value)) {
      next[key] = [...value];
    } else {
      next[key] = value;
    }
  }
  return next;
}

/** Stable key for column visibility / filter identity (avoids unstable array deps). */
export function columnsVisibilityKey<T>(
  columns: readonly GovernedColumn<T>[],
): string {
  return columns
    .map(
      (c) =>
        `${c.id}:${c.permitted !== false ? "1" : "0"}:${c.filter ?? ""}:${c.sticky ?? ""}`,
    )
    .join("|");
}

export type SnapshotResult<T> = {
  visible: GovernedColumn<T>[];
  activeFilters: TableFilters;
  filtered: T[];
  sorted: T[];
  pageRows: T[];
  total: number;
  identity: string;
  pageCount: number;
  sort: SortState;
};

export function computeSnapshot<T>(input: {
  rows: readonly T[];
  columns: readonly GovernedColumn<T>[];
  filters: TableFilters;
  sort: SortState;
  pageIndex: number;
  pageSize: number;
  getRowId: (row: T) => string;
}): SnapshotResult<T> {
  const visible = dedupeStickyColumns(visibleColumns(input.columns));
  const activeFilters = scrubFilters(input.filters, visible);
  const activeSort = scrubSort(input.sort, visible);
  const filtered = applyFilters(input.rows, visible, activeFilters);
  const sorted = applySort(filtered, visible, activeSort, input.getRowId);
  const identity = snapshotIdentity(activeFilters, activeSort);
  const total = sorted.length;
  const pages = pageCount(total, input.pageSize);
  const safePage = Math.min(Math.max(0, input.pageIndex), pages - 1);
  const pageRows = paginate(sorted, safePage, input.pageSize);

  return {
    visible,
    activeFilters,
    filtered,
    sorted,
    pageRows,
    total,
    identity,
    pageCount: pages,
    sort: activeSort,
  };
}

export function isFilterValueEmpty(value: FilterValue | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim() === "";
}
