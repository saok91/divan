import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { TableDensity } from "./types";

function densityRowClass(density: TableDensity): string {
  if (density === "comfortable") {
    return "h-table-row-comfortable min-h-[var(--table-row-comfortable)]";
  }
  return "h-table-row-dense min-h-[var(--table-row-dense)]";
}

function skeletonStickyClass(
  sticky: "identifier" | "actions" | undefined,
  scrolled: boolean,
): string | undefined {
  if (sticky === "identifier") {
    return cn(
      "sticky start-0 z-10 bg-background",
      scrolled && "shadow-[inset_-1px_0_0_var(--hairline)]",
    );
  }
  if (sticky === "actions") {
    return cn(
      "sticky end-0 z-20 bg-background",
      scrolled && "shadow-[inset_1px_0_0_var(--hairline-strong)]",
    );
  }
  return undefined;
}

export type TableSkeletonProps = {
  /** Visible data columns (excluding actions if already included). */
  columnCount: number;
  rowCount?: number;
  density?: TableDensity;
  /** When true, reserve a trailing sticky actions cell. */
  hasActionsColumn?: boolean;
  /**
   * Per-column sticky roles matching header order (length should equal
   * columnCount). Preserves 8.6 sticky geometry during cold load.
   */
  columnStickies?: Array<"identifier" | "actions" | undefined>;
  horizontallyScrolled?: boolean;
};

/**
 * Content-shaped table body skeleton — mirrors density row height and
 * approximate column rhythm. Real headers should already be rendered above.
 */
export function TableSkeleton({
  columnCount,
  rowCount = 8,
  density = "dense",
  hasActionsColumn = false,
  columnStickies,
  horizontallyScrolled = false,
}: TableSkeletonProps) {
  const cols = Math.max(columnCount, 1);
  const rows = Math.max(
    1,
    Number.isFinite(rowCount) ? Math.floor(rowCount as number) : 8,
  );
  const rowClass = densityRowClass(density);
  const widths = ["w-3/4", "w-full", "w-2/3", "w-5/6", "w-1/2", "w-4/5"];

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow
          key={`skel-row-${rowIndex}`}
          data-slot="table-skeleton-row"
          data-density={density}
          className={cn("hover:bg-transparent", rowClass)}
          aria-hidden="true"
        >
          {Array.from({ length: cols }).map((_, colIndex) => {
            const sticky =
              columnStickies?.[colIndex] ??
              (hasActionsColumn && colIndex === cols - 1
                ? "actions"
                : undefined);
            return (
              <TableCell
                key={`skel-cell-${rowIndex}-${colIndex}`}
                className={cn(
                  "py-0",
                  rowClass,
                  skeletonStickyClass(sticky, horizontallyScrolled),
                  sticky === "actions" && "w-[1%]",
                )}
              >
                <Skeleton
                  className={cn(
                    "h-3 max-w-full",
                    sticky === "actions"
                      ? "ms-auto w-8"
                      : widths[colIndex % widths.length],
                  )}
                />
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}
