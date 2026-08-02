"use client";

import * as React from "react";

import {
  ChartFrame,
  ChartTooltipChip,
  buildSeriesLegend,
  formatChartNumber,
  strokeDashFor,
  type ChartFrameOutcome,
} from "@/components/charts/chart-frame";
import {
  CHART_SERIES_DASHES,
  CHART_SERIES_MARKERS,
  chartSeriesCssVar,
  type ChartSeriesMarker,
} from "@/lib/chart-tokens";

export type CategoricalLinePoint = {
  /** Category / bucket key (shown on axis with Persian digits when numeric-ish). */
  label: string;
  /** Parallel values — one per series, same order as `seriesLabels`. */
  values: number[];
};

export type CategoricalLineChartProps = {
  "aria-label"?: string;
  seriesLabels: string[];
  points: CategoricalLinePoint[];
  outcome?: ChartFrameOutcome;
  messageFa?: string;
  /** SVG view height (width is 100%). DESIGN trend stroke ~4px. */
  height?: number;
  className?: string;
};

function finiteValue(raw: number | undefined): number {
  return Number.isFinite(raw) ? (raw as number) : 0;
}

function Marker({
  cx,
  cy,
  marker,
  color,
}: {
  cx: number;
  cy: number;
  marker: ChartSeriesMarker;
  color: string;
}) {
  if (marker === "square") {
    return (
      <rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} fill={color} />
    );
  }
  if (marker === "diamond") {
    return (
      <polygon
        points={`${cx},${cy - 4} ${cx + 4},${cy} ${cx},${cy + 4} ${cx - 4},${cy}`}
        fill={color}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={3.5} fill={color} />;
}

function formatAxisLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed === "") return label;
  const asNum = Number(trimmed);
  return Number.isFinite(asNum) ? formatChartNumber(asNum) : trimmed;
}

/**
 * Thin SVG multi-series line chart — categorical X, theme CSS series colors.
 * No chart library (Story 9.10 library policy).
 */
export function CategoricalLineChart({
  "aria-label": ariaLabel,
  seriesLabels,
  points,
  outcome = "allowed",
  messageFa,
  height = 160,
  className,
}: CategoricalLineChartProps) {
  const legend = buildSeriesLegend(seriesLabels);
  const [tip, setTip] = React.useState<{
    x: number;
    y: number;
    label: string;
    value: string;
  } | null>(null);

  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const width = 480;
  const plotW = width - pad.left - pad.right;
  const plotH = Math.max(1, height - pad.top - pad.bottom);

  const maxVal = Math.max(
    1,
    ...points.flatMap((p) =>
      p.values.map((v) => Math.max(0, finiteValue(v))),
    ),
  );

  const xAt = (i: number) =>
    pad.left +
    (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yAt = (v: number) => pad.top + plotH - (v / maxVal) * plotH;

  const frameOutcome =
    outcome === "allowed" && points.length === 0 ? "empty" : outcome;

  return (
    <ChartFrame
      aria-label={ariaLabel}
      legend={legend}
      outcome={frameOutcome}
      messageFa={messageFa}
      className={className}
    >
      {points.length === 0 ? null : (
        <div className="relative w-full" data-slot="categorical-line-chart">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="presentation"
            aria-hidden
          >
            {/* Gridlines */}
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
            {/* Y ticks */}
            {[0, maxVal].map((v) => (
              <text
                key={v}
                x={pad.left - 6}
                y={yAt(v) + 3}
                textAnchor="end"
                className="fill-text-secondary text-caption text-tabular"
              >
                {formatChartNumber(v)}
              </text>
            ))}
            {/* Series paths */}
            {seriesLabels.map((_, sIdx) => {
              const color = chartSeriesCssVar(sIdx);
              const dash =
                CHART_SERIES_DASHES[sIdx % CHART_SERIES_DASHES.length] ?? "solid";
              const marker =
                CHART_SERIES_MARKERS[sIdx % CHART_SERIES_MARKERS.length] ??
                "circle";
              const d = points
                .map((p, i) => {
                  const v = Math.max(0, finiteValue(p.values[sIdx]));
                  return `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`;
                })
                .join(" ");
              return (
                <g key={`series-${sIdx}-${seriesLabels[sIdx]}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={strokeDashFor(dash)}
                  />
                  {points.map((p, i) => {
                    const v = Math.max(0, finiteValue(p.values[sIdx]));
                    return (
                      <g
                        key={`${sIdx}-${i}-${p.label}`}
                        onMouseEnter={() =>
                          setTip({
                            x: (xAt(i) / width) * 100,
                            y: (yAt(v) / height) * 100,
                            label: `${seriesLabels[sIdx]} · ${p.label}`,
                            value: formatChartNumber(v),
                          })
                        }
                        onMouseLeave={() => setTip(null)}
                        style={{ cursor: "default" }}
                      >
                        <Marker
                          cx={xAt(i)}
                          cy={yAt(v)}
                          marker={marker}
                          color={color}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}
            {/* X labels */}
            {points.map((p, i) => (
              <text
                key={`x-${i}-${p.label}`}
                x={xAt(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-text-secondary text-caption"
              >
                {formatAxisLabel(p.label)}
              </text>
            ))}
          </svg>
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
