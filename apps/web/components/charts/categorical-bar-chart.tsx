"use client";

import * as React from "react";

import {
  ChartFrame,
  ChartTooltipChip,
  buildSeriesLegend,
  formatChartNumber,
  type ChartFrameOutcome,
} from "@/components/charts/chart-frame";
import { chartSeriesCssVar } from "@/lib/chart-tokens";

export type CategoricalBarDatum = {
  label: string;
  value: number;
};

export type CategoricalBarChartProps = {
  "aria-label"?: string;
  /** Single-series bar labels use this legend entry when provided. */
  seriesLabel?: string;
  data: CategoricalBarDatum[];
  outcome?: ChartFrameOutcome;
  messageFa?: string;
  height?: number;
  className?: string;
  /** Cap categories rendered (overflow truncates with honesty). Default 12. */
  maxCategories?: number;
};

function finiteValue(raw: number): number {
  return Number.isFinite(raw) ? raw : 0;
}

/**
 * Thin SVG categorical bar chart — one measure per category.
 * Single series color (legend matches); category labels on axis (not color-only).
 */
export function CategoricalBarChart({
  "aria-label": ariaLabel,
  seriesLabel = "مقدار",
  data,
  outcome = "allowed",
  messageFa,
  height = 160,
  className,
  maxCategories = 12,
}: CategoricalBarChartProps) {
  const legend = buildSeriesLegend([seriesLabel]);
  const [tip, setTip] = React.useState<{
    x: number;
    y: number;
    label: string;
    value: string;
  } | null>(null);

  const seriesColor = chartSeriesCssVar(0);
  const capped =
    data.length > maxCategories ? data.slice(0, maxCategories) : data;

  const pad = { top: 12, right: 12, bottom: 36, left: 36 };
  const width = 480;
  const plotW = width - pad.left - pad.right;
  const plotH = Math.max(1, height - pad.top - pad.bottom);
  const maxVal = Math.max(
    1,
    ...capped.map((d) => Math.max(0, finiteValue(d.value))),
  );
  const gap = 8;
  const barW =
    capped.length === 0
      ? 0
      : Math.max(8, (plotW - gap * (capped.length - 1)) / capped.length);

  const frameOutcome =
    outcome === "allowed" && capped.length === 0 ? "empty" : outcome;

  return (
    <ChartFrame
      aria-label={ariaLabel}
      legend={legend}
      outcome={frameOutcome}
      messageFa={messageFa}
      className={className}
    >
      {capped.length === 0 ? null : (
        <div className="relative w-full" data-slot="categorical-bar-chart">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="presentation"
            aria-hidden
          >
            {[0, 0.5, 1].map((t) => {
              const y = pad.top + plotH * (1 - t);
              return (
                <line
                  key={t}
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  stroke="var(--chart-gridline)"
                  strokeWidth={1}
                />
              );
            })}
            {[0, maxVal].map((v) => (
              <text
                key={v}
                x={pad.left - 6}
                y={pad.top + plotH - (v / maxVal) * plotH + 3}
                textAnchor="end"
                className="fill-text-secondary text-caption text-tabular"
              >
                {formatChartNumber(v)}
              </text>
            ))}
            {capped.map((d, i) => {
              const v = Math.max(0, finiteValue(d.value));
              const x = pad.left + i * (barW + gap);
              const h = (v / maxVal) * plotH;
              const y = pad.top + plotH - h;
              return (
                <g
                  key={`${d.label}-${i}`}
                  onMouseEnter={() =>
                    setTip({
                      x: ((x + barW / 2) / width) * 100,
                      y: (y / height) * 100,
                      label: d.label,
                      value: formatChartNumber(v),
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                >
                  {h > 0 ? (
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      fill={seriesColor}
                      rx={2}
                    />
                  ) : null}
                  {/* Direct label — not color alone */}
                  <text
                    x={x + barW / 2}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-text-secondary text-caption"
                  >
                    {d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {data.length > maxCategories ? (
            <p className="text-caption text-muted-foreground">
              نمایش {formatChartNumber(maxCategories)} از{" "}
              {formatChartNumber(data.length)} دسته
            </p>
          ) : null}
          {tip ? (
            <ChartTooltipChip
              label={tip.label}
              value={tip.value}
              style={{
                left: `min(${tip.x}%, calc(100% - 8rem))`,
                top: `max(0px, calc(${tip.y}% - 2rem))`,
              }}
            />
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}
