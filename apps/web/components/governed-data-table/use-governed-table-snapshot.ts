"use client";

import * as React from "react";

import {
  cloneFilters,
  columnsVisibilityKey,
  computeSnapshot,
  cycleSort,
  normalizeDefaultFilters,
  scrubFilters,
  scrubSort,
} from "./snapshot";
import type {
  FilterValue,
  GovernedColumn,
  SortState,
  TableFilters,
} from "./types";

const TEXT_DEBOUNCE_MS = 250;

export type UseGovernedTableSnapshotArgs<T> = {
  columns: GovernedColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sectionDefaultFilters: Record<string, string | string[]>;
  pageSize?: number;
};

function scrubTextDrafts<T>(
  drafts: Record<string, string>,
  columns: readonly GovernedColumn<T>[],
): Record<string, string> {
  const allowed = new Set(
    columns
      .filter((c) => c.permitted !== false && c.filter === "text")
      .map((c) => c.id),
  );
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(drafts)) {
    if (allowed.has(key)) next[key] = value;
  }
  return next;
}

export function useGovernedTableSnapshot<T>({
  columns,
  rows,
  getRowId,
  sectionDefaultFilters,
  pageSize = 25,
}: UseGovernedTableSnapshotArgs<T>) {
  const [filters, setFilters] = React.useState<TableFilters>(() =>
    normalizeDefaultFilters(sectionDefaultFilters, columns),
  );
  const [textDrafts, setTextDrafts] = React.useState<Record<string, string>>(
    () => {
      const drafts: Record<string, string> = {};
      const normalized = normalizeDefaultFilters(sectionDefaultFilters, columns);
      for (const [key, value] of Object.entries(normalized)) {
        if (typeof value === "string") drafts[key] = value;
      }
      return drafts;
    },
  );
  const [sort, setSort] = React.useState<SortState>(null);
  const [pageIndex, setPageIndex] = React.useState(0);

  const visibilityKey = columnsVisibilityKey(columns);
  const textColumnKey = React.useMemo(
    () =>
      columns
        .filter((c) => c.filter === "text" && c.permitted !== false)
        .map((c) => c.id)
        .join("|"),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable key from column meta
    [visibilityKey],
  );

  // Mid-session omit: adjust state during render when column visibility changes.
  const [trackedVisibilityKey, setTrackedVisibilityKey] =
    React.useState(visibilityKey);
  if (trackedVisibilityKey !== visibilityKey) {
    setTrackedVisibilityKey(visibilityKey);
    setFilters((prev) => scrubFilters(prev, columns));
    setSort((prev) => scrubSort(prev, columns));
    setTextDrafts((prev) => scrubTextDrafts(prev, columns));
  }

  const snapshot = React.useMemo(
    () =>
      computeSnapshot({
        rows,
        columns,
        filters,
        sort,
        pageIndex,
        pageSize,
        getRowId,
      }),
    [rows, columns, filters, sort, pageIndex, pageSize, getRowId],
  );

  // Filter/sort identity change (including omit scrub) → page 1.
  const [trackedIdentity, setTrackedIdentity] = React.useState(
    snapshot.identity,
  );
  if (trackedIdentity !== snapshot.identity) {
    setTrackedIdentity(snapshot.identity);
    setPageIndex(0);
  }

  // Debounce text drafts into committed filters.
  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilters((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [key, draft] of Object.entries(textDrafts)) {
          const column = columns.find((c) => c.id === key);
          if (!column || column.filter !== "text") continue;
          if (column.permitted === false) continue;
          if (next[key] !== draft) {
            next[key] = draft;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, TEXT_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // textColumnKey stands in for stable column filter membership
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textDrafts, textColumnKey]);

  const setTextFilter = React.useCallback((columnId: string, value: string) => {
    setTextDrafts((prev) => ({ ...prev, [columnId]: value }));
  }, []);

  const setEnumFilter = React.useCallback(
    (columnId: string, values: string[]) => {
      setFilters((prev) => ({ ...prev, [columnId]: values }));
    },
    [],
  );

  const toggleSort = React.useCallback((columnId: string) => {
    setSort((prev) => cycleSort(prev, columnId));
  }, []);

  const clearToSectionDefaults = React.useCallback(() => {
    const defaults = normalizeDefaultFilters(sectionDefaultFilters, columns);
    setFilters(defaults);
    const drafts: Record<string, string> = {};
    for (const [key, value] of Object.entries(defaults)) {
      if (typeof value === "string") drafts[key] = value;
    }
    setTextDrafts(drafts);
    setSort(null);
  }, [sectionDefaultFilters, columns]);

  const goToPage = React.useCallback((next: number) => {
    setPageIndex(Math.max(0, next));
  }, []);

  const getFilterValue = React.useCallback(
    (column: GovernedColumn<T>): FilterValue => {
      if (column.filter === "text") {
        return textDrafts[column.id] ?? "";
      }
      const committed = filters[column.id];
      if (Array.isArray(committed)) return committed;
      if (typeof committed === "string" && committed.length > 0) {
        return [committed];
      }
      return [];
    },
    [filters, textDrafts],
  );

  return {
    snapshot,
    filters: cloneFilters(snapshot.activeFilters),
    sort: snapshot.sort,
    pageIndex: Math.min(pageIndex, Math.max(0, snapshot.pageCount - 1)),
    pageSize,
    setTextFilter,
    setEnumFilter,
    toggleSort,
    clearToSectionDefaults,
    goToPage,
    getFilterValue,
    identity: snapshot.identity,
  };
}
