"use client";

import * as React from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { todayDateOnlyTehran } from "@divan/temporal-engine";
import type { ReportSubject } from "@divan/reporting/catalogue";
import { FileSearch } from "lucide-react";

import { ExportArtifactPanel } from "@/components/export/export-artifact-panel";
import { CategoricalBarChart } from "@/components/charts";
import { extractReportCategoricalDistribution } from "@/components/charts/report-chart-distribution";
import type { GovernedColumn } from "@/components/governed-data-table";
import { GovernedDataTable } from "@/components/governed-data-table";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import { DecisionPublicationPanel } from "@/components/reports/decision-publication-panel";
import {
  ReportFilters,
  type ReportFilterState,
} from "@/components/reports/report-filters";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { RowActionButton } from "@/components/ui/row-action-button";
import { Skeleton } from "@/components/ui/skeleton";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import {
  buildReportPath,
  buildReportSearchParams,
  parseReportSearchParams,
  reportKeyFromPathname,
} from "@/lib/report-url";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type ReportTableRow = {
  id: string;
  href?: string;
  cells: Record<string, string | number | null>;
};

type CatalogueEntry = {
  key: string;
  titleFa: string;
  purposeFa: string;
  subject: ReportSubject;
  runnable: boolean;
  accessRequirementFa?: string;
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

function formatAsOfLabel(
  evaluationMode: "current" | "as_of" | undefined,
  asOf: string | undefined,
): string {
  if (evaluationMode === "as_of" && asOf) {
    return toPersianDigits(asOf);
  }
  if (asOf) {
    return toPersianDigits(asOf);
  }
  return "جاری";
}

export type ReportWorkspaceProps = {
  subject: ReportSubject;
};

/**
 * Reports workspace host: catalogue rail · parameters · explicit run · result meta.
 * URL contract: `/reports/{subject}/{reportKey}?…&run=1` (Story 9.5).
 */
export function ReportWorkspace({ subject }: ReportWorkspaceProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 px-content-padding-inline py-4">
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <ReportWorkspaceInner subject={subject} />
    </Suspense>
  );
}

