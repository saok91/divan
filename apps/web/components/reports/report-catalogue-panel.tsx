"use client";

import * as React from "react";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import { ExportArtifactPanel } from "@/components/export/export-artifact-panel";
import type { GovernedColumn } from "@/components/governed-data-table";
import { GovernedDataTable } from "@/components/governed-data-table";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import { DecisionPublicationPanel } from "@/components/reports/decision-publication-panel";
import {
  ReportFilters,
  type ReportFilterState,
} from "@/components/reports/report-filters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type ReportTableRow = {
  id: string;
  href?: string;
  cells: Record<string, string | number | null>;
};

/** Default ~6 calendar months ending on Tehran today. */
function defaultRange(): { start: string; end: string } {
  const end = todayDateOnlyTehran();
  const [ys, ms, ds] = end.split("-");
  let y = Number(ys);
  let m = Number(ms);
  const d = Number(ds);
  m -= 5;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(d, dim);
  const start = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { start, end };
}

function formatCell(value: string | number | null | undefined): React.ReactNode {
  if (value == null) return "—";
  if (typeof value === "number") {
    return (
      <span className="text-tabular" dir="ltr">
        {toPersianDigits(value)}
      </span>
    );
  }
  // Digits in date / codes → Persian tabular
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d+$/.test(value)) {
    return (
      <span className="text-tabular" dir="ltr">
        {toPersianDigits(value)}
      </span>
    );
  }
  return value;
}

function buildColumns(
  columnDefs: { id: string; headerFa: string; permitted?: boolean }[],
): GovernedColumn<ReportTableRow>[] {
  return columnDefs.map((c, index) => ({
    id: c.id,
    header: c.headerFa,
    permitted: c.permitted,
    accessor: (r) => {
      const v = r.cells[c.id];
      return v == null ? "" : String(v);
    },
    sticky: index === 0 ? ("identifier" as const) : undefined,
    sortable: true,
    filter: "text" as const,
    cell: (r) => formatCell(r.cells[c.id]),
  }));
}

/**
 * Host: catalogue select + shared filters + GovernedDataTable result + export stub.
 */
