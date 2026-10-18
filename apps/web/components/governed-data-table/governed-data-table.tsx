"use client";

import * as React from "react";
import { ChevronDownIcon, Columns3Icon, Rows3Icon } from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { operationalCopy } from "@/lib/operational-copy";
import { emptyStateCopy } from "@/lib/empty-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPersianInteger, toPersianDigits } from "@/lib/persian-digits";
import {
  readTablePreferences,
  writeTablePreferences,
  type TablePreferences,
} from "@/lib/table-preferences-storage";
import { cn } from "@/lib/utils";

import {
  isColumnHideable,
  permissionVisibleColumns,
  sanitizeHiddenColumnIds,
} from "./snapshot";
import type { GovernedColumn, GovernedDataTableProps, TableDensity } from "./types";
import { GOVERNED_TABLE_DEFAULT_DENSITY } from "./types";
import { TableSkeleton } from "./table-skeleton";
import { useGovernedTableSnapshot } from "./use-governed-table-snapshot";

const DEFAULT_MAX_WIDTH = "max-w-[16rem]";

function stickySeparatorClass(
  sticky: GovernedColumn<unknown>["sticky"] | undefined,
  scrolled: boolean,
): string | undefined {
  if (!scrolled) return undefined;
  if (sticky === "identifier") {
    return "shadow-[inset_-1px_0_0_var(--hairline)]";
  }
  if (sticky === "actions") {
    return "shadow-[inset_1px_0_0_var(--hairline-strong)]";
  }
  return undefined;
}

function stickyBodyClass(
  sticky: GovernedColumn<unknown>["sticky"] | undefined,
  scrolled: boolean,
) {
  if (sticky === "identifier") {
    return cn(
      "sticky start-0 z-10 bg-background group-hover:bg-muted/50 group-data-[focused=true]:bg-muted/60",
      stickySeparatorClass(sticky, scrolled),
    );
  }
  if (sticky === "actions") {
    return cn(
      "sticky end-0 z-20 bg-background group-hover:bg-muted/50 group-data-[focused=true]:bg-muted/60",
      stickySeparatorClass(sticky, scrolled),
    );
  }
  return undefined;
}

function stickyHeadClass(
  sticky: GovernedColumn<unknown>["sticky"] | undefined,
  scrolled: boolean,
) {
  if (sticky === "identifier") {
    return cn(
      "sticky start-0 z-10 bg-surface-subtle",
      stickySeparatorClass(sticky, scrolled),
    );
  }
  if (sticky === "actions") {
    return cn(
      "sticky end-0 z-20 bg-surface-subtle",
      stickySeparatorClass(sticky, scrolled),
    );
  }
  return undefined;
}

function densityRowClass(density: TableDensity): string {
  if (density === "comfortable") {
    return "h-table-row-comfortable min-h-[var(--table-row-comfortable)]";
  }
  return "h-table-row-dense min-h-[var(--table-row-dense)]";
}

function resolveMaxWidthClass<T>(column: GovernedColumn<T>): string | undefined {
  if (column.maxWidthClass) return column.maxWidthClass;
  // Sticky identifiers stay content-sized unless the caller opts into a max.
  if (column.sticky === "identifier") return undefined;
  return DEFAULT_MAX_WIDTH;
}

function TruncatedCell({
  fullText,
  maxWidthClass,
}: {
  fullText: string;
  maxWidthClass?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullText]);

  const trigger = (
    <span
      ref={ref}
      tabIndex={overflowing && fullText ? 0 : undefined}
      className={cn(
        "block truncate outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        maxWidthClass,
      )}
      aria-label={overflowing && fullText ? fullText : undefined}
    >
      {fullText}
    </span>
  );

  if (!fullText || !overflowing) {
    return trigger;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        className="max-w-[min(90vw,40rem)] whitespace-pre-wrap break-words rounded-sm border border-border bg-popover px-2 py-1 text-[11px] font-normal leading-normal text-popover-foreground shadow-md [&_svg]:bg-popover [&_svg]:fill-popover"
      >
        {fullText}
      </TooltipContent>
    </Tooltip>
  );
}

function renderCellContent<T>(column: GovernedColumn<T>, row: T) {
  if (column.sticky === "actions" || column.id === "__actions") {
    return column.cell ? column.cell(row) : String(column.accessor(row) ?? "");
  }

  const fullText = String(column.accessor(row) ?? "");
  const overflow = column.cellOverflow ?? "truncate";
  const maxWidthClass = resolveMaxWidthClass(column);

  if (overflow === "wrap") {
    return (
      <div className={cn("whitespace-normal break-words", maxWidthClass)}>
        {column.cell ? column.cell(row) : fullText}
      </div>
    );
  }

  // Custom cell renderers own their chrome (complex trees, tint bars, disclosures).
  // Auto truncate+tooltip applies only to plain accessor text.
  if (column.cell) {
    return (
      <div className={cn("min-w-0", maxWidthClass)}>{column.cell(row)}</div>
    );
  }

  return <TruncatedCell fullText={fullText} maxWidthClass={maxWidthClass} />;
}

