import type * as React from "react";

export type FilterKind = "text" | "enum";

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
};

export type GovernedDataTableProps<T> = {
  columns: GovernedColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sectionDefaultFilters: Record<string, string | string[]>;
  pageSize?: number;
  toolbar?: React.ReactNode;
  rowActions?: (row: T) => React.ReactNode;
  exportSlot?: React.ReactNode;
  /** Override empty-state copy (default: operationalCopy.emptySearch). */
  emptyMessage?: string;
  "aria-label": string;
};

export type FilterValue = string | string[];

export type SortDirection = "asc" | "desc";

export type SortState = {
  columnId: string;
  direction: SortDirection;
} | null;

export type TableFilters = Record<string, FilterValue>;
