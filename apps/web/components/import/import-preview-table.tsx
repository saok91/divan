"use client";

import * as React from "react";

import type { GovernedColumn } from "@/components/governed-data-table";
import { GovernedDataTable } from "@/components/governed-data-table";
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { cn } from "@/lib/utils";

const DATE_COLUMN_KEYS = new Set(["birthDate", "startDate"]);

function formatPreviewCell(columnKey: string, raw: string): string {
  if (!raw) return "—";
  if (DATE_COLUMN_KEYS.has(columnKey)) {
    return formatJalaliDisplayFromGregorian(raw) || raw;
  }
  return raw;
}

export type ImportPreviewTableRow = {
  rowId: string;
  sourceRow: number;
  severity: "ok" | "error" | "warning";
  values: Record<string, string>;
};

export type ImportPreviewColumn = {
  key: string;
  headerFa: string;
};

type ImportPreviewTableProps = {
  columns: ImportPreviewColumn[];
  rows: ImportPreviewTableRow[];
  issueCitesFa: string[];
  "aria-label"?: string;
};

function severityRowClass(severity: ImportPreviewTableRow["severity"]): string {
  if (severity === "error") return "bg-destructive/10";
  if (severity === "warning") return "bg-amber-500/15";
  return "";
}

/**
 * Thin wrapper over GovernedDataTable — row tint via cell chrome only
 * (no public-contract change to the primitive).
 */
export function ImportPreviewTable({
  columns,
  rows,
  issueCitesFa,
  "aria-label": ariaLabel = "جدول پیش‌نمایش واردسازی",
}: ImportPreviewTableProps) {
  const governedColumns = React.useMemo<
    GovernedColumn<ImportPreviewTableRow>[]
  >(() => {
    const sourceCol: GovernedColumn<ImportPreviewTableRow> = {
      id: "sourceRow",
      header: "ردیف",
      sticky: "identifier",
      sortable: true,
      accessor: (row) => row.sourceRow,
      cell: (row) => (
        <div
          className={cn(
            "-mx-3 flex items-center self-stretch px-3",
            "min-h-[var(--table-row-dense)] group-data-[density=comfortable]:min-h-[var(--table-row-comfortable)]",
            severityRowClass(row.severity),
          )}
        >
          <span className="text-tabular" dir="ltr">
            {toPersianDigits(row.sourceRow)}
          </span>
        </div>
      ),
    };

    const dataCols: GovernedColumn<ImportPreviewTableRow>[] = columns.map(
      (col) => ({
        id: col.key,
        header: col.headerFa,
        filter: "text" as const,
        sortable: true,
        accessor: (row) => row.values[col.key] ?? "",
        cell: (row) => (
          <div
            className={cn(
              "-mx-3 flex items-center self-stretch px-3",
              "min-h-[var(--table-row-dense)] group-data-[density=comfortable]:min-h-[var(--table-row-comfortable)]",
              severityRowClass(row.severity),
            )}
          >
            {formatPreviewCell(col.key, row.values[col.key] ?? "")}
          </div>
        ),
      }),
    );

    return [sourceCol, ...dataCols];
  }, [columns]);

  return (
    <div className="space-y-3" data-slot="import-preview-table">
      <GovernedDataTable
        columns={governedColumns}
        rows={rows}
        getRowId={(row) => row.rowId}
        sectionDefaultFilters={{}}
        pageSize={25}
        preferencesKey="import-preview"
        aria-label={ariaLabel}
      />

      {issueCitesFa.length > 0 ? (
        <div className="space-y-1" role="region" aria-label="فهرست اشکالات">
          <p className="text-body-medium">{operationalCopy.importValidationSummary}</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {issueCitesFa.map((cite, i) => (
              <li key={`${i}-${cite.slice(0, 24)}`} className="text-caption">
                {toPersianDigits(cite)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
