/**
 * DESIGN chart tokens (ux-divan-2026-07-31) — single SoT for CSS, components, selfchecks.
 * Series-2 cyan is `#087A90` (8.10-A1), never `#0B8FA8`.
 */

export const CHART_CATEGORICAL_LIGHT = [
  "#1B3BBB",
  "#087A90",
  "#C2255C",
  "#7048E8",
  "#495057",
] as const;

export const CHART_CATEGORICAL_DARK = [
  "#6C8CFF",
  "#3BC9DB",
  "#F06595",
  "#A98BFF",
  "#ADB5BD",
] as const;

export const CHART_SEQUENTIAL = [
  "#E8F1FF",
  "#C2DBFF",
  "#8FBEFF",
  "#4D9BFF",
  "#0F7BFF",
  "#0A4FCC",
  "#051061",
] as const;

/** Light-canvas gridline = hairline; dark = hairline-dark. */
export const CHART_GRIDLINE_LIGHT = "#E8EAEF";
export const CHART_GRIDLINE_DARK = "#232C5E";

/**
 * Gold CTA + status badge hues — forbidden as chart series fills/strokes.
 * Keep lowercase for set membership checks.
 */
export const CHART_FORBIDDEN_AS_DATA = [
  "#fdb913", // brand gold CTA
  "#fbc470", // dark accent (gold family)
  "#1f7a32", // effective green fg
  "#2b8a3e", // legacy effective green
  "#8ce99a", // dark effective green
  "#d3f9d8", // effective green bg
  "#1b3d2f", // dark effective bg
  "#a85700", // draft amber fg
  "#e67700", // legacy draft
  "#ffe066", // dark draft fg
  "#fff9db", // draft bg
  "#3d3200", // dark draft bg
  "#1864ab", // scheduled blue fg
  "#a5d8ff", // dark scheduled fg
  "#e7f5ff", // scheduled bg
  "#1a3a5c", // dark scheduled bg
  "#862e00", // override / stale amber-brown
  "#ffb3d1", // dark override
  "#fff3bf", // override bg
  "#3d1a2e", // dark override bg
] as const;

export const CHART_CATEGORICAL_CSS_VARS = [
  "--chart-categorical-1",
  "--chart-categorical-2",
  "--chart-categorical-3",
  "--chart-categorical-4",
  "--chart-categorical-5",
] as const;

export const CHART_SEQUENTIAL_CSS_VARS = [
  "--chart-sequential-1",
  "--chart-sequential-2",
  "--chart-sequential-3",
  "--chart-sequential-4",
  "--chart-sequential-5",
  "--chart-sequential-6",
  "--chart-sequential-7",
] as const;

export type ChartSeriesMarker = "circle" | "square" | "diamond";
export type ChartSeriesDash = "solid" | "dashed" | "dotted";

/** Non-color discriminators for ≥2 series (EXPERIENCE: nothing by color alone). */
export const CHART_SERIES_MARKERS: readonly ChartSeriesMarker[] = [
  "circle",
  "square",
  "diamond",
  "circle",
  "square",
] as const;

export const CHART_SERIES_DASHES: readonly ChartSeriesDash[] = [
  "solid",
  "dashed",
  "dotted",
  "solid",
  "dashed",
] as const;

export function chartSeriesCssVar(index: number): string {
  const i = ((index % CHART_CATEGORICAL_CSS_VARS.length) +
    CHART_CATEGORICAL_CSS_VARS.length) %
    CHART_CATEGORICAL_CSS_VARS.length;
  return `var(${CHART_CATEGORICAL_CSS_VARS[i]})`;
}

export function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase();
}

export function isForbiddenChartDataColor(hex: string): boolean {
  return (CHART_FORBIDDEN_AS_DATA as readonly string[]).includes(
    normalizeHex(hex),
  );
}

/** Assert palette ∩ forbidden is empty (selfcheck + CI). */
export function assertChartPaletteClean(
  palette: readonly string[],
  label: string,
): void {
  for (const hex of palette) {
    if (isForbiddenChartDataColor(hex)) {
      throw new Error(
        `${label}: forbidden data color ${hex} appears in chart palette`,
      );
    }
  }
}
