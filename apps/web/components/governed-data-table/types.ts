import type * as React from "react";

export type FilterKind = "text" | "enum";

export type CellOverflow = "truncate" | "wrap";

export type TableDensity = "dense" | "comfortable";

/** Default row density — aligned with CSS token `--table-row-dense` (32px). */
export const GOVERNED_TABLE_DEFAULT_DENSITY: TableDensity = "dense";

export type GovernedColumn<T> = {
  id: string;
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
  filter?: FilterKind;
  enumOptions?: { value: string; label: string }[];
  sortable?: boolean;
  sticky?: "identifier" | "actions";
  permitted?: boolean;
  cell?: (row: T) => React.ReactNode;
  /** Tailwind max-width class for cell content (e.g. "max-w-[16rem]"). */
  maxWidthClass?: string;
  /** Default `"truncate"`. Long-text columns may use `"wrap"`. */
  cellOverflow?: CellOverflow;
};

export type GovernedDataTableProps<T> = {
  columns: GovernedColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sectionDefaultFilters: Record<string, string | string[]>;
  pageSize?: number;
  toolbar?: React.ReactNode;
  rowActions?: (row: T) => React.ReactNode;
  /**
   * Optional row activate — opens the record (click / Enter / Space when the
   * row itself is focused). Row actions must stopPropagation so they never
   * trigger this as a side effect. Additive; omit when there is no record-open.
   */
  onRowClick?: (row: T) => void;
  /**
   * Accessible description for row activate when `onRowClick` is set.
   * Default: «باز کردن رکورد».
   */
  rowActivateLabel?: string;
  exportSlot?: React.ReactNode;
  /** Override empty-state copy (default: operationalCopy.emptySearch). */
  emptyMessage?: string;
  /**
   * Cold-load / initial query loading. Shows content-shaped skeleton rows
   * (density + column rhythm). Does not replace an in-session surface that
   * already has rows — callers should pass false while refetching with data.
   */
  loading?: boolean;
  /** Skeleton row count when `loading` (default 8). */
  loadingRowCount?: number;
  "aria-label": string;
  /**
   * Session-prefs bucket key (with account id). Required for density /
   * column-visibility persistence across in-session navigation.
   */
  preferencesKey?: string;
  /** Default row density when no session prefs exist. Defaults to `"dense"` (32px). */
  defaultDensity?: TableDensity;
};

export type FilterValue = string | string[];

export type SortDirection = "asc" | "desc";

export type SortState = {
  columnId: string;
  direction: SortDirection;
} | null;

export type TableFilters = Record<string, FilterValue>;
