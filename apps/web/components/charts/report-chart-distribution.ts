/**
 * Heuristic: only emit a chart companion when the run result already carries
 * a safe categorical distribution (label + count). Never invent series from
 * unrelated list columns (Story 9.10 AC #4 / Task 4).
 *
 * Known shapes:
 * - `distributions` → cells.key + cells.count
 * - `org_state` → cells.unitType + cells.count
 * - Generic fallback: columns include `count` + one of unitType|key|label|dimension
 *   (skipped when list-id columns like personnelCode/eventId/personId are present)
 */

export type ReportChartBucket = {
  label: string;
  value: number;
};

export type ReportColumnLike = { id: string; headerFa: string };
export type ReportRowLike = {
  id: string;
  cells: Record<string, string | number | boolean | null | undefined>;
};

const LABEL_CANDIDATES = ["key", "unitType", "label", "dimension"] as const;

/** Soft cap hint for callers / bar chart (viewBox legibility). */
export const REPORT_CHART_MAX_BUCKETS = 12;

export function extractReportCategoricalDistribution(
  reportKey: string,
  columns: readonly ReportColumnLike[],
  rows: readonly ReportRowLike[],
): ReportChartBucket[] | null {
  if (rows.length === 0) return null;

  const colIds = new Set(columns.map((c) => c.id));

  if (reportKey === "distributions" && colIds.has("key") && colIds.has("count")) {
    return mapBuckets(rows, "key", "count");
  }

  if (
    reportKey === "org_state" &&
    colIds.has("unitType") &&
    colIds.has("count")
  ) {
    return mapBuckets(rows, "unitType", "count");
  }

  if (!colIds.has("count")) return null;

  const labelId = LABEL_CANDIDATES.find((id) => colIds.has(id));
  if (!labelId) return null;

  // Guard: list-like reports with many id columns are not distributions.
  if (colIds.has("personnelCode") || colIds.has("eventId") || colIds.has("personId")) {
    return null;
  }

  return mapBuckets(rows, labelId, "count");
}

function mapBuckets(
  rows: readonly ReportRowLike[],
  labelKey: string,
  valueKey: string,
): ReportChartBucket[] | null {
  const aggregated = new Map<string, number>();
  for (const row of rows) {
    const raw = row.cells[valueKey];
    // Reject boolean/null/undefined — Number(null)===0 and Number(true)===1 invent buckets.
    if (typeof raw !== "number" && typeof raw !== "string") continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    const label = String(row.cells[labelKey] ?? "").trim();
    if (!label) continue;
    aggregated.set(label, (aggregated.get(label) ?? 0) + n);
  }
  if (aggregated.size === 0) return null;
  return [...aggregated.entries()].map(([label, value]) => ({ label, value }));
}