function ReportWorkspaceInner({ subject }: ReportWorkspaceProps) {
  const defaults = React.useMemo(() => defaultRange(), []);
  const leaveGuard = useLeaveGuardOptional();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlFilters = React.useMemo(
    () =>
      parseReportSearchParams(searchParams, {
        rangeStart: defaults.start,
        rangeEnd: defaults.end,
      }),
    [searchParams, defaults],
  );

  const pathKey = reportKeyFromPathname(pathname, subject);
  const [invalidPathKey, setInvalidPathKey] = React.useState(false);

  React.useEffect(() => {
    const prefix = `/reports/${subject}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const rest = pathname.slice(prefix.length + 1);
      const segment = rest.split("/")[0]?.trim() ?? "";
      if (segment && !pathKey) {
        setInvalidPathKey(true);
      } else {
        setInvalidPathKey(false);
      }
    }
  }, [pathname, subject, pathKey]);

  const [draftFilters, setDraftFilters] = React.useState<ReportFilterState>({
    teamId: urlFilters.teamId,
    evaluationMode: urlFilters.evaluationMode,
    asOfDate: urlFilters.asOfDate,
    rangeStart: urlFilters.rangeStart,
    rangeEnd: urlFilters.rangeEnd,
  });

  React.useEffect(() => {
    setDraftFilters({
      teamId: urlFilters.teamId,
      evaluationMode: urlFilters.evaluationMode,
      asOfDate: urlFilters.asOfDate,
      rangeStart: urlFilters.rangeStart,
      rangeEnd: urlFilters.rangeEnd,
    });
  }, [urlFilters]);

  const catalogueQuery = api.report.catalogue.useQuery(undefined, {
    staleTime: 60_000,
  });

  const subjectReports: CatalogueEntry[] = React.useMemo(() => {
    const all = (catalogueQuery.data?.reports ?? []) as CatalogueEntry[];
    return all.filter((r) => r.subject === subject);
  }, [catalogueQuery.data?.reports, subject]);

  const defaultRunnableKey =
    subjectReports.find((r) => r.runnable)?.key ??
    subjectReports[0]?.key ??
    null;

  const selectedKey: string | null = React.useMemo(() => {
    if (pathKey && subjectReports.some((r) => r.key === pathKey)) {
      return pathKey;
    }
    return defaultRunnableKey;
  }, [pathKey, subjectReports, defaultRunnableKey]);

  const selectedEntry = subjectReports.find((r) => r.key === selectedKey);
  const selectedRunnable = selectedEntry?.runnable === true;

  const runIntent = urlFilters.run === true && selectedRunnable;

  const replaceUrl = React.useCallback(
    (args: {
      reportKey?: string | null;
      filters: ReportFilterState;
      run?: boolean;
    }) => {
      const path = buildReportPath(subject, args.reportKey);
      const qs = buildReportSearchParams({
        ...args.filters,
        run: args.run === true,
      });
      const href = qs ? `${path}?${qs}` : path;
      router.replace(href);
    },
    [subject, router],
  );

  // Hydrate default key into path when landing on subject root.
  React.useEffect(() => {
    if (catalogueQuery.isLoading || !defaultRunnableKey) return;
    if (pathKey && subjectReports.some((r) => r.key === pathKey)) return;
    if (invalidPathKey) {
      replaceUrl({
        reportKey: defaultRunnableKey,
        filters: draftFilters,
        run: false,
      });
      return;
    }
    if (!pathKey && defaultRunnableKey) {
      replaceUrl({
        reportKey: defaultRunnableKey,
        filters: draftFilters,
        run: urlFilters.run && selectedRunnable,
      });
    }
    // Only on catalogue / path identity changes — not every filter draft keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount/path hydrate
  }, [
    catalogueQuery.isLoading,
    defaultRunnableKey,
    pathKey,
    invalidPathKey,
    subjectReports,
  ]);

  const queryInput = React.useMemo(
    () => ({
      reportKey: selectedKey ?? "",
      teamId: urlFilters.teamId.trim() ? urlFilters.teamId.trim() : undefined,
      evaluationMode: urlFilters.evaluationMode,
      asOfDate:
        urlFilters.evaluationMode === "as_of"
          ? urlFilters.asOfDate
          : undefined,
      rangeStart: urlFilters.rangeStart?.trim() || undefined,
      rangeEnd: urlFilters.rangeEnd?.trim() || undefined,
    }),
    [urlFilters, selectedKey],
  );

  const runQuery = api.report.run.useQuery(queryInput, {
    enabled: Boolean(selectedKey && queryInput.reportKey && runIntent),
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
  let statusKind: "error" | "empty" | "pending" | "info" = "info";
  if (suppressed) {
    statusMessage =
      runQuery.data?.messageFa ?? operationalCopy.suppressedCohort;
    statusKind = "info";
  } else if (empty) {
    statusMessage =
      runQuery.data?.messageFa ?? operationalCopy.emptyReportScope;
    statusKind = "empty";
  } else if (unavailable) {
    statusMessage =
      runQuery.data?.messageFa ??
      operationalCopy.reportImportBatchUnavailable;
    statusKind = "info";
  } else if (pending) {
    statusMessage =
      runQuery.data?.messageFa ?? operationalCopy.figureRecalculating;
    statusKind = "pending";
  } else if (errorOutcome) {
    statusMessage =
      runQuery.data?.messageFa ?? operationalCopy.reportLoadError;
    statusKind = "error";
  } else if (outcome === "allowed" && runQuery.data?.messageFa) {
    statusMessage = runQuery.data.messageFa;
    statusKind = "info";
  } else if (outcome === "omitted") {
    statusMessage =
      runQuery.data?.messageFa ?? operationalCopy.accessDeniedTitle;
    statusKind = "error";
  }

  const disclosure = catalogueQuery.data?.populationDisclosureFa;

  const openHref = (href: string) => {
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
    } else if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  };

  const rowCount = runQuery.data && !suppressed ? tableRows.length : null;

  const metaRow =
    runQuery.data && runIntent ? (
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground"
        data-report-run-meta
      >
        <span>
          مبنا:{" "}
          <span className="text-tabular" dir="ltr">
            {formatAsOfLabel(
              runQuery.data.evaluationMode,
              runQuery.data.filter.asOf,
            )}
          </span>
        </span>
        {runQuery.data.lastCalculatedAt != null ? (
          <span>
            آخرین محاسبه:{" "}
            <span className="text-tabular" dir="ltr">
              {toPersianDigits(runQuery.data.lastCalculatedAt)}
            </span>
          </span>
        ) : null}
        {rowCount != null ? (
          <span>
            تعداد ردیف:{" "}
            <span className="text-tabular" dir="ltr">
              {toPersianDigits(rowCount)}
            </span>
          </span>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="flex min-h-0 flex-col gap-4 px-content-padding-inline py-4 lg:flex-row lg:items-start">
      {/* Catalogue rail */}
      <aside className="w-full shrink-0 space-y-2 lg:w-64">
        <p className="text-label">کاتالوگ گزارش‌ها</p>
        {catalogueQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : catalogueQuery.error ? (
          <FeedbackMessage kind="error">
            {catalogueQuery.error.message || operationalCopy.reportLoadError}
          </FeedbackMessage>
        ) : subjectReports.length === 0 ? (
          <FeedbackMessage kind="empty">
            {operationalCopy.emptyReportScope}
          </FeedbackMessage>
        ) : (
          <div
            className="flex flex-col gap-1"
            role="radiogroup"
            aria-label="کاتالوگ گزارش‌های این موضوع"
          >
            {subjectReports.map((r) => {
              const selected = r.key === selectedKey;
              const locked = !r.runnable;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={locked || fetching}
                  title={
                    locked
                      ? r.accessRequirementFa
                      : fetching
                        ? operationalCopy.reportCatalogueBusy
                        : undefined
                  }
                  aria-description={
                    locked
                      ? r.accessRequirementFa
                      : fetching
                        ? operationalCopy.reportCatalogueBusy
                        : r.purposeFa
                  }
                  onClick={() => {
                    if (locked) return;
                    replaceUrl({
                      reportKey: r.key,
                      filters: draftFilters,
                      run: false,
                    });
                  }}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-start",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input bg-background text-foreground",
                    locked && "cursor-not-allowed opacity-60",
                    "disabled:opacity-50",
                  )}
                >
                  <span className="block text-body">{r.titleFa}</span>
                  <span className="mt-0.5 block text-caption text-muted-foreground">
                    {r.purposeFa}
                  </span>
                  {locked && r.accessRequirementFa ? (
                    <span className="mt-1 block text-caption text-destructive">
                      {r.accessRequirementFa}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        {disclosure ? (
          <FeedbackMessage kind="info">{disclosure}</FeedbackMessage>
        ) : null}
        {invalidPathKey ? (
          <FeedbackMessage kind="error">
            کلید گزارش برای این موضوع نامعتبر است؛ به گزارش پیش‌فرض برگشتیم.
          </FeedbackMessage>
        ) : null}
      </aside>

      {/* Params + result */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-2">
          <p className="text-label">پارامترها و اجرا</p>
          <ReportFilters
            value={draftFilters}
            disabled={fetching || !selectedRunnable}
            submitLabel="اجرا"
            onApply={(next) => {
              setDraftFilters(next);
              if (!selectedKey || !selectedRunnable) return;
              replaceUrl({
                reportKey: selectedKey,
                filters: next,
                run: true,
              });
            }}
          />
          {!selectedRunnable && selectedEntry?.accessRequirementFa ? (
            <FeedbackMessage kind="info">
              {selectedEntry.accessRequirementFa}
            </FeedbackMessage>
          ) : null}
        </div>

        {!runIntent && selectedRunnable ? (
          <FeedbackMessage kind="info">
            پس از تنظیم پارامترها، «اجرا» را بزنید تا نتیجه بارگذاری شود.
          </FeedbackMessage>
        ) : null}

        {runQuery.isLoading && runIntent ? (
          <FeedbackMessage kind="loading">
            در حال اجرای گزارش…
          </FeedbackMessage>
        ) : null}

        {runQuery.isLoading && runIntent ? (
          <Skeleton className="h-40 w-full" />
        ) : null}

        {runIntent && runQuery.error ? (
          <FeedbackMessage kind="error">
            {runQuery.error.message || operationalCopy.reportLoadError}
          </FeedbackMessage>
        ) : null}

        {runIntent && statusMessage ? (
          <FeedbackMessage kind={statusKind}>{statusMessage}</FeedbackMessage>
        ) : null}

        {metaRow}

        {runQuery.data &&
        runIntent &&
        outcome === "allowed" &&
        !suppressed
          ? (() => {
              const buckets = extractReportCategoricalDistribution(
                runQuery.data.reportKey,
                runQuery.data.columns,
                runQuery.data.rows,
              );
              if (!buckets) return null;
              return (
                <CategoricalBarChart
                  aria-label={`نمودار ${runQuery.data.titleFa}`}
                  seriesLabel="تعداد"
                  data={buckets}
                  className="border-b border-hairline pb-4"
                />
              );
            })()
          : null}

        {runQuery.data &&
        runIntent &&
        !suppressed &&
        !empty &&
        !unavailable &&
        !pending &&
        columns.length > 0 ? (
          <GovernedDataTable
            aria-label={runQuery.data.titleFa}
            preferencesKey={`report-catalogue-${selectedKey ?? runQuery.data.titleFa}`}
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
                      <RowActionButton
                        label="مشاهده"
                        icon={FileSearch}
                        onClick={() => openHref(row.href!)}
                      />
                    ) : null
                : undefined
            }
          />
        ) : null}

        {runQuery.data &&
        runIntent &&
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
      </div>
    </div>
  );
}
