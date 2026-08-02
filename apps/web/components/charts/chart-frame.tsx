"use client";

import * as React from "react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  CHART_SERIES_DASHES,
  CHART_SERIES_MARKERS,
  chartSeriesCssVar,
  type ChartSeriesDash,
  type ChartSeriesMarker,
} from "@/lib/chart-tokens";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { cn } from "@/lib/utils";

export type ChartFrameOutcome =
  | "allowed"
  | "empty"
  | "suppressed"
  | "pending"
  | "error";

export type ChartLegendItem = {
  label: string;
  color: string;
  dash?: ChartSeriesDash;
  marker?: ChartSeriesMarker;
};

export type ChartFrameProps = {
  "aria-label"?: string;
  legend: ChartLegendItem[];
  outcome?: ChartFrameOutcome;
  messageFa?: string;
  className?: string;
  children: React.ReactNode;
};

function LegendSwatch({
  color,
  dash = "solid",
  marker = "circle",
}: {
  color: string;
  dash?: ChartSeriesDash;
  marker?: ChartSeriesMarker;
}) {
  const dasharray =
    dash === "dashed" ? "4 3" : dash === "dotted" ? "1.5 2.5" : undefined;
  return (
    <svg width="28" height="12" aria-hidden className="shrink-0">
      <line
        x1="2"
        y1="6"
        x2="18"
        y2="6"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dasharray}
      />
      {marker === "square" ? (
        <rect x="18" y="2.5" width="7" height="7" fill={color} />
      ) : marker === "diamond" ? (
        <polygon points="21.5,2 25,6 21.5,10 18,6" fill={color} />
      ) : (
        <circle cx="21.5" cy="6" r="3.5" fill={color} />
      )}
    </svg>
  );
}

/**
 * Shared chart chrome — legend above plot, FeedbackMessage slots for
 * empty / suppress / pending / error (Story 9.10 / UX-DR40).
 */
export function ChartFrame({
  "aria-label": ariaLabel,
  legend,
  outcome = "allowed",
  messageFa,
  className,
  children,
}: ChartFrameProps) {
  if (outcome === "suppressed") {
    return (
      <FeedbackMessage kind="info" className={className}>
        {messageFa || operationalCopy.suppressedCohort}
      </FeedbackMessage>
    );
  }
  if (outcome === "empty") {
    return (
      <FeedbackMessage kind="empty" className={className}>
        {/* Shared empty-scope Persian (dashboard ≡ report SoT) — not surface-branded. */}
        {messageFa || operationalCopy.emptyReportScope}
      </FeedbackMessage>
    );
  }
  if (outcome === "pending") {
    return (
      <FeedbackMessage kind="pending" className={cn("opacity-70", className)}>
        {messageFa || operationalCopy.figureRecalculating}
      </FeedbackMessage>
    );
  }
  if (outcome === "error") {
    return (
      <FeedbackMessage kind="error" className={className}>
        {/* Neutral — callers should pass surface-specific messageFa when known. */}
        {messageFa || "بارگذاری ممکن نشد."}
      </FeedbackMessage>
    );
  }

  return (
    <figure
      data-slot="chart-frame"
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-2", className)}
    >
      {legend.length > 0 ? (
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1"
          data-slot="chart-legend"
          aria-label="راهنمای سری‌ها"
        >
          {legend.map((item, index) => (
            <li
              key={`${item.label}-${index}`}
              className="inline-flex items-center gap-1.5 text-caption text-text-secondary"
            >
              <LegendSwatch
                color={item.color}
                dash={item.dash}
                marker={item.marker}
              />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div data-slot="chart-plot" className="min-w-0">
        {children}
      </div>
    </figure>
  );
}

export function buildSeriesLegend(
  labels: string[],
): ChartLegendItem[] {
  return labels.map((label, i) => ({
    label,
    color: chartSeriesCssVar(i),
    dash: CHART_SERIES_DASHES[i % CHART_SERIES_DASHES.length],
    marker: CHART_SERIES_MARKERS[i % CHART_SERIES_MARKERS.length],
  }));
}

/** Navy caption tooltip chip (DESIGN chart chrome — not white popover default). */
export function ChartTooltipChip({
  label,
  value,
  style,
}: {
  label: string;
  value: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-sm border border-chrome/40 bg-chrome px-2 py-1 text-caption leading-normal text-chrome-foreground shadow-md"
      style={style}
    >
      <span className="text-caption text-chrome-foreground/80">{label}</span>
      {": "}
      <span className="text-tabular tabular-nums" dir="ltr">
        {value}
      </span>
    </div>
  );
}

export function formatChartNumber(n: string | number): string {
  return toPersianDigits(n);
}

export function strokeDashFor(dash: ChartSeriesDash | undefined): string | undefined {
  if (dash === "dashed") return "6 4";
  if (dash === "dotted") return "2 3";
  return undefined;
}