function EnumMultiFilter({
  columnHeader,
  options,
  selected,
  onChange,
  disabled = false,
}: {
  columnHeader: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const optionsKey = options.map((o) => o.value).join("\0");
  const selectedKey = selected.join("\0");
  React.useEffect(() => {
    const valid = selected.filter((v) => options.some((o) => o.value === v));
    if (valid.length !== selected.length) {
      onChange(valid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by option/selection values
  }, [optionsKey, selectedKey]);

  const label =
    selected.length === 0
      ? "همه"
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${formatPersianInteger(selected.length)} مورد`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="h-filter-row-height min-h-[var(--filter-row-height)] w-full justify-between px-2 text-caption font-normal"
          aria-label={`فیلتر ${columnHeader}`}
          disabled={disabled}
        >
          <span className="truncate">{label}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div
          className="max-h-60 space-y-1 overflow-y-auto"
          role="group"
          aria-label={`گزینه‌های فیلتر ${columnHeader}`}
        >
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-body-medium hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(state) => {
                    const on = state === true;
                    if (on) {
                      onChange([...selected, option.value]);
                    } else {
                      onChange(selected.filter((v) => v !== option.value));
                    }
                  }}
                  aria-label={option.label}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TableChromeControls<T>({
  columns,
  density,
  hiddenColumnIds,
  onDensityChange,
  onHiddenChange,
  disabled = false,
}: {
  columns: GovernedColumn<T>[];
  density: TableDensity;
  hiddenColumnIds: string[];
  onDensityChange: (next: TableDensity) => void;
  onHiddenChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const hideable = columns.filter((c) => isColumnHideable(c));
  const hiddenSet = new Set(hiddenColumnIds);
  const nextDensity: TableDensity =
    density === "dense" ? "comfortable" : "dense";
  const densityLabel = density === "dense" ? "فشرده" : "راحت";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="tertiary"
        size="sm"
        aria-label={`تراکم ردیف: ${densityLabel}. برای تغییر به ${nextDensity === "dense" ? "فشرده" : "راحت"} فعال کنید`}
        aria-pressed={density === "comfortable"}
        disabled={disabled}
        disabledReason={operationalCopy.tableChromeLoading}
        onClick={() => onDensityChange(nextDensity)}
      >
        <Rows3Icon className="size-3.5" aria-hidden="true" />
        {densityLabel}
      </Button>

      {hideable.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              aria-label="نمایش ستون‌ها"
              disabled={disabled}
              disabledReason={operationalCopy.tableChromeLoading}
            >
              <Columns3Icon className="size-3.5" aria-hidden="true" />
              ستون‌ها
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div
              className="max-h-60 space-y-1 overflow-y-auto"
              role="group"
              aria-label="نمایش ستون‌ها"
            >
              {hideable.map((column) => {
                const visible = !hiddenSet.has(column.id);
                return (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-body-medium hover:bg-muted"
                  >
                    <Checkbox
                      checked={visible}
                      onCheckedChange={(state) => {
                        const show = state === true;
                        if (show) {
                          onHiddenChange(
                            hiddenColumnIds.filter((id) => id !== column.id),
                          );
                        } else {
                          onHiddenChange(
                            sanitizeHiddenColumnIds(
                              [...hiddenColumnIds, column.id],
                              columns,
                            ),
                          );
                        }
                      }}
                      aria-label={column.header}
                    />
                    <span>{column.header}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

export function GovernedDataTable<T>({
  columns,
  rows,
  getRowId,
  sectionDefaultFilters,
  pageSize = 25,
  toolbar,
  rowActions,
  onRowClick,
  rowActivateLabel = "باز کردن رکورد",
  exportSlot,
  emptyMessage,
  emptyKind: emptyKindProp,
  emptyAction,
  loading = false,
  loadingRowCount = 8,
  "aria-label": ariaLabel,
  preferencesKey,
  defaultDensity = GOVERNED_TABLE_DEFAULT_DENSITY,
}: GovernedDataTableProps<T>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollTabbable, setScrollTabbable] = React.useState(false);
  const [horizontallyScrolled, setHorizontallyScrolled] = React.useState(false);
  const { data: session, status: sessionStatus } = useSession();
  const accountId = session?.user?.accountId ?? "anon";
  const sessionReady = sessionStatus !== "loading";

  const prefsKey = `${accountId}:${preferencesKey ?? ""}`;
  const [localPrefsState, setLocalPrefs] = React.useState<{key: string; value: TablePreferences; override: boolean}>(() => ({
    key: prefsKey, value: { density: defaultDensity, hiddenColumnIds: [] }, override: false,
  }));
  const localPrefs = localPrefsState.key === prefsKey ? localPrefsState.value : { density: defaultDensity, hiddenColumnIds: [] };
  const subscribePrefs = React.useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener("divan-table-preferences", notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener("divan-table-preferences", notify);
    };
  }, []);
  const readPrefs = React.useCallback(() =>
    preferencesKey && sessionReady
      ? JSON.stringify(readTablePreferences(accountId, preferencesKey)) : "null",
    [preferencesKey, sessionReady, accountId]);
  const storedPrefs = React.useSyncExternalStore(subscribePrefs, readPrefs, () => "null");
  const rawPrefs = localPrefsState.key === prefsKey && localPrefsState.override
    ? localPrefs : (JSON.parse(storedPrefs) as TablePreferences | null) ?? localPrefs;
  const prefs = { ...rawPrefs, hiddenColumnIds: sanitizeHiddenColumnIds(rawPrefs.hiddenColumnIds, columns) };
  const persistPrefs = (patch: Partial<TablePreferences>) => {
    const next = { ...prefs, ...patch };
    const persisted = Boolean(preferencesKey && sessionReady && writeTablePreferences(accountId, preferencesKey, next));
    setLocalPrefs({ key: prefsKey, value: next, override: !persisted });
  };

  const hiddenColumnIds = prefs.hiddenColumnIds;
  const density = prefs.density;

  const {
    snapshot,
    sort,
    pageIndex,
    setTextFilter,
    setEnumFilter,
    toggleSort,
    clearToSectionDefaults,
    goToPage,
    getFilterValue,
    identity,
  } = useGovernedTableSnapshot({
    columns,
    rows,
    getRowId,
    sectionDefaultFilters,
    pageSize,
    hiddenColumnIds,
  });

  const focusScopeKey = `${identity}:${pageIndex}`;
  const [focusState, setFocusState] = React.useState({
    key: focusScopeKey,
    index: 0,
  });
  const rawFocusedIndex =
    focusState.key === focusScopeKey ? focusState.index : 0;
  const focusedRowIndex = Math.min(
    rawFocusedIndex,
    Math.max(0, snapshot.pageRows.length - 1),
  );
  const setFocusedRowIndex = React.useCallback(
    (index: number) => {
      setFocusState({ key: focusScopeKey, index });
    },
    [focusScopeKey],
  );

  const liveMessage = loading
    ? operationalCopy.actionPending
    : `${formatPersianInteger(snapshot.total)} نتیجه`;

  const displayColumns = React.useMemo(() => {
    const cols = [...snapshot.visible];
    if (rowActions) {
      if (cols.some((c) => c.sticky === "actions")) {
        throw new Error(
          'GovernedDataTable: do not pass sticky:"actions" on a column when rowActions is also provided',
        );
      }
      cols.push({
        id: "__actions",
        header: "اقدامات",
        accessor: () => "",
        sticky: "actions",
        cell: (row) => rowActions(row),
      } satisfies GovernedColumn<T>);
    }
    return cols;
  }, [snapshot.visible, rowActions]);

  const visibilityUiColumns = React.useMemo(
    () => permissionVisibleColumns(columns),
    [columns],
  );

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setScrollTabbable(el.scrollWidth > el.clientWidth + 1);
      setHorizontallyScrolled(Math.abs(el.scrollLeft) > 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [displayColumns, snapshot.pageRows, density]);

  const hasFilterRow = displayColumns.some(
    (c) => c.filter === "text" || c.filter === "enum",
  );

  const onRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    index: number,
    row: T,
  ) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(index + 1, snapshot.pageRows.length - 1);
      setFocusedRowIndex(next);
      const target = event.currentTarget.parentElement?.children[next] as
        | HTMLElement
        | undefined;
      target?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(index - 1, 0);
      setFocusedRowIndex(next);
      const target = event.currentTarget.parentElement?.children[next] as
        | HTMLElement
        | undefined;
      target?.focus();
    } else if (
      onRowClick &&
      (event.key === "Enter" || event.key === " ") &&
      event.target === event.currentTarget
    ) {
      event.preventDefault();
      onRowClick(row);
    }
  };

  const activateRowFromPointer = (event: React.MouseEvent, row: T) => {
    if (!onRowClick) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(
        "a,button,input,textarea,select,[role='menuitem'],[role='menu'],[data-slot='dropdown-menu-content']",
      )
    ) {
      return;
    }
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }
    onRowClick(row);
  };

  const totalPages = snapshot.pageCount;
  const empty = !loading && snapshot.total === 0;
  const filtersDifferFromDefaults = React.useMemo(() => {
    const defaults = Object.entries(sectionDefaultFilters);
    const active = snapshot.activeFilters;
    for (const [key, value] of Object.entries(active)) {
      const def = sectionDefaultFilters[key];
      if (def === undefined) {
        if (typeof value === "string" && value.trim() !== "") return true;
        if (Array.isArray(value) && value.length > 0) return true;
        continue;
      }
      if (JSON.stringify(value) !== JSON.stringify(def)) return true;
    }
    for (const [key] of defaults) {
      if (!(key in active)) {
        const def = sectionDefaultFilters[key];
        if (typeof def === "string" && def.trim() !== "") return true;
        if (Array.isArray(def) && def.length > 0) return true;
      }
    }
    return false;
  }, [sectionDefaultFilters, snapshot.activeFilters]);

  const resolvedEmptyKind =
    emptyKindProp ??
    (filtersDifferFromDefaults ? "filtered" : "noDataYet");
  const resolvedEmptyCopy = emptyStateCopy(resolvedEmptyKind, {
    noDataYetBodyFa: emptyMessage,
  });
  const resolvedEmptyAction =
    emptyAction ??
    (resolvedEmptyKind === "filtered"
      ? {
          labelFa: operationalCopy.clearFilters,
          onClick: clearToSectionDefaults,
        }
      : undefined);
  const rowHeightClass = densityRowClass(density);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-full space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{toolbar}</div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <TableChromeControls
              columns={visibilityUiColumns}
              density={density}
              hiddenColumnIds={hiddenColumnIds}
              disabled={loading}
              onDensityChange={(next) => persistPrefs({ density: next })}
              onHiddenChange={(next) =>
                persistPrefs({ hiddenColumnIds: next })
              }
            />
            {exportSlot ? (
              <div
                className="shrink-0"
                aria-disabled={loading || undefined}
                inert={loading || undefined}
              >
                {exportSlot}
              </div>
            ) : null}
          </div>
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </div>

        <p className="text-caption text-muted-foreground" aria-hidden="true">
          {loading
            ? operationalCopy.actionPending
            : `${formatPersianInteger(snapshot.total)} نتیجه`}
        </p>

        <Table
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          className="w-full"
          containerClassName="w-full"
          containerProps={{
            ref: scrollRef,
            tabIndex: scrollTabbable ? 0 : undefined,
            className: cn(
              "relative w-full overflow-x-auto rounded-md border border-border",
              scrollTabbable &&
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            ),
          }}
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {displayColumns.map((column) => {
                const isSorted = sort?.columnId === column.id;
                const ariaSort = column.sortable
                  ? isSorted
                    ? sort!.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                  : undefined;
                const headMax = resolveMaxWidthClass(column);

                return (
                  <TableHead
                    key={column.id}
                    className={cn(
                      "h-table-header-height min-h-[var(--table-header-height)] whitespace-nowrap bg-surface-subtle text-column-header",
                      stickyHeadClass(column.sticky, horizontallyScrolled),
                      (column.sticky === "actions" ||
                        column.id === "__actions") &&
                        "w-[1%]",
                      headMax,
                      headMax && "truncate",
                    )}
                    aria-sort={ariaSort}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-sm text-column-header outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                        disabled={loading}
                        title={
                          loading ? operationalCopy.tableChromeLoading : undefined
                        }
                        onClick={() => toggleSort(column.id)}
                      >
                        {column.header}
                        {isSorted ? (
                          <span aria-hidden="true">
                            {sort!.direction === "asc" ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>

            {hasFilterRow ? (
              <TableRow className="hover:bg-transparent">
                {displayColumns.map((column) => (
                  <TableHead
                    key={`filter-${column.id}`}
                    className={cn(
                      "h-filter-row-height min-h-[var(--filter-row-height)] bg-background p-1",
                      column.sticky === "identifier" &&
                        cn(
                          "sticky start-0 z-10 bg-background",
                          stickySeparatorClass(
                            "identifier",
                            horizontallyScrolled,
                          ),
                        ),
                      column.sticky === "actions" &&
                        cn(
                          "sticky end-0 z-20 bg-background",
                          stickySeparatorClass("actions", horizontallyScrolled),
                        ),
                    )}
                  >
                    {column.filter === "text" ? (
                      <Input
                        value={String(getFilterValue(column) ?? "")}
                        onChange={(e) =>
                          setTextFilter(column.id, e.target.value)
                        }
                        disabled={loading}
                        aria-label={`فیلتر ${column.header}`}
                        className="h-filter-row-height min-h-[var(--filter-row-height)] text-caption"
                      />
                    ) : column.filter === "enum" && column.enumOptions ? (
                      <EnumMultiFilter
                        columnHeader={column.header}
                        options={column.enumOptions}
                        selected={
                          Array.isArray(getFilterValue(column))
                            ? (getFilterValue(column) as string[])
                            : []
                        }
                        onChange={(next) => setEnumFilter(column.id, next)}
                        disabled={loading}
                      />
                    ) : null}
                  </TableHead>
                ))}
              </TableRow>
            ) : null}
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableSkeleton
                columnCount={displayColumns.length}
                rowCount={loadingRowCount}
                density={density}
                horizontallyScrolled={horizontallyScrolled}
                columnStickies={displayColumns.map((c) =>
                  c.sticky === "actions" || c.id === "__actions"
                    ? "actions"
                    : c.sticky,
                )}
                hasActionsColumn={displayColumns.some(
                  (c) => c.sticky === "actions" || c.id === "__actions",
                )}
              />
            ) : empty ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={Math.max(displayColumns.length, 1)}
                  className="h-32 text-center"
                >
                  <EmptyState
                    kind={resolvedEmptyKind}
                    messageFa={
                      resolvedEmptyKind === "filtered"
                        ? undefined
                        : emptyMessage
                    }
                    noDataYetBodyFa={
                      resolvedEmptyKind === "noDataYet"
                        ? (emptyMessage ?? resolvedEmptyCopy.bodyFa)
                        : undefined
                    }
                    onAction={
                      resolvedEmptyAction
                        ? resolvedEmptyAction.onClick
                        : undefined
                    }
                    noDataYetActionFa={
                      resolvedEmptyKind === "noDataYet"
                        ? resolvedEmptyAction?.labelFa
                        : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              snapshot.pageRows.map((row, index) => {
                const rowId = getRowId(row);
                return (
                  <TableRow
                    key={rowId}
                    tabIndex={0}
                    data-focused={
                      focusedRowIndex === index ? "true" : undefined
                    }
                    data-density={density}
                    aria-description={onRowClick ? rowActivateLabel : undefined}
                    className={cn(
                      "group outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      rowHeightClass,
                      onRowClick && "cursor-pointer hover:bg-muted/40",
                    )}
                    onFocus={() => setFocusedRowIndex(index)}
                    onClick={
                      onRowClick
                        ? (event) => {
                            activateRowFromPointer(event, row);
                          }
                        : undefined
                    }
                    onKeyDown={(e) => onRowKeyDown(e, index, row)}
                  >
                    {displayColumns.map((column) => (
                      <TableCell
                        key={`${rowId}-${column.id}`}
                        className={cn(
                          "py-0",
                          rowHeightClass,
                          stickyBodyClass(
                            column.sticky,
                            horizontallyScrolled,
                          ),
                          column.sticky === "actions" ||
                            column.id === "__actions"
                            ? "w-[1%] whitespace-nowrap"
                            : undefined,
                          column.cellOverflow === "wrap"
                            ? "whitespace-normal align-middle"
                            : undefined,
                        )}
                        onClick={
                          column.id === "__actions" ||
                          column.sticky === "actions"
                            ? (event) => {
                                event.stopPropagation();
                              }
                            : undefined
                        }
                      >
                        {renderCellContent(column, row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {!loading && !empty ? (
          <nav
            className="flex flex-wrap items-center justify-between gap-2"
            aria-label="صفحه‌بندی جدول"
          >
            <p className="text-caption text-muted-foreground">
              صفحه {toPersianDigits(pageIndex + 1)} از{" "}
              {toPersianDigits(totalPages)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                disabled={pageIndex <= 0}
                disabledReason={
                  pageIndex <= 0 ? "اولین صفحه هستید." : undefined
                }
                onClick={() => goToPage(pageIndex - 1)}
                aria-label="صفحه قبل"
              >
                قبلی
              </Button>
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                disabled={pageIndex >= totalPages - 1}
                disabledReason={
                  pageIndex >= totalPages - 1
                    ? "آخرین صفحه هستید."
                    : undefined
                }
                onClick={() => goToPage(pageIndex + 1)}
                aria-label="صفحه بعد"
              >
                بعدی
              </Button>
            </div>
          </nav>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