export function ReportCataloguePanel() {
  const defaults = React.useMemo(() => defaultRange(), []);
  const leaveGuard = useLeaveGuardOptional();
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<ReportFilterState>({
    teamId: "",
    evaluationMode: "current",
    asOfDate: undefined,
    rangeStart: defaults.start,
    rangeEnd: defaults.end,
  });
  const [applied, setApplied] = React.useState(filters);

  const catalogueQuery = api.report.catalogue.useQuery(undefined, {
    staleTime: 60_000,
  });

  const reports = catalogueQuery.data?.reports ?? [];
  const effectiveKey =
    selectedKey && reports.some((r) => r.key === selectedKey)
      ? selectedKey
      : (reports[0]?.key ?? null);

  const queryInput = React.useMemo(
    () => ({
      reportKey: effectiveKey ?? "",
      teamId: applied.teamId.trim() ? applied.teamId.trim() : undefined,
      evaluationMode: applied.evaluationMode,
      asOfDate:
        applied.evaluationMode === "as_of" ? applied.asOfDate : undefined,
      rangeStart: applied.rangeStart?.trim() || undefined,
      rangeEnd: applied.rangeEnd?.trim() || undefined,
    }),
    [applied, effectiveKey],
  );

  const runQuery = api.report.run.useQuery(queryInput, {
    enabled: Boolean(effectiveKey && queryInput.reportKey),
    staleTime: 30_000,
  });

  const fetching = catalogueQuery.isFetching || runQuery.isFetching;

  const outcome = runQuery.data?.outcome;
  const suppressed = outcome === "suppressed";
  const empty = outcome === "empty";
  const unavailable = outcome === "unavailable";
  const pending = outcome === "pending";
  const errorOutcome = outcome === "error";

  const tableRows: ReportTableRow[] =
    suppressed || !runQuery.data
      ? []
      : runQuery.data.rows.map((r) => ({
          id: r.id,
          href: r.href,
          cells: r.cells,
        }));

  const columns = React.useMemo(
    () => buildColumns(runQuery.data?.columns ?? []),
    [runQuery.data?.columns],
  );

  let statusMessage: string | null = null;
  if (suppressed) {
    statusMessage =
      runQuery.data?.messageFa ?? operationalCopy.suppressedCohort;
  } else if (empty) {
    statusMessage =
      runQuery.data?.messageFa ?? operationalCopy.emptyReportScope;
  } else if (unavailable) {
    statusMessage =
      runQuery.data?.messageFa ??
      operationalCopy.reportImportBatchUnavailable;
  } else if (pending) {
    statusMessage = runQuery.data?.messageFa ?? operationalCopy.reportPending;
  } else if (errorOutcome) {
    statusMessage =
      runQuery.data?.messageFa ?? operationalCopy.reportLoadError;
  } else if (outcome === "allowed" && runQuery.data?.messageFa) {
    statusMessage = runQuery.data.messageFa;
  } else if (outcome === "omitted") {
    statusMessage =
      runQuery.data?.messageFa ?? operationalCopy.accessDeniedTitle;
  }

  const disclosure = catalogueQuery.data?.populationDisclosureFa;

  const openHref = (href: string) => {
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
    } else if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  };

  const lastCalc =
    runQuery.data?.lastCalculatedAt != null ? (
      <p className="text-caption text-muted-foreground">
        آخرین محاسبه:{" "}
        <span className="text-tabular" dir="ltr">
          {toPersianDigits(runQuery.data.lastCalculatedAt)}
        </span>
      </p>
    ) : null;

  return (
    <div className="space-y-4">
      <ReportFilters
        value={filters}
        disabled={fetching}
        onApply={(next) => {
          setFilters(next);
          setApplied(next);
        }}
      />

      <div className="space-y-2">
        <p className="text-label">کاتالوگ گزارش‌های راه‌اندازی</p>
        {catalogueQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : catalogueQuery.error ? (
          <p className="text-body text-destructive" role="alert">
            {catalogueQuery.error.message || operationalCopy.reportLoadError}
          </p>
        ) : (catalogueQuery.data?.reports ?? []).length === 0 ? (
          <p className="text-body text-muted-foreground" role="status">
            {operationalCopy.emptyReportScope}
          </p>
        ) : (
          <div
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            role="radiogroup"
            aria-label="کاتالوگ گزارش‌ها"
          >
            {(catalogueQuery.data?.reports ?? []).map((r) => {
              const selected = r.key === effectiveKey;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={fetching}
                  onClick={() => setSelectedKey(r.key)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-start text-body",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input bg-background text-foreground",
                    "disabled:opacity-50",
                  )}
                >
                  {r.titleFa}
                </button>
              );
            })}
          </div>
        )}
        {disclosure ? (
          <p className="text-caption text-muted-foreground">{disclosure}</p>
        ) : null}
      </div>

      {runQuery.isLoading && effectiveKey ? (
        <Skeleton className="h-40 w-full" />
      ) : null}

      {runQuery.error ? (
        <p className="text-body text-destructive" role="alert">
          {runQuery.error.message || operationalCopy.reportLoadError}
        </p>
      ) : null}

      {statusMessage ? (
        <p
          className={cn(
            "text-body",
            errorOutcome ? "text-destructive" : "text-muted-foreground",
          )}
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}

      {runQuery.data &&
      !suppressed &&
      !empty &&
      !unavailable &&
      columns.length > 0 ? (
        <div className="[&_[data-slot=table]]:min-w-[48rem]">
          <GovernedDataTable
            aria-label={runQuery.data.titleFa}
            columns={columns}
            rows={tableRows}
            getRowId={(row) => row.id}
            sectionDefaultFilters={{}}
            pageSize={25}
            toolbar={
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-body">{runQuery.data.titleFa}</p>
                {runQuery.data.reconcileHref ? (
                  <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    onClick={() => openHref(runQuery.data!.reconcileHref!)}
                  >
                    {runQuery.data.reconcileLabelFa ?? "مشاهده مرتبط"}
                  </Button>
                ) : null}
                {lastCalc}
              </div>
            }
            exportSlot={
              runQuery.data?.exportAvailable &&
              runQuery.data.exportSnapshotHash ? (
                <ExportArtifactPanel
                  source={{
                    kind: "report",
                    reviewedSnapshotHash: runQuery.data.exportSnapshotHash,
                    filter: {
                      reportKey: runQuery.data.filter.reportKey,
                      teamId: runQuery.data.filter.teamId,
                      evaluationMode: runQuery.data.evaluationMode,
                      asOfDate: runQuery.data.filter.asOf,
                      rangeStart: runQuery.data.filter.rangeStart || undefined,
                      rangeEnd: runQuery.data.filter.rangeEnd || undefined,
                    },
                  }}
                />
              ) : undefined
            }
            rowActions={
              tableRows.some((r) => r.href)
                ? (row) =>
                    row.href ? (
                      <Button
                        type="button"
                        variant="rowAction"
                        size="xs"
                        onClick={() => openHref(row.href!)}
                      >
                        مشاهده
                      </Button>
                    ) : null
                : undefined
            }
          />
        </div>
      ) : null}

      {runQuery.data &&
      outcome === "allowed" &&
      runQuery.data.exportSnapshotHash ? (
        <DecisionPublicationPanel
          reportKey={runQuery.data.filter.reportKey}
          reviewedSnapshotHash={runQuery.data.exportSnapshotHash}
          fieldIds={runQuery.data.columns
            .filter((c) => c.permitted !== false)
            .map((c) => c.id)}
          evaluationMode={runQuery.data.evaluationMode}
          asOfDate={runQuery.data.filter.asOf}
          teamId={runQuery.data.filter.teamId}
          rangeStart={runQuery.data.filter.rangeStart || undefined}
          rangeEnd={runQuery.data.filter.rangeEnd || undefined}
        />
      ) : null}

      {runQuery.data &&
      (empty ||
        unavailable ||
        suppressed ||
        pending ||
        errorOutcome ||
        outcome === "omitted") &&
      lastCalc ? (
        <div>{lastCalc}</div>
      ) : null}
    </div>
  );
}
