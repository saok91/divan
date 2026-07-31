"use client";

import * as React from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  DashboardFilters,
  type DashboardFilterState,
} from "@/components/dashboard/dashboard-filters";
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/** Default ~6 calendar months ending on Tehran today (not UTC wall clock). */
function defaultTrendRange(): { start: string; end: string } {
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

function detailLinesForCard(card: {
  key: string;
  details?: Record<string, number | string | boolean | null>;
  trend?: { bucketKey: string; starts: number; terminations: number; net: number }[];
}): string[] | undefined {
  const d = card.details;
  if (!d) return undefined;
  const lines: string[] = [];
  switch (card.key) {
    case "org_unit_counts":
      lines.push(
        `شخص حقوقی: ${toPersianDigits(Number(d.legalEntity ?? 0))}`,
        `واحد کسب‌وکار: ${toPersianDigits(Number(d.businessUnit ?? 0))}`,
        `دپارتمان: ${toPersianDigits(Number(d.department ?? 0))}`,
        `تیم: ${toPersianDigits(Number(d.team ?? 0))}`,
      );
      break;
    case "headcount_conservation":
      lines.push(
        `تأییدشده: ${toPersianDigits(Number(d.approved ?? 0))}`,
        `مصرف: ${toPersianDigits(Number(d.used ?? 0))}`,
        `رزرو: ${toPersianDigits(Number(d.reserved ?? 0))}`,
        `آزاد: ${toPersianDigits(Number(d.free ?? 0))}`,
      );
      break;
    case "team_capacity":
      lines.push(
        `تعداد تیم: ${toPersianDigits(Number(d.teamCount ?? 0))}`,
        `ظرفیت (تأییدشده): ${toPersianDigits(Number(d.approved ?? 0))}`,
        `آزاد: ${toPersianDigits(Number(d.free ?? 0))} · مصرف: ${toPersianDigits(Number(d.used ?? 0))} · رزرو: ${toPersianDigits(Number(d.reserved ?? 0))}`,
      );
      break;
    case "starts_terminations":
      lines.push(
        `شروع: ${toPersianDigits(Number(d.starts ?? 0))}`,
        `خاتمه: ${toPersianDigits(Number(d.terminations ?? 0))}`,
        `خالص: ${toPersianDigits(Number(d.net ?? 0))}`,
      );
      break;
    case "workforce_trend":
      if (card.trend && card.trend.length > 0) {
        for (const b of card.trend.slice(-6)) {
          lines.push(
            `${toPersianDigits(b.bucketKey)} — شروع ${toPersianDigits(b.starts)} / خاتمه ${toPersianDigits(b.terminations)}`,
          );
        }
      } else {
        lines.push("در این بازه سطلی ثبت نشده.");
      }
      break;
    case "open_headcount":
      lines.push(
        `ظرفیت باز (آزاد مصرف‌پذیر): ${toPersianDigits(Number(d.openFree ?? 0))}`,
        `نزدیک انقضا: ${toPersianDigits(Number(d.nearExpiryCount ?? 0))}`,
        `منقضی (غیرمصرف‌پذیر): ${toPersianDigits(Number(d.expiredNonConsumableCount ?? 0))}`,
      );
      break;
    default:
      break;
  }
  return lines.length > 0 ? lines : undefined;
}

const GRID_CLASS =
  /* UX-DR15: 2 cols at 1280×720; 3/4 only when clearly wider than reference */
  "grid gap-4 grid-cols-2 min-[1600px]:grid-cols-3 min-[1920px]:grid-cols-4";

/**
 * Host: shared filters + responsive 2–4 column metric grid + last calculation time.
 * Grid: 2 cols at 1280×720; up to 4 at wider ≥1280 (UX-DR15).
 */
export function DashboardPanel() {
  const defaults = React.useMemo(() => defaultTrendRange(), []);
  const [filters, setFilters] = React.useState<DashboardFilterState>({
    teamId: "",
    evaluationMode: "current",
    asOfDate: undefined,
    trendRangeStart: defaults.start,
    trendRangeEnd: defaults.end,
    trendGranularity: "monthly",
  });
  const [applied, setApplied] = React.useState(filters);

  const queryInput = React.useMemo(
    () => ({
      teamId: applied.teamId.trim() ? applied.teamId.trim() : undefined,
      evaluationMode: applied.evaluationMode,
      asOfDate:
        applied.evaluationMode === "as_of" ? applied.asOfDate : undefined,
      trendRangeStart: applied.trendRangeStart ?? defaults.start,
      trendRangeEnd: applied.trendRangeEnd ?? defaults.end,
      trendGranularity: applied.trendGranularity,
    }),
    [applied, defaults],
  );

  const query = api.dashboard.snapshot.useQuery(queryInput, {
    enabled: Boolean(queryInput.trendRangeStart && queryInput.trendRangeEnd),
    // Keep cards synchronized — one query identity for all metrics.
    staleTime: 30_000,
    // Filter apply = in-place pending (AC2) — keep prior cards while new key fetches.
    placeholderData: keepPreviousData,
  });

  const cards = query.data?.cards ?? [];
  const visibleCards = cards.filter((c) => c.outcome !== "omitted");
  const allEmpty =
    query.data &&
    visibleCards.length > 0 &&
    visibleCards.every((c) => c.outcome === "empty");
  const allSuppressed =
    query.data &&
    visibleCards.length > 0 &&
    visibleCards.every((c) => c.outcome === "suppressed");

  const lastCalcFooter =
    query.data?.lastCalculatedAt != null ? (
      <p className="text-caption text-muted-foreground">
        آخرین محاسبه:{" "}
        <span className="tabular-nums" dir="ltr">
          {toPersianDigits(query.data.lastCalculatedAt)}
        </span>
        {query.data.asOf ? (
          <>
            {" "}
            · مبنا:{" "}
            <span className="tabular-nums">
              {toPersianDigits(query.data.asOf)}
            </span>
          </>
        ) : null}
      </p>
    ) : null;

  return (
    <div className="space-y-6">
      <DashboardFilters
        value={filters}
        disabled={query.isFetching}
        onApply={(next) => {
          setFilters(next);
          setApplied(next);
        }}
      />

      {query.data?.populationDisclosureFa ? (
        <p role="status" className="text-caption text-muted-foreground">
          {query.data.populationDisclosureFa}
        </p>
      ) : null}

      {!query.data && query.isLoading ? (
        <div
          className={cn(GRID_CLASS)}
          aria-busy="true"
          aria-label={operationalCopy.dashboardPending}
          data-slot="dashboard-skeleton"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-md border border-hairline p-4"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <p role="alert" className="text-body text-destructive">
          {operationalCopy.dashboardLoadError}
        </p>
      ) : allSuppressed ? (
        <>
          <p role="status" aria-live="polite" className="text-heading-sm">
            {visibleCards[0]?.messageFa || operationalCopy.suppressedCohort}
          </p>
          {lastCalcFooter}
        </>
      ) : allEmpty ? (
        <>
          <p
            role="status"
            aria-live="polite"
            className="text-body text-muted-foreground"
          >
            {operationalCopy.emptyDashboardScope}
          </p>
          {lastCalcFooter}
        </>
      ) : (
        <>
          <div className={cn(GRID_CLASS)}>
            {visibleCards.map((card) => (
              <DashboardMetricCard
                key={card.key}
                titleFa={card.titleFa}
                outcome={card.outcome}
                value={card.value}
                messageFa={card.messageFa}
                detailsLines={detailLinesForCard(card)}
                reconcileHref={card.reconcileHref}
                reconcileLabelFa={card.reconcileLabelFa}
              />
            ))}
          </div>
          {lastCalcFooter}
        </>
      )}
    </div>
  );
}
