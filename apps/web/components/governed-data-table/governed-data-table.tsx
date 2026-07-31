"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

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
import { operationalCopy } from "@/lib/operational-copy";
import { formatPersianInteger, toPersianDigits } from "@/lib/persian-digits";
import { cn } from "@/lib/utils";

import type { GovernedColumn, GovernedDataTableProps } from "./types";
import { useGovernedTableSnapshot } from "./use-governed-table-snapshot";

function stickyClass(sticky: GovernedColumn<unknown>["sticky"] | undefined) {
  if (sticky === "identifier") {
    return "sticky start-0 z-10 bg-background group-hover:bg-muted/50 group-data-[focused=true]:bg-muted/60";
  }
  if (sticky === "actions") {
    return "sticky end-0 z-20 bg-background group-hover:bg-muted/50 group-data-[focused=true]:bg-muted/60";
  }
  return undefined;
}

function stickyHeadClass(
  sticky: GovernedColumn<unknown>["sticky"] | undefined,
) {
  if (sticky === "identifier") {
    return "sticky start-0 z-10 bg-muted";
  }
  if (sticky === "actions") {
    return "sticky end-0 z-20 bg-muted";
  }
  return undefined;
}

function EnumMultiFilter({
  columnHeader,
  options,
  selected,
  onChange,
}: {
  columnHeader: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  // Prune stale selections not present in current options.
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

export function GovernedDataTable<T>({
  columns,
  rows,
  getRowId,
  sectionDefaultFilters,
  pageSize = 25,
  toolbar,
  rowActions,
  exportSlot,
  emptyMessage,
  "aria-label": ariaLabel,
}: GovernedDataTableProps<T>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollTabbable, setScrollTabbable] = React.useState(false);

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

  const liveMessage = `${formatPersianInteger(snapshot.total)} نتیجه`;

  const displayColumns = React.useMemo(() => {
    const cols = [...snapshot.visible];
    if (rowActions) {
      if (cols.some((c) => c.sticky === "actions")) {
        throw new Error(
          "GovernedDataTable: do not pass sticky:\"actions\" on a column when rowActions is also provided",
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

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setScrollTabbable(el.scrollWidth > el.clientWidth + 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [displayColumns, snapshot.pageRows]);

  const hasFilterRow = displayColumns.some(
    (c) => c.filter === "text" || c.filter === "enum",
  );

  const onRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    index: number,
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
    }
  };

  const totalPages = snapshot.pageCount;
  const empty = snapshot.total === 0;

  return (
    <div className="w-full space-y-3">
      {(toolbar || exportSlot) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {exportSlot ? <div className="shrink-0">{exportSlot}</div> : null}
        </div>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>

      <p className="text-caption text-muted-foreground" aria-hidden="true">
        {formatPersianInteger(snapshot.total)} نتیجه
      </p>

      <Table
        aria-label={ariaLabel}
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

              return (
                <TableHead
                  key={column.id}
                  className={cn(
                    "bg-muted text-caption font-medium",
                    stickyHeadClass(column.sticky),
                  )}
                  aria-sort={ariaSort}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-sm text-caption outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                      "sticky start-0 z-10 bg-background",
                    column.sticky === "actions" &&
                      "sticky end-0 z-20 bg-background",
                  )}
                >
                  {column.filter === "text" ? (
                    <Input
                      value={String(getFilterValue(column) ?? "")}
                      onChange={(e) => setTextFilter(column.id, e.target.value)}
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
                    />
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          ) : null}
        </TableHeader>

        <TableBody>
          {empty ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={Math.max(displayColumns.length, 1)}
                className="h-32 text-center"
              >
                <div className="flex flex-col items-center gap-3 py-4">
                  <p className="text-body-medium">
                    {emptyMessage ?? operationalCopy.emptySearch}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={clearToSectionDefaults}
                  >
                    {operationalCopy.clearFilters}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            snapshot.pageRows.map((row, index) => {
              const rowId = getRowId(row);
              return (
                <TableRow
                  key={rowId}
                  tabIndex={0}
                  data-focused={focusedRowIndex === index ? "true" : undefined}
                  className={cn(
                    "group h-table-row-compact min-h-[var(--table-row-compact)] outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  )}
                  onFocus={() => setFocusedRowIndex(index)}
                  onKeyDown={(e) => onRowKeyDown(e, index)}
                >
                  {displayColumns.map((column) => (
                    <TableCell
                      key={`${rowId}-${column.id}`}
                      className={cn(
                        "h-table-row-compact min-h-[var(--table-row-compact)] py-0",
                        stickyClass(column.sticky),
                      )}
                    >
                      {column.cell
                        ? column.cell(row)
                        : String(column.accessor(row) ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {!empty ? (
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
              onClick={() => goToPage(pageIndex + 1)}
              aria-label="صفحه بعد"
            >
              بعدی
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
